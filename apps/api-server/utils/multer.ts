import multer from "multer";
import fs from "fs";

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./uploads");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const filename = `${uniqueSuffix} - ${file.originalname}`;
    cb(null, `${filename.replace(/\s+/g, "")}`);
  },
});

export const upload = multer({ storage: storage });
