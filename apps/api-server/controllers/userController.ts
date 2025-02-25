import type { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { prismaClient } from "db";
import { csvProcessingQueue } from "queue";
import { uploadFileToS3 } from "../utils/awsS3";
import { RequestStatus } from "@prisma/client";
import fs from "fs";

export const uploadFile = async (req: Request, res: Response) => {
  try {
    const file: Express.Multer.File | undefined = req.file;
    if (!file) {
      throw new Error("File is Required");
    }
    const requestId: string = uuidv4();
    const key = `${requestId}/${file.filename.replace(/\s+/g, "")}`;

    try {
      // Upload the file to S3
      const s3url: string | undefined = await uploadFileToS3(file.path, key);
      console.log(s3url);

      if (!s3url) throw new Error("Unable to upload file to S3");
      fs.unlinkSync(file.path);
      const data = await prismaClient.request.create({
        data: {
          csvFile: s3url,
          requestId: requestId,
          status: RequestStatus.EXTRACTION_IN_PROGRESS,
        },
      });

      if (!data) {
        throw new Error("Internal server error. Please try again later");
      }
      const queue = await csvProcessingQueue.add("csv_extraction", {
        csvFile: s3url,
        requestId: requestId,
      });

      if (!queue) {
        throw new Error("Job is not queued to csv_extraction");
      }

      res.status(200).json({
        message:
          "CSV File uploaded. You can use this requestId to check the status.",
        requestId: requestId,
      });
    } catch (error: any) {
      if (file && file.path) {
        fs.unlinkSync(file.path);
      }
      throw error;
    }
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};
export const getFileStatus = async (req: Request, res: Response) => {
  try {
    const requestId: string = req.query.requestId as string;
    if (!requestId) throw new Error("Request is needed");

    const data = await prismaClient.request.findUnique({
      where: { requestId: requestId },
    });

    if (!data) {
      throw new Error("Invalid RequestID");
    }
    res.status(200).json({
      message: "Status fetched successfully",
      data: { status: data.status, requestId: data.requestId },
    });
  } catch (error: any) {
    res.status(error.statusCode).json({ message: error.message });
  }
};
