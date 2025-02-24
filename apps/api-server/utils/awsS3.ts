import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const client = new S3Client({
  credentials: {
    accessKeyId: "",
    secretAccessKey: "",
  },
  region: "",
});

const BUKCET_URL = "";

export const uploadFileToS3 = async (
  file: Buffer,
  key: string
): Promise<string | undefined> => {
  try {
    const command = new PutObjectCommand({
      Bucket: "",
      Body: file,
      Key: key,
      ContentType: "csv",
    });
    await client.send(command);
    return `${BUKCET_URL}/${key}`;
  } catch (error) {}
};
