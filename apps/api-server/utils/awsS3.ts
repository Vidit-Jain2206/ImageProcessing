import { PutObjectCommand, S3, S3Client } from "@aws-sdk/client-s3";
import fs from "fs";
import dotenv from "dotenv";
dotenv.config();

const S3_BUCKET = process.env.S3_BUCKET;
const BUCKET_URL = `${process.env.BUCKET_URL}${S3_BUCKET}`;
const REGION = process.env.REGION;
const ACCESS_KEY = process.env.ACCESS_KEY;
const SECRET_ACCESS_KEY = process.env.SECRET_ACCESS_KEY;
const client = new S3Client({
  credentials: {
    accessKeyId: ACCESS_KEY || "",
    secretAccessKey: SECRET_ACCESS_KEY || "",
  },
  region: REGION,
});

export const uploadFileToS3 = async (
  filepath: string,
  key: string
): Promise<string | undefined> => {
  try {
    console.log(filepath);
    console.log(S3_BUCKET);
    const stream = fs.createReadStream(filepath);
    const command = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Body: stream,
      Key: key,
      ContentType: "text/csv",
    });
    const response = await client.send(command);

    console.log("Uploaded successfully", response);
    return `${BUCKET_URL}/${key}`;
  } catch (error) {
    throw new Error("Failed to upload");
  }
};
