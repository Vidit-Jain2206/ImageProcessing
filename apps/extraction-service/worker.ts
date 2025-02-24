import { Job } from "bullmq";
import { createWorker } from "queue"; // Shared queue connection
import { prismaClient } from "db"; // Shared DB connection
import AWS from "aws-sdk";
import * as csv from "csv-parser"; // CSV parser library
import { Readable } from "stream";
import { imageProcessingQueue } from "queue";
import { RequestStatus } from "@prisma/client";
import type { GetObjectRequest } from "aws-sdk/clients/s3";

// Initialize AWS S3 client
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME || "";

const processCsv = async (job: Job) => {
  const { requestId, csvFile } = job.data;

  try {
    const arr = csvFile.split(`/${S3_BUCKET_NAME}`);

    const s3Params: GetObjectRequest = {
      Bucket: S3_BUCKET_NAME,
      Key: arr[1],
    };
    const s3Object = await s3.getObject(s3Params).promise();
    const csvData: { productId: string; inputUrl: string }[] = [];
    const readableStream = Readable.from(s3Object.Body as Buffer);

    readableStream
      .pipe(csv())
      .on("data", (row: { productId: string; inputUrl: string }) =>
        csvData.push(row)
      )
      .on("end", async () => {
        await prismaClient.request.update({
          where: { requestId },
          data: { status: RequestStatus.EXTRACTION_COMPLETED },
        });

        for (const row of csvData) {
          const { productId, inputUrl } = row;

          const existingImage = await prismaClient.image.findUnique({
            where: { inputUrl },
          });

          let imageId: string;

          if (existingImage) {
            imageId = existingImage.id;
          } else {
            const newImage = await prismaClient.image.create({
              data: { inputUrl, status: "PENDING", outputUrl: "" },
            });

            imageId = newImage.id;
            await imageProcessingQueue.add("process-image", {
              imageId,
              inputUrl,
            });
          }
          await prismaClient.product.create({
            data: {
              requestId,
              productId,
            },
          });
          await prismaClient.productImageMapping.create({
            data: {
              productId,
              imageId,
            },
          });
        }

        // Update the status of the request
        await prismaClient.request.update({
          where: { requestId },
          data: { status: RequestStatus.IMAGE_PROCESSING_IN_PROGRESS },
        });
      });
  } catch (error) {
    await prismaClient.request.update({
      where: { requestId },
      data: { status: "FAILED" },
    });
  }
};

// Create the worker to listen for jobs in the queue
const worker = createWorker("csv-processing-queue", processCsv);

worker.on("completed", (job: Job) => {
  console.log(`Job ${job.id} completed successfully`);
});

worker.on("failed", (job: any, err: any) => {
  console.error(`Job ${job.id} failed with error: ${err.message}`);
});

worker.on("error", (err: any) => {
  console.error(`Worker error: ${err.message}`);
});
