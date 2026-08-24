import { Router, type IRouter } from "express";
import path from "node:path";
import { existsSync } from "node:fs";
import { getUploadDir } from "./uploads";
import { verifySignedMediaToken } from "../lib/signedMediaUrl";

const router: IRouter = Router();

function resolveSignedMediaFile(storagePath: string): string | null {
  const uploadDir = getUploadDir();
  if (storagePath.startsWith("seed-audio/")) {
    const rel = storagePath.slice("seed-audio/".length);
    const abs = path.resolve(process.cwd(), "data", "seed-audio", rel);
    const root = path.resolve(process.cwd(), "data", "seed-audio");
    if (!abs.startsWith(`${root}${path.sep}`) && abs !== root) return null;
    return existsSync(abs) ? abs : null;
  }

  const abs = path.resolve(uploadDir, storagePath);
  const root = path.resolve(uploadDir);
  if (!abs.startsWith(`${root}${path.sep}`) && abs !== root) return null;
  return existsSync(abs) ? abs : null;
}

router.get("/media/:token", (req, res): void => {
  const rawToken = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
  const verified = verifySignedMediaToken(rawToken ?? "");
  if (!verified) {
    res.status(403).json({ error: "Invalid or expired media link" });
    return;
  }

  const filePath = resolveSignedMediaFile(verified.storagePath);
  if (!filePath) {
    res.status(404).json({ error: "Media not found" });
    return;
  }

  res.sendFile(filePath);
});

export default router;
