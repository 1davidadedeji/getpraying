import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  hashPassword,
  verifyPassword,
  createSession,
  deleteSession,
  getToken,
  requireAuth,
} from "../lib/auth";

const router: IRouter = Router();

router.post("/auth/register", async (req, res): Promise<void> => {
  const { email, username, password, displayName } = req.body;
  if (!email || !username || !password) {
    res.status(400).json({ error: "Email, username, and password are required" });
    return;
  }

  const [existingEmail] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existingEmail) {
    res.status(400).json({ error: "Email already registered" });
    return;
  }

  const [existingUsername] = await db.select().from(usersTable).where(eq(usersTable.username, username));
  if (existingUsername) {
    res.status(400).json({ error: "Username already taken" });
    return;
  }

  const passwordHash = await hashPassword(password);
  const [user] = await db
    .insert(usersTable)
    .values({
      email,
      username,
      displayName: displayName ?? null,
      passwordHash,
      isAdmin: false,
      isBanned: false,
      preferredCategories: [],
      onboardingComplete: false,
    })
    .returning();

  const token = await createSession(user.id);
  res.cookie("session", token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
  res.setHeader("Authorization", `Bearer ${token}`);
  res.status(201).json({
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      isAdmin: user.isAdmin,
      isBanned: user.isBanned,
      preferredCategories: user.preferredCategories,
      onboardingComplete: user.onboardingComplete,
      prayersShared: user.prayersShared,
      prayedFor: user.prayedFor,
      savedScrolls: user.savedScrolls,
      createdAt: user.createdAt,
    },
    message: "Registration successful",
    token,
  });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  if (user.isBanned) {
    res.status(403).json({ error: "Account is banned" });
    return;
  }

  const token = await createSession(user.id);
  res.cookie("session", token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
  res.setHeader("Authorization", `Bearer ${token}`);
  res.json({
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      isAdmin: user.isAdmin,
      isBanned: user.isBanned,
      preferredCategories: user.preferredCategories,
      onboardingComplete: user.onboardingComplete,
      prayersShared: user.prayersShared,
      prayedFor: user.prayedFor,
      savedScrolls: user.savedScrolls,
      createdAt: user.createdAt,
    },
    message: "Login successful",
    token,
  });
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  const token = getToken(req);
  if (token) {
    await deleteSession(token);
  }
  res.clearCookie("session");
  res.json({ success: true, message: "Logged out" });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).user;
  res.json({
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    isAdmin: user.isAdmin,
    isBanned: user.isBanned,
    preferredCategories: user.preferredCategories,
    onboardingComplete: user.onboardingComplete,
    prayersShared: user.prayersShared,
    prayedFor: user.prayedFor,
    savedScrolls: user.savedScrolls,
    createdAt: user.createdAt,
  });
});

router.post("/auth/preferences", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const { categories } = req.body;
  if (!Array.isArray(categories)) {
    res.status(400).json({ error: "categories must be an array" });
    return;
  }

  await db
    .update(usersTable)
    .set({ preferredCategories: categories, onboardingComplete: true })
    .where(eq(usersTable.id, user.id));

  res.json({ success: true, message: "Preferences saved" });
});

export default router;
