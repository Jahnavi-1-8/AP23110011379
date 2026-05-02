# Campus Notifications Microservice - Architecture & System Design

## STAGE 1 — REST API DESIGN

### 1. Create Notification
- **Method**: `POST`
- **Endpoint**: `/api/v1/notifications`
- **Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "userId": "uuid",
    "title": "Placement Drive",
    "message": "Infosys is visiting campus next week...",
    "type": "Placement", // Placement, Result, Event
    "priority": 1 // 1=High, 2=Medium, 3=Low
  }
  ```
- **Response** (`201 Created`):
  ```json
  {
    "id": "uuid",
    "createdAt": "2023-10-25T10:00:00Z"
  }
  ```

### 2. Get Notifications
- **Method**: `GET`
- **Endpoint**: `/api/v1/notifications`
- **Headers**: `Authorization: Bearer <token>`
- **Query Params**:
  - `page=1&limit=20` (Pagination)
  - `isRead=false` (Filtering)
  - `sortBy=createdAt&order=desc` (Sorting)
- **Response** (`200 OK`):
  ```json
  {
    "data": [
      {
        "id": "uuid",
        "title": "Placement Drive",
        "message": "Infosys is visiting campus...",
        "type": "Placement",
        "isRead": false,
        "createdAt": "2023-10-25T10:00:00Z"
      }
    ],
    "meta": { "total": 150, "page": 1, "limit": 20 }
  }
  ```

### 3. Mark as Read
- **Method**: `PATCH`
- **Endpoint**: `/api/v1/notifications/:id/read`
- **Headers**: `Authorization: Bearer <token>`
- **Response**: `204 No Content`

### 4. Delete Notification
- **Method**: `DELETE`
- **Endpoint**: `/api/v1/notifications/:id`
- **Headers**: `Authorization: Bearer <token>`
- **Response**: `204 No Content`

### 5. Bulk Notify Users
- **Method**: `POST`
- **Endpoint**: `/api/v1/notifications/bulk`
- **Headers**: `Authorization: Bearer <token>`
- **Request Body**:
  ```json
  {
    "userIds": ["uuid1", "uuid2"],
    "title": "Exam Results Out",
    "type": "Result"
  }
  ```
- **Response**: `202 Accepted` (Processed asynchronously)

### 6. Unread Count
- **Method**: `GET`
- **Endpoint**: `/api/v1/notifications/unread-count`
- **Headers**: `Authorization: Bearer <token>`
- **Response** (`200 OK`):
  ```json
  { "count": 12 }
  ```

### 7. Notification Preferences
- **Method**: `PUT`
- **Endpoint**: `/api/v1/notifications/preferences`
- **Headers**: `Authorization: Bearer <token>`
- **Request Body**:
  ```json
  {
    "email": true,
    "push": true,
    "types": ["Placement", "Result"]
  }
  ```

### Realtime Notifications Design
- **WebSockets**: Bi-directional, stateful connection. Best for highly interactive apps (like chat). Overkill for pure notifications as the client mostly just receives data.
- **Server-Sent Events (SSE)**: Uni-directional from server to client. Lightweight over standard HTTP. *Best choice* for real-time notifications because the client only needs to listen for updates.
- **Message Brokers (Kafka/RabbitMQ)**: Used internally between microservices. The Notification Service consumes events from a Kafka topic (e.g., `exam.results.published`) and fans them out to connected clients via SSE or WebSockets.

---

## STAGE 2 — STORAGE & SCALABILITY

### Best DB Choice: PostgreSQL
**Why?** Notifications require strong relational ties to users and strict schema definitions. Filtering by `isRead`, `userId`, and `createdAt` is highly structured. PostgreSQL handles this beautifully with B-tree indexes and partitioning. NoSQL (like MongoDB) could work but often fails when complex transactional state (like marking bulk notifications as read) is needed.

### Detailed DB Schema
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    type VARCHAR(50) NOT NULL,
    priority INT DEFAULT 3,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Essential Indexes
CREATE INDEX idx_notifications_user_id_is_read_created_at 
ON notifications(user_id, is_read, created_at DESC);
```

### Partitioning Strategy
Table `notifications` will grow massively. We should use **Range Partitioning by `created_at`** (e.g., monthly). Old partitions can be archived or dropped to maintain fast query times.

