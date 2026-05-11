import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { existsSync, mkdirSync } from "fs";
import path from "path";
import router from "./routes";
import { logger } from "./lib/logger";
import { getUploadDir } from "./routes/uploads";

const app: Express = express();

const uploadDir = getUploadDir();
if (!existsSync(uploadDir)) {
  mkdirSync(uploadDir, { recursive: true });
}
app.use("/api/static/uploads", express.static(uploadDir));

// Serve seed audio files for development/demo official guides
const seedAudioDir = path.join(process.cwd(), "data", "seed-audio");
if (existsSync(seedAudioDir)) {
  app.use("/api/static/seed-audio", express.static(seedAudioDir));
}

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
app.use(express.json({ limit: "512kb" }));
app.use(express.urlencoded({ extended: true, limit: "512kb" }));

app.use("/api", router);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (res.headersSent) return;
  const anyErr = err as { status?: number; statusCode?: number; type?: string };
  if (
    anyErr?.status === 413 ||
    anyErr?.statusCode === 413 ||
    anyErr?.type === "entity.too.large"
  ) {
    res.status(413).json({
      error: "Request is too large. Shorten your text or attachments and try again.",
    });
    return;
  }
  logger.error({ err }, "Unhandled error");
  const detail = err instanceof Error ? err.message : String(err);
  res.status(500).json({
    error: "Something went wrong",
    ...(process.env.NODE_ENV !== "production" ? { detail } : {}),
  });
});

export default app;
