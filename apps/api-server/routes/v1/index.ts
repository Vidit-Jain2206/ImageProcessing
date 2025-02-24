import { Router } from "express";
import { getFileStatus, uploadFile } from "../../controllers/userController";
import { upload } from "../../utils/multer";

export const userRouter: Router = Router();

userRouter.post("/", upload.single("csv_file"), uploadFile);
userRouter.get("/status", getFileStatus);
