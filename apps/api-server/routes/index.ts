import { Router } from "express";
import { userRouter } from "./v1";

export const router: Router = Router();

router.use("/v1", userRouter);
