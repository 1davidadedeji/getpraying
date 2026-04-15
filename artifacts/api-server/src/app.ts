import express, { type Express, type Request, type Response, type NextFunction } from "express";
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

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (res.headersSent) return;
  logger.error({ err }, "Unhandled error");
  const detail = err instanceof Error ? err.message : String(err);
  res.status(500).json({
    error: "Something went wrong",
    ...(process.env.NODE_ENV !== "production" ? { detail } : {}),
  });
});

export default app;
