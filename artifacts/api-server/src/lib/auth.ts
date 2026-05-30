import bcryptjs from "bcryptjs";
import crypto from "crypto";
import { db, usersTable, sessionsTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import type { Request, Response, NextFunction } from "express";

export async function hashPassword(password: string): Promise<string> {
  return bcryptjs.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcryptjs.compare(password, hash);
}

export async function createSession(userId: number): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  await db.insert(sessionsTable).values({ userId, token, expiresAt });
  return token;
}

export async function getSessionUser(token: string) {
  if (!token) return null;

  const now = new Date();
  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(and(eq(sessionsTable.token, token), gt(sessionsTable.expiresAt, now)));

  if (!session) return null;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, session.userId));
  if (!user) return null;
  const { passwordHash: _, ...safeUser } = user;
  return safeUser;
}

export async function deleteSession(token: string): Promise<void> {
  await db.delete(sessionsTable).where(eq(sessionsTable.token, token));
}

export function getToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    return auth.slice(7);
  }
  const cookie = req.cookies?.["session"];
  return cookie ?? null;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = getToken(req);
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const user = await getSessionUser(token);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (user.isBanned) {
    res.status(403).json({ error: "Account is banned" });
    return;
  }

  (req as any).user = user;
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = getToken(req);
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const user = await getSessionUser(token);
  if (!user) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  if (user.isBanned) {
    res.status(403).json({ error: "Account is banned" });
    return;
  }

  if (user.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  (req as any).user = user;
  next();
}

/** Approve / decline pending posts (moderators + admins). */
export async function requireModeratorOrAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = getToken(req);
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const user = await getSessionUser(token);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (user.isBanned) {
    res.status(403).json({ error: "Account is banned" });
    return;
  }

  if (user.role !== "admin" && user.role !== "moderator") {
    res.status(403).json({ error: "Moderator or admin access required" });
    return;
  }

  (req as any).user = user;
  next();
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = getToken(req);
  if (token) {
    const user = await getSessionUser(token);
    if (user && !user.isBanned) {
      (req as any).user = user;
    }
  }
  next();
}

/**
 * Paying subscriber — used for automatic post boosts.
 * Only explicit paid tier (`premium`) or admins qualify; trial/free never boost.
 */
export function userIsPayingSubscriber(user: {
  role?: string;
  trialStartsAt?: Date | string | null;
  subscription?: string | null;
}): boolean {
  if (user.role === "admin") return true;
  return String(user.subscription ?? "").toLowerCase() === "premium";
}

/** @deprecated Use userIsPayingSubscriber — trial no longer grants boost. */
export function userCanUsePremiumBoost(user: {
  role: string;
  trialStartsAt: Date | string | null;
  subscription?: string | null;
}): boolean {
  return userIsPayingSubscriber(user);
}

