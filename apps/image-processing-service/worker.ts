import { Worker, Job } from "bullmq";
import { prismaClient } from "db";
import axios from "axios";
import sharp from "sharp";
import AWS from "aws-sdk";
import { ImageStatus, RequestStatus } from "@prisma/client";
import { createWorker } from "queue";
import dotenv from "dotenv";
dotenv.config();
const S3_BUCKET_NAME = process.env.S3_BUCKET || "";
const s3 = new AWS.S3({
  accessKeyId: process.env.ACCESS_KEY,
  secretAccessKey: process.env.SECRET_ACCESS_KEY,
  region: process.env.REGION,
});

// Function to process image
const processImage = async (job: Job) => {
  let { imageId, inputUrl, requestId, productId } = job.data;

  try {
    inputUrl = "https://jpeg.org/images/jpeg-home.jpg";
    console.log(`Processing image: ${inputUrl}`);

    const response = await axios.get(inputUrl, { responseType: "arraybuffer" });
    const buffer = Buffer.from(response.data);

    const processedBuffer = await sharp(buffer)
      .resize(500, 500)
      .jpeg({ quality: 80 })
      .toBuffer();

    const outputKey = `images/${imageId}/processed_output.jpeg`;

    await s3
      .upload({
        Bucket: S3_BUCKET_NAME,
        Key: outputKey,
        Body: processedBuffer,
        ContentType: "image/jpg",
      })
      .promise();

    await prismaClient.image.update({
      where: { id: imageId },
      data: { status: ImageStatus.PROCESSED, outputUrl: outputKey },
    });

    console.log(`Image ${imageId} processed successfully.`);

    await checkRequestCompletion(requestId, imageId);
  } catch (error: any) {
    console.error(`Error processing image ${imageId}: ${error.message}`);

    await prismaClient.image.update({
      where: { id: imageId },
      data: { status: "FAILED" },
    });
  }
};

const checkRequestCompletion = async (requestId: string, imageId: string) => {
  const totalImages = await prismaClient.productImageMapping.findMany({
    where: { requestId: requestId },
    select: {
      image: true,
    },
  });
  console.log(totalImages);

  const processedImages = totalImages.filter(
    (image) => image.image.status === ImageStatus.PROCESSED
  );

  await prismaClient.request.update({
    where: { requestId: requestId },
    data: { processedImages: processedImages.length },
  });
  if (processedImages.length === totalImages.length) {
    await prismaClient.request.update({
      where: { requestId: requestId },
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
