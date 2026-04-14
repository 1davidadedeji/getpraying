import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import sendgrid from "@sendgrid/mail";
import {
  hashPassword,
  verifyPassword,
  createSession,
  deleteSession,
  getToken,
  requireAuth,
} from "../lib/auth";

const router: IRouter = Router();

const resendRateLimit = new Map<string, { count: number; nextAllowedAt: number }>();
const RESEND_COOLDOWNS_MS = [60_000, 120_000, 300_000, 600_000];

function checkResendRateLimit(email: string): { allowed: boolean; waitSecs: number } {
  const now = Date.now();
  const entry = resendRateLimit.get(email);
  if (!entry) return { allowed: true, waitSecs: 0 };
  if (now < entry.nextAllowedAt) {
    return { allowed: false, waitSecs: Math.ceil((entry.nextAllowedAt - now) / 1000) };
  }
  return { allowed: true, waitSecs: 0 };
}

function recordResend(email: string): void {
  const now = Date.now();
  const entry = resendRateLimit.get(email);
  const count = entry ? entry.count + 1 : 1;
  const cooldownMs = RESEND_COOLDOWNS_MS[Math.min(count - 1, RESEND_COOLDOWNS_MS.length - 1)] ?? 600_000;
  resendRateLimit.set(email, { count, nextAllowedAt: now + cooldownMs });
}

function createOtp(): string {
  const n = crypto.randomInt(0, 1_000_000);
  return String(n).padStart(6, "0");
}

function otpExpiresAt(minutes = 15): Date {
  return new Date(Date.now() + minutes * 60_000);
}

async function sendVerificationEmail(args: {
  to: string;
  otp: string;
  expiresAt: Date;
}): Promise<void> {
  const apiKey = process.env.SENDGRID_API_KEY;
  const from = process.env.SENDGRID_FROM_EMAIL;

  if (!apiKey || !from) {
    console.log(
      `[email-verification] OTP for ${args.to}: ${args.otp} (expires ${args.expiresAt.toISOString()})`,
    );
    return;
  }

  sendgrid.setApiKey(apiKey);

  const minutesLeft = Math.max(
    1,
    Math.round((args.expiresAt.getTime() - Date.now()) / 60_000),
  );

  await sendgrid.send({
    to: args.to,
    from,
    subject: "Your GetPraying verification code",
    text:
      `Welcome to GetPraying.\n\n` +
      `Your verification code is: ${args.otp}\n\n` +
      `It expires in about ${minutesLeft} minutes.\n\n` +
      `If you didn't request this, you can ignore this email.\n`,
  });
}

async function sendPasswordResetEmail(args: {
  to: string;
  otp: string;
  expiresAt: Date;
}): Promise<void> {
  const apiKey = process.env.SENDGRID_API_KEY;
  const from = process.env.SENDGRID_FROM_EMAIL;

  if (!apiKey || !from) {
    console.log(
      `[password-reset] OTP for ${args.to}: ${args.otp} (expires ${args.expiresAt.toISOString()})`,
    );
    return;
  }

  sendgrid.setApiKey(apiKey);
  const minutesLeft = Math.max(1, Math.round((args.expiresAt.getTime() - Date.now()) / 60_000));

  await sendgrid.send({
    to: args.to,
    from,
    subject: "Your GetPraying password reset code",
    text:
      `You asked to reset your password.\n\n` +
      `Your reset code is: ${args.otp}\n\n` +
      `It expires in about ${minutesLeft} minutes.\n\n` +
      `If you didn't request this, you can ignore this email.\n`,
  });
}