### Scaling & Bottlenecks
- **Bottleneck**: Read-heavy operations on `unread-count` and mass writes during bulk inserts.
- **Scaling**: 
  - Use **Read Replicas** for `GET /notifications` and `unread-count`.
  - Use **Redis** to cache the `unread-count` per user (incremented on new notification, decremented on read).
  - Use **SQS/RabbitMQ** for bulk notifications so the database isn't overwhelmed.

---

## STAGE 3 — QUERY OPTIMIZATION

**Analyze Query**:
```sql
SELECT * FROM notifications
WHERE studentId = 1042
AND isRead = false
ORDER BY createdAt DESC;
```

**Why it's slow**: 
Without an index, the DB performs a full table scan. Even with an index on `studentId`, if `isRead` and `createdAt` aren't part of it, the DB fetches all rows for `studentId`, filters out read ones, and then runs an expensive in-memory sort (`File Sort`).

**Why Indexing Every Column is Bad**: 
Every INSERT/UPDATE requires the DB to update all indexes. This drastically slows down write operations and inflates storage space.

**Optimized Index**:
```sql
CREATE INDEX idx_student_unread_recent 
ON notifications(studentId, isRead) INCLUDE (createdAt, title, message);
```
*(Using a Covering Index avoids a secondary lookup to the table heap).*

**New Query (Placement last 7 days)**:
```sql
SELECT studentId 
FROM notifications
WHERE type = 'Placement'
AND createdAt >= NOW() - INTERVAL '7 days';
```
*Index needed*: `CREATE INDEX idx_type_created_at ON notifications(type, createdAt);`

---

## STAGE 4 — PERFORMANCE

### Fetching Notifications on Page Load Problem
Fetching from DB on every page load kills performance.

### Solutions
- **Caching**: Cache the `unread-count` and the first page (top 20 notifications) in **Redis**.
- **Polling vs Push**: Long polling is resource-intensive. **SSE (Push)** is vastly superior as the server only sends data when a new notification exists.
- **Pagination**: Use **Cursor-based pagination** instead of Offset-based to prevent slow queries on deep pages.
- **Batching**: Mark items as read in bulk rather than one by one.

### Tradeoffs Table

| Strategy | Pros | Cons |
|---|---|---|
| HTTP Polling | Simple to implement | Wastes bandwidth, high server load |
| Server-Sent Events | Lightweight, real-time push, native to HTTP | Unidirectional (Server to Client only) |
| WebSockets | Low latency, bi-directional | Stateful, harder to scale and load balance |
| Redis Caching | Blazing fast reads | Cache invalidation is complex |

---

## STAGE 5 — RELIABILITY & ERROR HANDLING

**Flaws in naive pseudocode (Direct API to DB insertion)**:
1. **No Retries**: If DB is down, notification is lost permanently.
2. **Synchronous Bulk**: Sending an email to 10,000 students synchronously will time out the API and block threads.
3. **Lack of Idempotency**: If a client retries a failed request, the user gets duplicate notifications.

**Redesigned Architecture Flow (Event-Driven)**:
1. Client calls `/notifications/bulk`.
2. API validates request and pushes an event to **Kafka/RabbitMQ** (`notification.created`).
3. API returns `202 Accepted` immediately.
4. **Notification Worker** consumes the queue.
   - If user prefers emails, pushes to `email.queue`.
   - Writes to DB.
5. If DB fails, the message goes to a **Dead-Letter Queue (DLQ)** for manual inspection or later retry.

**Idempotency & Consistency**:
- Use an `Idempotency-Key` header. Cache it in Redis. If the same key arrives, return the cached successful response.
- Use **Eventual Consistency**. Users don't need notifications *instantly*; a 2-second delay is acceptable for bulk jobs.

---

## STAGE 6 — PRIORITY INBOX CODING TASK

Below is the complete, efficient working Node.js implementation for fetching and maintaining top 10 unread notifications.

