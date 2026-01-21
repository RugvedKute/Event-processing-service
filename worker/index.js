import { Worker } from "bullmq";
import { redisConnection } from "./utils/redis.js";
import logger from "./utils/logger.js";

const queueName = "event-processing-queue";

const worker = new Worker(
  queueName,
  async (job) => {
    const { event } = job.data;

    logger.info(
      {
        eventId: event.eventId,
        type: event.type,
      },
      "Processing event"
    );

    // Simulate work
    await new Promise((res) => setTimeout(res, 10000));

    logger.info(
      {
        eventId: event.eventId,
      },
      "Event processed successfully"
    );
  },
  {
    connection: redisConnection,
    concurrency: 5,
  }
);

worker.on("failed", (job, err) => {
  logger.error(
    {
      jobId: job?.id,
      err: err.message,
    },
    "Job failed"
  );
});

worker.on("completed", (job) => {
  logger.info(
    {
      jobId: job.id,
    },
    "Job completed"
  );
});
