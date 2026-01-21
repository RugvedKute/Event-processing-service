# Event Processing Service

A **production-grade event processing pipeline** built with **Kafka**, **BullMQ**, and **Redis**. This system demonstrates enterprise patterns including schema validation, retry mechanisms, idempotent processing, and horizontal scalability.

---

## 📋 Table of Contents

- [Architecture Overview](#-architecture-overview)
- [Key Features](#-key-features)
- [Event Schema](#-event-schema)
- [Getting Started](#-getting-started)
- [Testing the Pipeline](#-testing-the-pipeline)
- [Scaling Workers](#-scaling-workers)
- [Design Decisions](#-design-decisions)
- [Monitoring & Observability](#-monitoring--observability)
- [Troubleshooting](#-troubleshooting)

---

## 🏗 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Event Flow Pipeline                      │
└─────────────────────────────────────────────────────────────┘

  Kafka Topic           Kafka Consumer         BullMQ Queue
  (consume-event)    (Node.js + KafkaJS)    (process-event)
        │                     │                     │
        │   1. Consume        │                     │
        ├────────────────────>│                     │
        │                     │                     │
        │                     │  2. Validate        │
        │                     │  (Zod Schema)       │
        │                     │                     │
        │                     │  3. Enqueue         │
        │                     ├────────────────────>│
        │                     │                     │
        │                     │  4. Commit Offset   │
        │<────────────────────┤                     │
        │                     │                     │
                                                    │
                              Worker Pool           │
                           (5 concurrent jobs)      │
                                    │               │
                                    │  5. Process   │
                                    │<──────────────┤
                                    │               │
                                    │  6. Execute   │
                                    │  Business     │
                                    │  Logic        │
                                    │               │
                                    v
                           ┌─────────────────┐
                           │  Redis (State)  │
                           │  - Job Tracking │
                           │  - Deduplication│
                           │  - Retries      │
                           └─────────────────┘
```

---

## ✨ Key Features

- **Schema Validation**: Strict Zod-based validation before processing
- **Idempotent Processing**: Duplicate events automatically deduplicated using `eventId`
- **Automatic Retries**: Exponential backoff with configurable attempts
- **Horizontal Scaling**: Add workers without code changes
- **Kafka Health Checks**: Automatic startup dependency management

---

## 📦 Event Schema

All Kafka messages must conform to this JSON structure:

```json
{
  "eventId": "evt-001",
  "timestamp": 1737200000000,
  "type": "USER_CREATED",
  "payload": {
    "userId": "u123",
    "email": "user@example.com"
  }
}
```

### Field Specifications

| Field       | Type     | Required | Description                         |
| ----------- | -------- | -------- | ----------------------------------- |
| `eventId`   | `string` | ✅       | Unique identifier for deduplication |
| `timestamp` | `number` | ✅       | Unix epoch time in milliseconds     |
| `type`      | `string` | ✅       | Event type (e.g., USER_CREATED)     |
| `payload`   | `object` | ✅       | Event-specific data                 |

### Validation Behavior

- **Valid events**: Enqueued to BullMQ for processing
- **Invalid events**: Logged and discarded (not enqueued)
- **Validation errors**: Include detailed error messages in logs

---

## 🚀 Getting Started

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) (v20.10+)
- [Docker Compose](https://docs.docker.com/compose/install/) (v2.0+)

### Quick Start

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd event-processing-service
   ```

2. **Start all services**

   ```bash
   docker compose down -v
   docker compose up --build
   ```

3. **Access Kafka UI**

   Open [http://localhost:8080](http://localhost:8080) in your browser

### Services Started

| Service        | Port | Description                        |
| -------------- | ---- | ---------------------------------- |
| Kafka          | 9092 | Event streaming platform           |
| Kafka UI       | 8080 | Web interface for Kafka management |
| Redis          | 6379 | Job queue state and deduplication  |
| Kafka Consumer | -    | Consumes events from Kafka         |
| Worker         | -    | Processes jobs from BullMQ         |

### Startup Sequence

The system includes health checks to ensure proper startup order:

1. Kafka starts and becomes ready
2. Redis starts
3. Kafka Consumer connects (waits for Kafka health check)
4. Workers connect to Redis and begin processing

---

## 🧪 Testing the Pipeline

### Method 1: Kafka UI (Recommended)

1. Navigate to [http://localhost:8080](http://localhost:8080)
2. Go to **Topics** → **consume-event**
3. Click **Produce Message**
4. Paste this test event:

   ```json
   {
     "eventId": "evt-test-001",
     "timestamp": 1737200000000,
     "type": "USER_CREATED",
     "payload": {
       "userId": "u123",
       "email": "test@example.com"
     }
   }
   ```

5. Click **Produce**

### Method 2: Kafka CLI (Advanced)

```bash
docker compose exec kafka kafka-console-producer \
  --broker-list localhost:9092 \
  --topic consume-event << EOF
{"eventId":"evt-cli-001","timestamp":1737200000000,"type":"USER_CREATED","payload":{"userId":"u456","email":"cli@example.com"}}
EOF
```

### Expected Output

**Kafka Consumer Logs:**

```
✓ Kafka consumer connected
✓ Kafka event enqueued: evt-test-001 (topic: consume-event, partition: 0, offset: 42)
```

**Worker Logs:**

```
→ Processing event: evt-test-001
✓ Event processed successfully: evt-test-001
```

### Testing Idempotency

Send the same event twice:

1. Produce the same message again with `eventId: "evt-test-001"`
2. **Expected behavior:**
   - Kafka consumes the message
   - BullMQ deduplicates based on `eventId`
   - Worker **does not** process it again

---

## ⚙️ Scaling Workers

### Current Configuration

Each worker runs with:

- **Concurrency**: 5 jobs processed simultaneously per worker
- **Default workers**: 1

### Horizontal Scaling

Scale to 4 workers (20 total concurrent jobs):

```bash
docker compose up -d --scale worker=4
```

**Result:**

- 4 workers × 5 concurrency = **20 parallel jobs**
- No code changes required
- BullMQ automatically distributes jobs across workers

### Monitoring Scaled Workers

```bash
docker compose logs -f worker
```

You'll see logs from all worker instances processing jobs in parallel.

---

## 🧠 Design Decisions

### Why Kafka + BullMQ?

This architecture separates **event ingestion** from **event processing**:

| Component          | Responsibility                                   |
| ------------------ | ------------------------------------------------ |
| **Kafka**          | Durable event ingestion, ordering, replayability |
| **Kafka Consumer** | Thin, fast validation and enqueueing             |
| **BullMQ**         | Retry logic, concurrency control, job visibility |
| **Worker**         | Business logic execution                         |

**Benefits:**

- Kafka handles high-throughput ingestion
- BullMQ provides sophisticated job processing features
- Consumer remains lightweight and fast
- Processing can scale independently from ingestion

### Retry Strategy

**Configuration:**

- **Attempts**: 3
- **Backoff**: Exponential (1s, 2s, 4s)
- **Offset Commit**: After enqueue (not after processing)

**Why commit after enqueue?**

- Prevents Kafka re-delivery storms
- Failed jobs are retried by BullMQ, not Kafka
- Kafka offset represents "received and queued", not "fully processed"

### Idempotency & Deduplication

**Mechanism:**

- `eventId` is used as BullMQ `jobId`
- BullMQ enforces one job per `jobId` per queue
- Duplicate Kafka messages don't create duplicate jobs

**Guarantees:**

- **At-least-once delivery** from Kafka
- **Exactly-once processing** at the worker level
- No duplicate side effects from retries or Kafka replays

### Why Redis?

Redis powers BullMQ's features:

- Job state management (waiting, active, completed, failed)
- Distributed locks for job processing
- Retry scheduling and backoff
- Deduplication via job IDs
- Worker coordination across instances

---

## 📊 Monitoring & Observability

### Current Logging

The system includes structured logging with:

- Event IDs for tracing
- Kafka metadata (topic, partition, offset)
- Processing status and errors
- Timestamp information

**Built with ❤️ using Kafka, BullMQ, and Redis**
