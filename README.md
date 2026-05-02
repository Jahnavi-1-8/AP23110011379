# Vehicle Maintenance Scheduler & Campus Notifications

A production-grade Node.js microservice architecture solving the **0/1 Knapsack optimization problem** for vehicle maintenance scheduling, alongside a **Min-Heap stream processing** implementation for a campus priority inbox.

## 🚀 Overview
This repository contains the backend implementation for a strict algorithmic constraint problem. It integrates with protected external evaluation APIs, manages state without local databases (for the scheduler), and enforces enterprise-grade structured logging.

### Key Features
- **Algorithmically Optimized**: Replaces brute-force and greedy scheduling approaches with a strict 0/1 Dynamic Programming (DP) Knapsack solver ($O(N \times W)$).
- **Stream Processing**: Uses a bounded Min-Heap data structure to process streaming priority notifications in $O(N)$ time and strict $O(K)$ space.
- **Resilient API Layer**: Features an Axios HTTP client with interceptors, exponential backoff, and jitter for handling intermittent 5xx/429 failures from external services.
- **Enterprise Logging**: A centralized logging middleware that asynchronously streams formatted log events to a remote evaluation metrics server using Bearer Auth.

## 🛠 Tech Stack
- **Runtime**: Node.js
- **Framework**: Express.js
- **Network Client**: Axios (with `axios-retry`)
- **Environment Management**: `dotenv`

---

## 🏗 Architecture Decisions

### 1. Why Dynamic Programming over Greedy?
A greedy scheduling algorithm (sorting tasks by impact-to-duration ratio) fails at boundary constraints, often leaving unusable gaps of mechanic time. The DP matrix evaluates every possible subset, guaranteeing the mathematical global maximum impact without exceeding the depot's `MechanicHours` capacity.

### 2. Centralized Fire-and-Forget Logging
Synchronous logging to external servers will block the Node.js event loop under heavy throughput. The `Log()` function uses a dedicated Axios client instance to fire requests asynchronously, ensuring core business algorithms never bottleneck due to telemetry delays.

### 3. Min-Heap for Priority Inbox
Sorting an array of millions of notifications takes $O(N \log N)$ memory and time. By utilizing a Min-Heap capped at a size of 10, we maintain the absolute highest-priority notifications in a strict $O(K)$ space boundary as the data streams in.

---

## ⚙️ Setup Instructions

### Prerequisites
- Node.js (v18+ recommended)
- NPM

### Installation
1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up the environment file by renaming `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
4. Insert your valid JWT access token into the `.env` file:
   ```env
   AUTH_TOKEN=your_jwt_token_here
   API_BASE_URL=http://20.207.122.201/evaluation-service
   ```

### Running the Server
**Development Mode:**
```bash
npm run dev
```

---

## 📡 API Endpoints

### 1. Generate Optimal Schedule
**`GET /api/v1/schedule/:depotId`**

Fetches available mechanic hours for the specified depot, fetches all available vehicle tasks, and runs the DP optimization to pack the schedule for maximum impact.

**Example Response (200 OK)**
```json
{
  "status": "success",
  "data": {
    "depotId": "1",
    "selectedTasks": [
      { "TaskID": "8add0972-8d7e-4bcb...", "Duration": 5, "Impact": 5 }
    ],
    "totalImpact": 131,
    "totalDuration": 60,
    "remainingHours": 0
  }
}
```

### 2. Fetch Priority Inbox (Stage 6)
**`GET /api/v1/notifications/priority`**

Streams the top 10 most critical notifications using the Min-Heap priority algorithm.

---

## 🛡 Authentication Flow
This microservice heavily relies on downstream evaluation APIs. All outbound requests to `/depots`, `/vehicles`, and `/logs` are automatically injected with the `Authorization: Bearer <TOKEN>` header via the centralized `apiClient` interceptor. If the downstream server rejects the token (e.g. returning `401`), the service gracefully wraps this into a `502 Bad Gateway` to alert the client of external dependency failure.
