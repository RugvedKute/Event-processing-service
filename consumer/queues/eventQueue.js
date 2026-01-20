import { Queue } from "bullmq";
import { redisConnection } from "../utils/redis.js";

const queueName = "event-processing-queue";

export const eventQueue = new Queue(queueName, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});
