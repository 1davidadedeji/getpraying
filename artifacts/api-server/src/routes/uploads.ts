import { Router, type IRouter } from "express";
import multer from "multer";
import { randomUUID } from "crypto";
import { mkdirSync } from "fs";
import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";
import type { Request, Response, NextFunction } from "express";
import { requireAuth, requireModeratorOrAdmin } from "../lib/auth";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

/** Post images: PRD max 1MB */
const MAX_POST_IMAGE_BYTES = 1 * 1024 * 1024;
const MAX_AVATAR_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const MAX_AUDIO_BYTES = 15 * 1024 * 1024;

export function getUploadDir(): string {
  return process.env.UPLOAD_DIR ?? path.join(process.cwd(), "data", "uploads");
}

function ensureUploadDirSync(): string {
  const dir = getUploadDir();
  mkdirSync(dir, { recursive: true });
  return dir;
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

/** Stream large media to disk to avoid holding full file in server RAM. */
function isAllowedVideoUpload(mimetype: string, originalname: string): boolean {
  const mt = mimetype.toLowerCase();
  if (/^video\//i.test(mt)) return true;
  const name = originalname.toLowerCase();
  if (/\.(mp4|mov|m4v|webm|3gp|3gpp)$/i.test(name)) return true;
  if (mt === "application/octet-stream" && /\.(mp4|mov|m4v|webm|3gp|3gpp)$/i.test(name)) return true;
  return false;
}

function videoExtension(mimetype: string, originalname: string): string {
  const mt = mimetype.toLowerCase();
  const name = originalname.toLowerCase();
  if (mt.includes("webm") || name.endsWith(".webm")) return "webm";
  if (mt.includes("quicktime") || name.endsWith(".mov")) return "mov";
  if (mt.includes("3gpp") || name.endsWith(".3gp") || name.endsWith(".3gpp")) return "3gp";
  return "mp4";
}

const uploadVideo = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      try {
        cb(null, ensureUploadDirSync());
      } catch (e) {
        cb(e as Error, getUploadDir());
      }
    },
    filename: (_req, file, cb) => {
      cb(null, `${randomUUID()}.${videoExtension(file.mimetype, file.originalname ?? "")}`);
    },
  }),
  limits: { fileSize: MAX_VIDEO_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!isAllowedVideoUpload(file.mimetype, file.originalname ?? "")) {
      cb(new Error("That video format isn't supported. Try an MP4 or MOV file."));
      return;
    }
    cb(null, true);
  },
});

function audioUploadFilename(
  _req: Request,
  file: Express.Multer.File,
  cb: (error: Error | null, filename: string) => void,
) {
  let ext = "m4a";
  const mt = file.mimetype.toLowerCase();
  const on = (file.originalname ?? "").toLowerCase();
  if (mt.includes("mpeg") || mt.includes("mp3") || on.endsWith(".mp3")) ext = "mp3";
  else if (mt.includes("wav") || on.endsWith(".wav")) ext = "wav";
  else if (mt.includes("ogg") || on.endsWith(".ogg")) ext = "ogg";
  else if (mt.includes("webm") || on.endsWith(".webm")) ext = "webm";
  else if (mt.includes("flac") || on.endsWith(".flac")) ext = "flac";
  else if (mt.includes("caf") || on.endsWith(".caf")) ext = "caf";
  cb(null, `${randomUUID()}.${ext}`);
}

function audioUploadFileFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) {
  const mt = file.mimetype.toLowerCase();
  if (/^audio\//i.test(mt)) {
    cb(null, true);
    return;
  }
  const name = file.originalname?.toLowerCase() ?? "";
  if (/\.(mp3|m4a|aac|wav|ogg|webm|flac|caf|3gp|3gpp|amr|wma)$/i.test(name)) {
    cb(null, true);
    return;
  }
  if (mt === "application/octet-stream" && /\.(mp3|m4a|aac|wav|ogg|webm|flac|caf|3gp|3gpp|amr|wma)$/i.test(name)) {
    cb(null, true);
    return;
  }
  cb(new Error("That audio format isn't supported. Try an MP3, M4A, or WAV file."));
}

const audioDiskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    try {
      cb(null, ensureUploadDirSync());
    } catch (e) {
      cb(e as Error, getUploadDir());
    }
  },
  filename: audioUploadFilename,
});

const uploadAudio = multer({
  storage: audioDiskStorage,
  limits: { fileSize: MAX_AUDIO_BYTES },
  fileFilter: audioUploadFileFilter,
});

/** Web admin CMS uploads — no app-level size cap (reverse proxy may still enforce its own limit). */
const uploadAdminAudio = multer({
  storage: audioDiskStorage,
  fileFilter: audioUploadFileFilter,
});

function isLimitFileSize(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: string }).code === "LIMIT_FILE_SIZE"
  );
}

/** Optional friendly message for 413 when file exceeds route limit. */
function handleMulterError(
  upload: ReturnType<multer.Multer["single"]>,
  req: Request,
  res: Response,
  next: NextFunction,
  fileTooLargeMessage?: string,
): void {
  upload(req, res, (err: unknown) => {
    if (err) {
      if (isLimitFileSize(err)) {
        res.status(413).json({
          error:
            fileTooLargeMessage ??
            "That file is too large. Try a smaller or shorter file.",
        });
        return;
      }
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
  (req, res, next) =>
    handleMulterError(
      uploadPostImage.single("file"),
      req,
      res,
      next,
      "Photo is too large. Try a different image.",
    ),
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
  (req, res, next) =>
    handleMulterError(
      uploadAvatarImage.single("file"),
      req,
      res,
      next,
      "Profile photo is too large. Choose a smaller image.",
    ),
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
  (req, res, next) =>
    handleMulterError(
      uploadVideo.single("file"),
      req,
      res,
      next,
      "Video is too large. Keep files under the upload size limit.",
    ),
  async (req, res): Promise<void> => {
    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file?.path?.length) {
      res.status(400).json({ error: "No video file provided" });
      return;
    }

    const filename = file.filename;
    if (!filename) {
      await unlink(file.path).catch(() => {});
      res.status(500).json({ error: "Upload could not be finalized." });
      return;
    }

    res.status(201).json({ url: `/api/static/uploads/${filename}`, mediaType: "video" });
  },
);

async function finalizeDiskAudioUpload(req: Request, res: Response): Promise<void> {
  const file = (req as any).file as Express.Multer.File | undefined;
  if (!file?.path?.length) {
    res.status(400).json({ error: "No audio file provided" });
    return;
  }

  const filename = file.filename;
  if (!filename) {
    await unlink(file.path).catch(() => {});
    res.status(500).json({ error: "Upload could not be finalized." });
    return;
  }

  res.status(201).json({ url: `/api/static/uploads/${filename}`, mediaType: "audio" });
}

router.post(
  "/uploads/post-audio",
  requireAuth,
  (req, res, next) =>
    handleMulterError(
      uploadAudio.single("file"),
      req,
      res,
      next,
      "Audio file is too large. Choose a shorter recording.",
    ),
  finalizeDiskAudioUpload,
);

router.post(
  "/uploads/admin-audio",
  requireModeratorOrAdmin,
  (req, res, next) =>
    handleMulterError(
      uploadAdminAudio.single("file"),
      req,
      res,
      next,
      "Audio file is too large for the server upload limit.",
    ),
  finalizeDiskAudioUpload,
);

export default router;
