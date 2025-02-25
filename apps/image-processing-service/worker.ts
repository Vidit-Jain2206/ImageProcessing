import { Worker, Job } from "bullmq";
import { prismaClient } from "db";
import axios from "axios";
import sharp from "sharp";
import AWS from "aws-sdk";
import { ImageStatus, RequestStatus } from "@prisma/client";
import { createWorker } from "queue";

const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME || "";
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

// Function to process image
const processImage = async (job: Job) => {
  const { imageId, imageUrl, requestId, productId } = job.data;
  await prismaClient.request.update({
    where: { requestId: requestId },
    data: { status: RequestStatus.IMAGE_PROCESSING_IN_PROGRESS },
  });
  try {
    console.log(`Processing image: ${imageUrl}`);

    const response = await axios.get(imageUrl, { responseType: "arraybuffer" });
    const buffer = Buffer.from(response.data);

    const processedBuffer = await sharp(buffer)
      .resize(500, 500)
      .jpeg({ quality: 80 })
      .toBuffer();

    const key = `${imageId}/processed_output.jpeg`;

    await s3
      .upload({
        Bucket: S3_BUCKET_NAME,
        Key: key,
        Body: processedBuffer,
        ContentType: "image/jpeg",
      })
      .promise();

    await prismaClient.image.update({
      where: { id: imageId },
      data: { status: ImageStatus.PROCESSED, outputUrl: key },
    });

    console.log(`Image ${imageId} processed successfully.`);

    await checkRequestCompletion(requestId, productId);
  } catch (error: any) {
    console.error(`Error processing image ${imageId}: ${error.message}`);

    await prismaClient.image.update({
      where: { id: imageId },
      data: { status: "FAILED" },
    });
  }
};

const checkRequestCompletion = async (requestId: string, productId: string) => {
  const totalImages = await prismaClient.productImageMapping.count({
    where: { productId },
  });

  const processedImages = await prismaClient.productImageMapping.count({
    where: {
      productId,
      image: { status: ImageStatus.PROCESSED },
    },
  });

  await prismaClient.request.update({
    where: { id: requestId },
    data: { processedImages },
  });
  if (processedImages === totalImages) {
    await prismaClient.request.update({
      where: { id: requestId },
      data: { status: RequestStatus.IMAGE_PROCESSING_COMPLETED },
    });
    console.log(`Request ${requestId} is COMPLETED.`);
  }
};

const worker = createWorker("image-processing-queue", processImage);

worker.on("completed", (job: Job) => {
  console.log(`Job ${job.id} completed successfully`);
});

worker.on("failed", (job: any, err: Error) => {
  console.error(`Job ${job.id} failed with error: ${err.message}`);
});

worker.on("error", (err: any) => {
  console.error(`Worker error: ${err.message}`);
});
