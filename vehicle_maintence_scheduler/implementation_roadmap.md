# Professional Backend Implementation Roadmap

This document provides a complete, production-grade, step-by-step roadmap to implement your backend assignment. It follows Clean Architecture principles, ensuring scalability, maintainability, and enterprise-level logging.

---

## STEP 1 — PROJECT SETUP

**Why these packages?**
- `express`: Fast, unopinionated web framework.
- `axios`: For making external API calls to the evaluation service.
- `axios-retry`: To gracefully handle intermittent network/5xx errors from the evaluation service.
- `dotenv`: To keep secrets (JWT token, API URLs) out of version control.

**Folder Structure:**
```text
project-root/
├── src/
│   ├── config/          # Environment variables & setup
│   ├── middlewares/     # Express middlewares (Error handling)
│   ├── services/        # External API calls & business logic
│   ├── controllers/     # Request handlers
│   ├── routes/          # API route definitions
│   ├── utils/           # Helper functions (Knapsack, Heap)
│   └── app.js           # Express app entry point
├── .env                 # Secrets (JWT Token)
├── .gitignore
└── package.json
```

---

## STEP 2 — LOGGING MIDDLEWARE (MANDATORY FIRST)

**Why is this necessary?**
In distributed systems, localized console logs are useless. Logs must be aggregated centrally so monitoring tools can alert on failures. You are required to `POST` to `/evaluation-service/logs`.

**Implementation:** Create `src/services/loggerService.js`