router.post("/auth/register", async (req, res): Promise<void> => {
  const { email, username, password, displayName, bio } = req.body;
  if (!email || !username || !password) {
    res.status(400).json({ error: "Email, username, and password are required" });
    return;
  }

  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

  const [existingEmail] = await db.select().from(usersTable).where(eq(usersTable.email, normalizedEmail));
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
  const finalDisplayName =
    typeof displayName === "string" && displayName.trim() !== ""
      ? displayName.trim()
      : String(username).trim();
  const finalBio =
    typeof bio === "string" && bio.trim() !== "" ? bio.trim() : null;

  const otp = createOtp();
  const expiresAt = otpExpiresAt(15);

  const [user] = await db
    .insert(usersTable)
    .values({
      email: normalizedEmail,
      username,
      displayName: finalDisplayName,
      bio: finalBio,
      passwordHash,
      isBanned: false,
      preferredCategories: [],
      onboardingComplete: false,
      trialStartsAt: new Date(),
      isEmailVerified: false,
      verificationToken: otp,
      verificationExpiresAt: expiresAt,
    })
    .returning();

  await sendVerificationEmail({ to: normalizedEmail, otp, expiresAt });

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
      role: user.role,
      isBanned: user.isBanned,
      trialStartsAt: user.trialStartsAt,
      isEmailVerified: user.isEmailVerified,
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

router.post("/auth/verify-email", async (req, res): Promise<void> => {
  const { email, otp } = req.body ?? {};
  if (typeof email !== "string" || typeof otp !== "string") {
    res.status(400).json({ error: "email and otp are required" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user) {
    res.status(400).json({ error: "Invalid code" });
    return;
  }

  if (user.isEmailVerified) {
    res.json({ success: true, message: "Email already verified" });
    return;
  }

  if (!user.verificationToken || !user.verificationExpiresAt) {
    res.status(400).json({ error: "No active verification code" });
    return;
  }

  if (user.verificationToken !== otp) {
    res.status(400).json({ error: "Invalid code" });
    return;
  }

  if (new Date(user.verificationExpiresAt).getTime() < Date.now()) {
    res.status(400).json({ error: "Code expired" });
    return;
  }

  await db
    .update(usersTable)
    .set({
      isEmailVerified: true,
      verificationToken: null,
      verificationExpiresAt: null,
    })
    .where(eq(usersTable.id, user.id));

  res.json({ success: true, message: "Email verified" });
});

router.post("/auth/resend-verification", async (req, res): Promise<void> => {
  const { email } = req.body ?? {};
  if (typeof email !== "string" || !email.trim()) {
    res.status(400).json({ error: "email is required" });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();

  const rl = checkResendRateLimit(normalizedEmail);
  if (!rl.allowed) {
    res.status(429).json({
      error: `Please wait ${rl.waitSecs} seconds before requesting another code.`,
      waitSecs: rl.waitSecs,
    });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, normalizedEmail));
  if (!user) {
    recordResend(normalizedEmail);
    res.json({ success: true, message: "If your account exists, a code was sent." });
    return;
  }

  if (user.isEmailVerified) {
    res.json({ success: true, message: "Email already verified" });
    return;
  }

  recordResend(normalizedEmail);

  const otp = createOtp();
  const expiresAt = otpExpiresAt(15);

  await db
    .update(usersTable)
    .set({ verificationToken: otp, verificationExpiresAt: expiresAt })
    .where(eq(usersTable.id, user.id));

  await sendVerificationEmail({ to: user.email, otp, expiresAt });
  res.json({ success: true, message: "Verification code sent" });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, normalizedEmail));
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
      role: user.role,
      isBanned: user.isBanned,
      trialStartsAt: user.trialStartsAt,
      isEmailVerified: user.isEmailVerified,
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
    role: user.role,
    isBanned: user.isBanned,
    trialStartsAt: user.trialStartsAt,
    isEmailVerified: user.isEmailVerified,
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

router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  const emailRaw =
    typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";

  if (!emailRaw) {
    res.json({
      success: true,
      message: "If an account exists for that email, a reset code has been sent.",
    });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, emailRaw));
  if (!user) {
    res.json({
      success: true,
      message: "If an account exists for that email, a reset code has been sent.",
    });
    return;
  }

  const otp = createOtp();
  const expiresAt = otpExpiresAt(15);

  await db
    .update(usersTable)
    .set({ passwordResetToken: otp, passwordResetExpiresAt: expiresAt })
    .where(eq(usersTable.id, user.id));

  await sendPasswordResetEmail({ to: emailRaw, otp, expiresAt });

  res.json({
    success: true,
    message: "If an account exists for that email, a reset code has been sent.",
  });
});

router.post("/auth/verify-reset-otp", async (req, res): Promise<void> => {
  const emailRaw =
    typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const otp = typeof req.body?.otp === "string" ? req.body.otp.trim() : "";

  if (!emailRaw || !otp) {
    res.status(400).json({ error: "Email and code are required" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, emailRaw));
  if (!user || !user.passwordResetToken || !user.passwordResetExpiresAt) {
    res.status(400).json({ error: "Invalid or expired code" });
    return;
  }

  if (user.passwordResetToken !== otp) {
    res.status(400).json({ error: "Invalid code" });
    return;
  }

  if (new Date(user.passwordResetExpiresAt).getTime() < Date.now()) {
    res.status(400).json({ error: "Code has expired. Request a new one." });
    return;
  }

  res.json({ success: true, message: "Code verified" });
});

router.post("/auth/reset-password", async (req, res): Promise<void> => {
  const emailRaw =
    typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const otp = typeof req.body?.otp === "string" ? req.body.otp.trim() : "";
  const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";

  if (!emailRaw || !otp || newPassword.length < 6) {
    res.status(400).json({ error: "Email, code, and a new password (6+ characters) are required" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, emailRaw));
  if (
    !user ||
    !user.passwordResetToken ||
    user.passwordResetToken !== otp ||
    !user.passwordResetExpiresAt
  ) {
    res.status(400).json({ error: "Invalid or expired code" });
    return;
  }

  if (new Date(user.passwordResetExpiresAt).getTime() < Date.now()) {
    res.status(400).json({ error: "Code has expired. Request a new one." });
    return;
  }

  const passwordHash = await hashPassword(newPassword);
  await db
    .update(usersTable)
    .set({
      passwordHash,
      passwordResetToken: null,
      passwordResetExpiresAt: null,
    })
    .where(eq(usersTable.id, user.id));

  res.json({ success: true, message: "Password updated. You can sign in now." });
});

router.post("/auth/update-profile", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const updates: Record<string, any> = {};

  if (typeof req.body?.bio === "string") {
    updates.bio = req.body.bio.trim() || null;
  }
  if (typeof req.body?.displayName === "string" && req.body.displayName.trim()) {
    updates.displayName = req.body.displayName.trim();
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No valid fields to update" });
    return;
  }

  await db.update(usersTable).set(updates).where(eq(usersTable.id, user.id));
  res.json({ success: true, message: "Profile updated" });
});

export default router;
