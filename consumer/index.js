import { Kafka } from "kafkajs";
import logger from "./utils/logger.js";
import { eventQueue } from "./queues/eventQueue.js";
import { EventSchema } from "./schemas/event.schema.js";

const kafka = new Kafka({
  clientId: "event-consumer",
  brokers: ["kafka:9092"],
});

const consumer = kafka.consumer({
  groupId: "event-consumer-group",
});

const admin = kafka.admin();

const createTopic = async () => {
  await admin.connect();

  await admin.createTopics({
    topics: [
      {
        topic: "consume-event",
        numPartitions: 3,
        replicationFactor: 1,
      },
    ],
    timeout: 5000,
  });

  await admin.disconnect();
};

export const startKafkaConsumer = async () => {
  await createTopic();
  await consumer.connect();
  await consumer.subscribe({
    topic: "consume-event",
    fromBeginning: false,
  });

  logger.info("Kafka consumer connected");

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      if (!message.value) return;

      try {
        const rawValue = message.value.toString();
        const parsed = JSON.parse(rawValue);
        const event = EventSchema.parse(parsed);

        await eventQueue.add(
          "process-event",
          {
            topic,
            partition,
            offset: message.offset,
            event,
          },
          {
            jobId: event.eventId,
          }
        );

        logger.info(
          {
            eventId: event.eventId,
            type: event.type,
            topic,
            partition,
            offset: message.offset,
          },
          "Kafka event enqueued"
        );
      } catch (err) {
        logger.error(
          {
            err: err.message,
            topic,
            partition,
            offset: message.offset,
          },
          "Failed to process Kafka message"
        );
      }
    },
  });
};

startKafkaConsumer()
  .then(logger.info(`Kafka consumer started`))
  .catch((err) => {
    logger.error(`Error in starting kafka consumer ${err}`);
  });

process.on("SIGTERM", async () => {
  logger.info("Shutting down Kafka consumer...");
  await consumer.disconnect();
  process.exit(0);
});