```javascript
/**
 * Priority Inbox Coding Task
 * 
 * Rules: Placement (3) > Result (2) > Event (1). Newer ones tie-break.
 * We want the TOP 10 highest priority unread notifications efficiently.
 * 
 * Time Complexity: O(N log K) where N is fetched notifications, K=10.
 * Space Complexity: O(K) for maintaining the heap.
 * 
 * Scalability Discussion: 
 * If a user has thousands of unread notifications, sorting all of them is O(N log N).
 * By using a Min-Heap of size 10, we achieve O(N log 10) -> O(N), 
 * drastically reducing memory and CPU usage, making this streaming-friendly.
 */

const axios = require('axios');
require('dotenv').config();

// Priority mapping
const PRIORITY_MAP = {
  'Placement': 3,
  'Result': 2,
  'Event': 1
};

// Helper to determine if notification 'a' is higher priority than 'b'
function isHigherPriority(a, b) {
  const pA = PRIORITY_MAP[a.type] || 0;
  const pB = PRIORITY_MAP[b.type] || 0;
  
  if (pA !== pB) return pA > pB;
  
  // Tie-breaker: newer notifications are higher priority
  return new Date(a.createdAt) > new Date(b.createdAt);
}

// Min-Heap implementation tailored for Top-K tracking
class PriorityMinHeap {
  constructor(maxSize) {
    this.heap = [];
    this.maxSize = maxSize;
  }

  // We want the MIN element (lowest priority among the top 10) at the root
  // so we can easily replace it when a better one comes.
  push(notification) {
    if (this.heap.length < this.maxSize) {
      this.heap.push(notification);
      this.bubbleUp(this.heap.length - 1);
    } else if (isHigherPriority(notification, this.heap[0])) {
      this.heap[0] = notification;
      this.sinkDown(0);
    }
  }

  bubbleUp(idx) {
    const element = this.heap[idx];
    while (idx > 0) {
      let parentIdx = Math.floor((idx - 1) / 2);
      let parent = this.heap[parentIdx];
      // If element is LOWER priority than parent, it bubbles up the min-heap
      if (isHigherPriority(parent, element)) {
        this.heap[idx] = parent;
        this.heap[parentIdx] = element;
        idx = parentIdx;
      } else {
        break;
      }
    }
  }

  sinkDown(idx) {
    const length = this.heap.length;
    const element = this.heap[idx];
    while (true) {
      let leftChildIdx = 2 * idx + 1;
      let rightChildIdx = 2 * idx + 2;
      let leftChild, rightChild;
      let swap = null;

      if (leftChildIdx < length) {
        leftChild = this.heap[leftChildIdx];
        if (isHigherPriority(element, leftChild)) {
          swap = leftChildIdx;
        }
      }
      
      if (rightChildIdx < length) {
        rightChild = this.heap[rightChildIdx];
        if (
          (swap === null && isHigherPriority(element, rightChild)) ||
          (swap !== null && isHigherPriority(leftChild, rightChild))
        ) {
          swap = rightChildIdx;
        }
      }

      if (swap === null) break;
      this.heap[idx] = this.heap[swap];
      this.heap[swap] = element;
      idx = swap;
    }
  }

  getSortedItems() {
    // Return sorted highest to lowest
    return [...this.heap].sort((a, b) => isHigherPriority(a, b) ? -1 : 1);
  }
}

async function getTop10PriorityInbox(userId) {
  try {
    // 1. Fetch unread notifications from Protected API
    const response = await axios.get(`${process.env.API_BASE_URL}/notifications`, {
      params: { userId, isRead: false },
      headers: { Authorization: `Bearer ${process.env.AUTH_TOKEN}` }
    });
    
    const notifications = response.data.notifications || [];
    
    // 2. Stream through and maintain top 10
    const heap = new PriorityMinHeap(10);
    
    for (const notif of notifications) {
      heap.push(notif);
    }
    
    return heap.getSortedItems();
  } catch (error) {
    console.error("Failed to process priority inbox:", error.message);
    throw error;
  }
}

// Sample Output execution block
if (require.main === module) {
  // Mock data simulation
  const mockNotifications = [
    { id: 1, type: 'Event', createdAt: '2023-10-01T10:00:00Z' },
    { id: 2, type: 'Placement', createdAt: '2023-10-02T10:00:00Z' },
    { id: 3, type: 'Result', createdAt: '2023-10-03T10:00:00Z' },
    { id: 4, type: 'Placement', createdAt: '2023-10-04T10:00:00Z' }
  ];
  
  const heap = new PriorityMinHeap(10);
  mockNotifications.forEach(n => heap.push(n));
  console.log("Top Priority Inbox:", heap.getSortedItems());
}
```