```javascript
const axios = require('axios');
const axiosRetry = require('axios-retry').default;
const env = require('../config/env');

// Create an isolated client just for logging to prevent circular dependencies
const logClient = axios.create({
  baseURL: env.API_BASE_URL,
  timeout: 3000, // Logs should fail fast so they don't bottleneck the app
  headers: {
    'Authorization': `Bearer ${env.AUTH_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

// Retry logic for transient failures
axiosRetry(logClient, { retries: 2, retryDelay: axiosRetry.exponentialDelay });

const ALLOWED_LEVELS = ['info', 'debug', 'error', 'fatal'];

/**
 * Enterprise Logging Function
 * @param {string} stack - High-level module (e.g., "SchedulerService")
 * @param {string} level - Log level (info, debug, error, fatal)
 * @param {string} pkg - Specific function/package (e.g., "generateOptimalSchedule")
 * @param {string} message - The actual log message
 */
async function Log(stack, level, pkg, message) {
  if (!ALLOWED_LEVELS.includes(level)) {
    console.error(`Invalid log level: ${level}`);
    level = 'info'; // Fallback
  }

  const payload = { stack, level, package: pkg, message };

  // Fallback to console for local debugging
  if (level === 'error' || level === 'fatal') {
    console.error(`[${level.toUpperCase()}] [${stack}::${pkg}] ${message}`);
  } else {
    console.log(`[${level.toUpperCase()}] [${stack}::${pkg}] ${message}`);
  }

  try {
    // Fire and forget (don't await) to prevent slowing down the main thread
    logClient.post('/logs', payload).catch(err => {
      console.error('Failed to push log to remote server:', err.message);
    });
  } catch (error) {
    console.error('Log client error:', error.message);
  }
}

module.exports = { Log };
```

---

## STEP 3 — API CLIENT LAYER

**Why a centralized layer?**
If the API base URL changes, or if we need to rotate tokens, we do it in one place. Additionally, placing retry logic centrally ensures *all* outgoing requests are resilient to 502/503 errors.

**Implementation:** Create `src/services/apiClient.js`

```javascript
const axios = require('axios');
const axiosRetry = require('axios-retry').default;
const env = require('../config/env');

const apiClient = axios.create({
  baseURL: env.API_BASE_URL,
  timeout: 5000, 
  headers: {
    'Authorization': `Bearer ${env.AUTH_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

// If the evaluation service rate-limits us or goes down briefly, retry seamlessly
axiosRetry(apiClient, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    return axiosRetry.isNetworkOrIdempotentRequestError(error) || error.response?.status >= 500;
  }
});

module.exports = apiClient;
```

---

## STEP 4 — VEHICLE MAINTENANCE SCHEDULER

**Why a Knapsack Problem?**
We have a fixed capacity (`MechanicHours` = Knapsack weight limit). We have items (`Tasks`) with weights (`Duration`) and values (`Impact`). We must maximize the value without exceeding the weight. Greedy algorithms fail here because taking the highest impact ratio task might leave us with an awkward remaining time gap that prevents us from taking other high-impact tasks.

**Dynamic Programming Implementation:** Create `src/utils/knapsack.js`

```javascript
function solveKnapsack(tasks, capacity) {
  const n = tasks.length;
  const dp = Array(n + 1).fill(null).map(() => Array(capacity + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    const task = tasks[i - 1];
    const weight = Math.ceil(task.Duration);
    const value = task.Impact;

    for (let w = 1; w <= capacity; w++) {
      if (weight <= w) {
        dp[i][w] = Math.max(value + dp[i - 1][w - weight], dp[i - 1][w]);
      } else {
        dp[i][w] = dp[i - 1][w];
      }
    }
  }

  // Reconstruct chosen tasks
  const selectedTasks = [];
  let res = dp[n][capacity];
  let w = capacity;
  let totalDuration = 0;

  for (let i = n; i > 0 && res > 0; i--) {
    if (res !== dp[i - 1][w]) {
      const includedTask = tasks[i - 1];
      selectedTasks.push(includedTask);
      res -= includedTask.Impact;
      w -= Math.ceil(includedTask.Duration);
      totalDuration += Math.ceil(includedTask.Duration);
    }
  }

  return {
    selectedTasks: selectedTasks.reverse(),
    totalImpact: dp[n][capacity],
    totalDuration,
    remainingHours: capacity - totalDuration
  };
}
module.exports = { solveKnapsack };
```

**Service Layer Integration:**
In your `schedulerService.js`, use the `Log` function heavily.

```javascript
// Example usage inside schedulerService.js
await Log('Scheduler', 'info', 'generateOptimalSchedule', `Starting optimization for depot ${depotId}`);
const algoStart = Date.now();
const result = solveKnapsack(tasks, capacity);
await Log('Scheduler', 'debug', 'generateOptimalSchedule', `Algorithm finished in ${Date.now() - algoStart}ms`);
```

**Complexity:**
- **Time Complexity**: O(N * W) where N is tasks and W is capacity.
- **Space Complexity**: O(N * W) for the DP table.
- **Scalability**: For massive capacities, standard DP uses too much memory. We would switch to a 1D DP array, or if exact precision isn't required, a Greedy FPTAS (Fully Polynomial Time Approximation Scheme) to trade a tiny fraction of accuracy for immense speed.

---

## STEP 5 — NOTIFICATION SYSTEM DESIGN DOCUMENT

Create `notification_system_design.md` with structured markdown. Do not skimp on formatting.

**What to write:**
- **Stage 1**: Define JSON schemas. Choose **SSE (Server-Sent Events)** over WebSockets because notifications are uni-directional (Server -> Client). SSE is lighter, native to HTTP, and easier to scale behind load balancers.
- **Stage 2**: Choose **PostgreSQL** because notifications have strict relational boundaries (users, read states, creation times). Describe Range Partitioning by month to handle millions of rows.
- **Stage 3**: Explain that the query requires a `File Sort` without indexes. Create a Covering Index: `CREATE INDEX idx_student_read_created ON notifications (studentId, isRead) INCLUDE (createdAt);`.
- **Stage 4**: Introduce Redis to cache the `unread-count`. Explain cursor-based pagination over offset pagination to prevent DB thrashing.
- **Stage 5**: Explain that synchronous email dispatch will crash the server. Redesign using Event-Driven Architecture (Kafka/RabbitMQ) and Dead-Letter Queues (DLQ) for failed emails, ensuring Eventual Consistency.

---

## STEP 6 — PRIORITY INBOX IMPLEMENTATION

**Why a Min-Heap?**
If a student has 5,000 unread notifications, sorting all of them takes O(N log N) time and heavy memory. By maintaining a Min-Heap of exactly size 10, we achieve O(N log 10) = O(N) time complexity and strict O(1) space. As a stream of notifications comes in, if a notification is higher priority than the *root* (minimum) of the heap, we replace the root and sink it down.

**Implementation Structure:** Create `src/utils/priorityHeap.js`

```javascript
const PRIORITY = { 'Placement': 3, 'Result': 2, 'Event': 1 };

function isHigherPriority(a, b) {
  const pA = PRIORITY[a.Type] || 0;
  const pB = PRIORITY[b.Type] || 0;
  if (pA !== pB) return pA > pB;
  return new Date(a.Timestamp) > new Date(b.Timestamp);
}

class Top10MinHeap {
  constructor() {
    this.heap = [];
  }
  
  push(item) {
    if (this.heap.length < 10) {
      this.heap.push(item);
      this.bubbleUp(this.heap.length - 1);
    } else if (isHigherPriority(item, this.heap[0])) {
      this.heap[0] = item;
      this.sinkDown(0);
    }
  }
  
  // Implement standard bubbleUp and sinkDown logic here, comparing using isHigherPriority
  // (Inverted logic because we want the LEAST priority of the top 10 at the root)
}
```

Endpoint: `GET /api/v1/notifications/priority`
Controller uses `apiClient.get('/notifications')`, pushes to heap, and returns `heap.getSorted()`.

---

## STEP 7 — TESTING & OUTPUT SCREENSHOTS

1. **Postman setup**: Put `Authorization` -> `Bearer <YOUR_JWT>` in the Headers tab.
2. **Screenshots to capture**: 
   - Postman returning 200 OK for `GET /api/v1/scheduler/1`. Highlight the "Time: 45ms" to prove optimization.
   - Postman returning the Priority Inbox results.
   - Terminal screenshot showing the logs firing.

---

## STEP 8 — FINAL SUBMISSION PREPARATION

1. **Clean Code**: Ensure no `console.log` statements remain outside of your dedicated `loggerService`.
2. **Commit Strategy**: Do exactly what they asked. *"Submit your response as a single commit at the end of the test."* 
   - Commit Message: `feat: implementation of vehicle scheduler and priority notification system`
3. **Common Mistakes**:
   - Hardcoding the JWT token in code instead of `.env`.
   - Failing to handle external API timeouts.
   - Leaving the DP array unbounded (without rounding durations if they are floats).
4. **How to Stand Out**:
   - Include a fully populated `README.md` explaining your architectural decisions (why DP, why Min-Heap, why Axios interceptors).
   - Show evidence of the remote `POST /logs` actually working.
