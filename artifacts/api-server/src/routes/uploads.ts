import { Router, type IRouter } from "express";
import multer from "multer";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import type { Request, Response, NextFunction } from "express";
import { requireAuth, requireModeratorOrAdmin } from "../lib/auth";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_VIDEO_BYTES = 40 * 1024 * 1024;
const MAX_AUDIO_BYTES = 15 * 1024 * 1024;

export function getUploadDir(): string {
  return process.env.UPLOAD_DIR ?? path.join(process.cwd(), "data", "uploads");
}

const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES },
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
      cb(new Error("Only MP4, MOV, or WebM video is allowed (max 40MB)"));
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
  upload: ReturnType<typeof multer.single>,
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
  (req, res, next) => handleMulterError(uploadImage.single("file"), req, res, next),
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
  "/uploads/post-video",
  requireModeratorOrAdmin,
  (req, res, next) => handleMulterError(uploadVideo.single("file"), req, res, next),
  async (req, res): Promise<void> => {
    const file = (req as any).file as { buffer: Buffer; mimetype: string } | undefined;
    if (!file?.buffer?.length) {
      res.status(400).json({ error: "No video file provided" });
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
  requireModeratorOrAdmin,
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
