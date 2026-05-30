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
 * Server-side trial gate. During the 7-day trial and for admins/moderators all
 * traffic passes. Once the trial expires, subscription enforcement is handled
 * client-side via RevenueCat entitlement checks. This middleware acts as a
 * fallback safeguard — when RevenueCat is fully wired, extend this to verify
 * the subscription receipt server-side.
 */
export async function requirePremiumSubscription(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const user = (req as any).user;
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (user.role === "admin" || user.role === "moderator") {
    next();
    return;
  }
  const trialStart = user.trialStartsAt ? new Date(user.trialStartsAt).getTime() : null;
  const trialActive = trialStart != null && Date.now() - trialStart < 7 * 24 * 60 * 60 * 1000;
  if (trialActive) {
    next();
    return;
  }

  const enforce = process.env.API_ENFORCE_SUBSCRIPTION_AFTER_TRIAL === "true";
  if (!enforce) {
    next();
    return;
  }

  const tier = String(user.subscription ?? "").toLowerCase();
  const subscribed = ["active", "premium", "paid", "subscribed", "pro", "plus"].includes(tier);
  if (subscribed) {
    next();
    return;
  }

  res.status(402).json({
    error: "An active subscription is required to use this feature.",
    code: "SUBSCRIPTION_REQUIRED",
  });
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

