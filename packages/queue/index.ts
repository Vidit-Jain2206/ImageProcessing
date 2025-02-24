import { Queue, Worker } from "bullmq";

const connection = { host: "localhost", port: 6379 };

export const csvProcessingQueue = new Queue("csv-processing-queue", {
  connection,
});

export const imageProcessingQueue = new Queue("image-processing-queue", {
  connection,
});
export const createWorker = (queueName: string, processor: any) => {
  return new Worker(queueName, processor, { connection });
};
