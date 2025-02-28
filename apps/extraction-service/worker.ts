import { Job } from "bullmq";
import { createWorker } from "queue"; // Shared queue connection
import { prismaClient } from "db"; // Shared DB connection
import AWS from "aws-sdk";
import csv from "csv-parser"; // CSV parser library
import { Readable } from "stream";
import { imageProcessingQueue } from "queue";
import { ImageStatus, RequestStatus } from "@prisma/client";
import dotenv from "dotenv";
dotenv.config();
import axios from "axios";

// Initialize AWS S3 client
const s3 = new AWS.S3({
  accessKeyId: process.env.ACCESS_KEY,
  secretAccessKey: process.env.SECRET_ACCESS_KEY,
  region: process.env.REGION,
});

const S3_BUCKET_NAME = process.env.S3_BUCKET || "";
const BUCKET_URL = `${process.env.BUCKET_URL}${S3_BUCKET_NAME}`;

const processCsv = async (job: Job) => {
  console.log(`Job Started...`);
  const { requestId, csvFile } = job.data;
  try {
    const arr = csvFile.split(`${BUCKET_URL}/`);
    const signedUrl = await s3.getSignedUrlPromise("getObject", {
      Bucket: S3_BUCKET_NAME,
      Key: arr[1],
      Expires: 300, // URL expires in 5 minutes
    });
    const response = await axios.get(signedUrl, {
      responseType: "arraybuffer",
    });
    const csvBuffer = Buffer.from(response.data);

    const csvData: { productId: string; inputFile: string }[] = [];
    let lastProductId = "";
    const readableStream = Readable.from(csvBuffer)
      .pipe(csv())
      .on("data", (row: { productId: string; inputFile: string }) => {
        let productId = row.productId;
        const inputFile = row.inputFile;
        if (productId !== "") lastProductId = productId;
        if (productId === "") {
          productId = lastProductId;
        }
        csvData.push({ productId, inputFile: inputFile });
      })
      .on("end", async () => {
        await prismaClient.request.update({
          where: { requestId },
          data: { status: RequestStatus.EXTRACTION_COMPLETED },
        });

        let imagesToBeAdded = [];

        for (const row of csvData) {
          const { productId, inputFile } = row;
          console.log("proceesing for", productId);
          const existingProduct = await prismaClient.product.findUnique({
            where: {
              productId: productId,
            },
          });
          console.log(productId, existingProduct);
          if (!existingProduct) {
            await prismaClient.product.create({
              data: {
                productId,
              },
            });
          }

          const existingProductrequesTMapping =
            await prismaClient.productRequestMapping.findFirst({
              where: {
                requestId,
                productId,
              },
            });

          if (!existingProductrequesTMapping) {
            await prismaClient.productRequestMapping.create({
              data: {
                requestId,
                productId,
              },
            });
          }

          const existingImage = await prismaClient.image.findUnique({
            where: { inputUrl: inputFile },
          });

          let imageId: string;

          if (existingImage) {
            imageId = existingImage.id;
          } else {
            const newImage = await prismaClient.image.create({
              data: {
                inputUrl: inputFile,
                status: ImageStatus.PENDING,
                outputUrl: "",
              },
            });

            imageId = newImage.id;
            imagesToBeAdded.push({
              imageId,
              inputUrl: inputFile,
              requestId,
              productId,
            });
          }

          await prismaClient.productImageMapping.create({
            data: {
              requestId: requestId,
              productId: productId,
              imageId: imageId,
            },
          });
        }

        if (imagesToBeAdded.length === 0) {
          await prismaClient.request.update({
            where: { requestId },
            data: { status: RequestStatus.IMAGE_PROCESSING_COMPLETED },
          });
          return;
        }

        const imagePromises = imagesToBeAdded.map((imageData) =>
          imageProcessingQueue.add("process-image", imageData)
        );

        await Promise.all(imagePromises);

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
