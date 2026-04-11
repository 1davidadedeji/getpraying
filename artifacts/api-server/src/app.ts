import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { existsSync, mkdirSync } from "fs";
import router from "./routes";
import { logger } from "./lib/logger";
import { getUploadDir } from "./routes/uploads";

const app: Express = express();

const uploadDir = getUploadDir();
if (!existsSync(uploadDir)) {
  mkdirSync(uploadDir, { recursive: true });
}
app.use("/api/static/uploads", express.static(uploadDir));

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({ credentials: true, origin: true }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
