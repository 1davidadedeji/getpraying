import { Router, type IRouter } from "express";
import multer from "multer";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import type { Request, Response, NextFunction } from "express";
import { requireAuth } from "../lib/auth";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

/** Post images: PRD max 1MB */
const MAX_POST_IMAGE_BYTES = 1 * 1024 * 1024;
const MAX_AVATAR_IMAGE_BYTES = 2 * 1024 * 1024;
/** Short clips only; duration validated separately */
const MAX_VIDEO_BYTES = 12 * 1024 * 1024;
const MAX_AUDIO_BYTES = 15 * 1024 * 1024;
const MAX_VIDEO_DURATION_SEC = 10;

export function getUploadDir(): string {
  return process.env.UPLOAD_DIR ?? path.join(process.cwd(), "data", "uploads");
}

const uploadPostImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_POST_IMAGE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!/^image\/(jpeg|jpg|png|webp)$/i.test(file.mimetype)) {
      cb(new Error("Only JPEG, PNG, or WebP images are allowed"));
      return;
    }
    cb(null, true);
  },
});

const uploadAvatarImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AVATAR_IMAGE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!/^image\/(jpeg|jpg|png|webp)$/i.test(file.mimetype)) {
      cb(new Error("Only JPEG, PNG, or WebP images are allowed"));
      return;
    }
    cb(null, true);
  },
});

const uploadVideo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_VIDEO_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!/^video\/(mp4|quicktime|webm)$/i.test(file.mimetype)) {
      cb(new Error("Only MP4, MOV, or WebM video is allowed (max 12MB, 10s)"));
      return;
    }
    cb(null, true);
  },
});

const uploadAudio = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AUDIO_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!/^audio\/(mpeg|mp3|wav|x-wav|aac|x-m4a|mp4|webm|ogg)$/i.test(file.mimetype)) {
      cb(new Error("Only common audio formats are allowed (max 15MB)"));
      return;
    }
    cb(null, true);
  },
});

function handleMulterError(
  upload: ReturnType<multer.Multer["single"]>,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  upload(req, res, (err: unknown) => {
    if (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      res.status(400).json({ error: msg });
      return;
    }
    next();
  });
}

const router: IRouter = Router();

router.post(
  "/uploads/post-image",
  requireAuth,
  (req, res, next) => handleMulterError(uploadPostImage.single("file"), req, res, next),
  async (req, res): Promise<void> => {
    const file = (req as any).file as { buffer: Buffer; mimetype: string } | undefined;
    if (!file?.buffer?.length) {
      res.status(400).json({ error: "No image file provided" });
      return;
    }

    const dir = getUploadDir();
    await mkdir(dir, { recursive: true });

    const ext =
      file.mimetype === "image/png"
        ? "png"
        : file.mimetype === "image/webp"
          ? "webp"
          : "jpg";
    const filename = `${randomUUID()}.${ext}`;
    await writeFile(path.join(dir, filename), file.buffer);

    res.status(201).json({ url: `/api/static/uploads/${filename}`, mediaType: "image" });
  },
);

router.post(
  "/uploads/avatar",
  requireAuth,
  (req, res, next) => handleMulterError(uploadAvatarImage.single("file"), req, res, next),
  async (req, res): Promise<void> => {
    const file = (req as any).file as { buffer: Buffer; mimetype: string } | undefined;
    if (!file?.buffer?.length) {
      res.status(400).json({ error: "No image file provided" });
      return;
    }

    const dir = getUploadDir();
    await mkdir(dir, { recursive: true });

    const ext =
      file.mimetype === "image/png"
        ? "png"
        : file.mimetype === "image/webp"
          ? "webp"
          : "jpg";
    const filename = `avatar-${randomUUID()}.${ext}`;
    await writeFile(path.join(dir, filename), file.buffer);

    const avatarUrl = `/api/static/uploads/${filename}`;
    const user = (req as any).user;
    await db.update(usersTable).set({ avatarUrl }).where(eq(usersTable.id, user.id));

    res.status(201).json({ avatarUrl });
  },
);

router.post(
  "/uploads/post-video",
  requireAuth,
  (req, res, next) => handleMulterError(uploadVideo.single("file"), req, res, next),
  async (req, res): Promise<void> => {
    const file = (req as any).file as { buffer: Buffer; mimetype: string } | undefined;
    if (!file?.buffer?.length) {
      res.status(400).json({ error: "No video file provided" });
      return;
    }

    const rawDur = (req as any).body?.durationSec ?? (req as any).body?.duration;
    const durationSec = typeof rawDur === "string" ? parseFloat(rawDur) : Number(rawDur);
    if (!Number.isFinite(durationSec) || durationSec <= 0 || durationSec > MAX_VIDEO_DURATION_SEC) {
      res.status(400).json({
        error: `Video must be ${MAX_VIDEO_DURATION_SEC} seconds or less. Adjust the clip length and try again.`,
      });
      return;
    }

    const dir = getUploadDir();
    await mkdir(dir, { recursive: true });

    const ext =
      file.mimetype === "video/webm" ? "webm" : file.mimetype === "video/quicktime" ? "mov" : "mp4";
    const filename = `${randomUUID()}.${ext}`;
    await writeFile(path.join(dir, filename), file.buffer);

    res.status(201).json({ url: `/api/static/uploads/${filename}`, mediaType: "video" });
  },
);

router.post(
  "/uploads/post-audio",
  requireAuth,
  (req, res, next) => handleMulterError(uploadAudio.single("file"), req, res, next),
  async (req, res): Promise<void> => {
    const file = (req as any).file as { buffer: Buffer; mimetype: string } | undefined;
    if (!file?.buffer?.length) {
      res.status(400).json({ error: "No audio file provided" });
      return;
    }

    const dir = getUploadDir();
    await mkdir(dir, { recursive: true });

    let ext = "m4a";
    if (file.mimetype.includes("mpeg") || file.mimetype.includes("mp3")) ext = "mp3";
    else if (file.mimetype.includes("wav")) ext = "wav";
    else if (file.mimetype.includes("ogg")) ext = "ogg";
    else if (file.mimetype.includes("webm")) ext = "webm";

    const filename = `${randomUUID()}.${ext}`;
    await writeFile(path.join(dir, filename), file.buffer);

    res.status(201).json({ url: `/api/static/uploads/${filename}`, mediaType: "audio" });
  },
);

export default router;
