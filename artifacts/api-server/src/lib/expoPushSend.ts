import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { expoPushRequestHeaders } from "./expoPushHttp";

export type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data: Record<string, string>;
  sound?: string;
  priority?: "high" | "normal" | "default";
  channelId?: string;
};

const CHUNK_SIZE = 96;

type ExpoTicket = {
  status?: string;
  message?: string;
  id?: string;
  details?: { error?: string };
};

type PendingReceipt = {
  ticketId: string;
  token: string;
};

const RECEIPT_POLL_DELAYS_MS = [15_000, 30_000, 45_000];

function scheduleReceiptPoll(entries: PendingReceipt[]): void {
  if (entries.length === 0) return;
  setTimeout(() => {
    void pollExpoPushReceipts([...entries], 0);
  }, RECEIPT_POLL_DELAYS_MS[0]!);
}

async function pollExpoPushReceipts(entries: PendingReceipt[], attempt: number): Promise<void> {
  const ids = entries.map((e) => e.ticketId).filter(Boolean);
  if (ids.length === 0) return;

  try {
    const res = await fetch("https://exp.host/--/api/v2/push/getReceipts", {
      method: "POST",
      headers: expoPushRequestHeaders(),
      body: JSON.stringify({ ids }),
    });
    const bodyText = await res.text().catch(() => "");
    if (!res.ok) {
      console.warn("[push] Expo receipt poll non-OK:", res.status, bodyText.slice(0, 200));
      await scheduleReceiptRetry(entries, attempt);
      return;
    }

    const json = JSON.parse(bodyText || "{}") as {
      data?: Record<string, { status?: string; message?: string; details?: { error?: string } }>;
    };
    const data = json.data ?? {};
    const pending: PendingReceipt[] = [];
    for (const entry of entries) {
      const receipt = data[entry.ticketId];
      if (!receipt) {
        pending.push(entry);
        continue;
      }
      if (receipt.status === "error") {
        await handleTicketError(entry.token, {
          status: "error",
          message: receipt.message,
          details: receipt.details,
        });
      }
    }
    if (pending.length > 0) {
      await scheduleReceiptRetry(pending, attempt);
    }
  } catch (e) {
    console.warn("[push] Expo receipt poll failed:", e);
    await scheduleReceiptRetry(entries, attempt);
  }
}

function scheduleReceiptRetry(entries: PendingReceipt[], attempt: number): Promise<void> {
  const nextAttempt = attempt + 1;
  if (nextAttempt >= RECEIPT_POLL_DELAYS_MS.length) return Promise.resolve();
  const delay = RECEIPT_POLL_DELAYS_MS[nextAttempt]! - RECEIPT_POLL_DELAYS_MS[attempt]!;
  return new Promise((resolve) => {
    setTimeout(() => {
      void pollExpoPushReceipts(entries, nextAttempt).finally(resolve);
    }, delay);
  });
}

function isValidExpoToken(token: string): boolean {
  const t = token.trim();
  return t.startsWith("ExponentPushToken[") && t.length >= 16;
}

async function invalidateToken(token: string): Promise<void> {
  await db
    .update(usersTable)
    .set({ expoPushToken: null, updatedAt: new Date() })
    .where(eq(usersTable.expoPushToken, token));
}

async function handleTicketError(token: string, ticket: ExpoTicket | undefined): Promise<boolean> {
  if (!ticket || ticket.status !== "error") return ticket?.status === "ok";
  const code = ticket.details?.error;
  console.warn("[push] Expo ticket error:", {
    code: code ?? ticket.message ?? "unknown",
    tokenPrefix: token.slice(0, 28),
  });
  if (code === "DeviceNotRegistered") {
    // The device has uninstalled the app or APNs/FCM has deregistered it — safe to drop.
    await invalidateToken(token);
  } else if (code === "InvalidCredentials") {
    // Project-level APNs/FCM credentials in the Expo dashboard are invalid or expired.
    // The device tokens themselves are still valid; do NOT wipe them from the DB.
    // Fix credentials at expo.dev → project → Credentials, then tokens will work again.
    console.error(
      "[push] InvalidCredentials: APNs/FCM project credentials are invalid — " +
        "update them at expo.dev/accounts/<account>/projects/<slug>/credentials. " +
        "Device tokens have NOT been cleared.",
    );
  }
  return false;
}

async function postExpoBatch(batch: ExpoPushMessage[]): Promise<boolean[]> {
  const results: boolean[] = batch.map(() => false);
  const receiptEntries: PendingReceipt[] = [];
  if (batch.length === 0) return results;

  try {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: expoPushRequestHeaders(),
      body: JSON.stringify(batch),
    });
    const bodyText = await res.text().catch(() => "");

    if (!res.ok) {
      console.warn("[push] Expo push non-OK:", res.status, bodyText.slice(0, 280));
      if (bodyText.includes("PUSH_TOO_MANY_EXPERIENCE_IDS") && batch.length > 1) {
        for (let i = 0; i < batch.length; i++) {
          const [ok] = await postExpoBatch([batch[i]!]);
          results[i] = ok === true;
        }
        return results;
      }
      return results;
    }

    const json = JSON.parse(bodyText || "{}") as { data?: ExpoTicket[] };
    const tickets = Array.isArray(json.data) ? json.data : [];
    for (let i = 0; i < batch.length; i++) {
      const token = batch[i]!.to;
      const ticket = tickets[i];
      results[i] = await handleTicketError(token, ticket);
      if (ticket?.status === "ok" && ticket.id) {
        receiptEntries.push({ ticketId: ticket.id, token });
      }
    }
    scheduleReceiptPoll(receiptEntries);
    return results;
  } catch (e) {
    console.warn("[push] Expo push request failed:", e);
    return results;
  }
}

/** Send one or more Expo push messages; returns per-message delivery success. */
export async function sendExpoPushMessages(messages: ExpoPushMessage[]): Promise<boolean[]> {
  const valid = messages.filter((m) => isValidExpoToken(m.to));
  const results: boolean[] = [];
  let batch: ExpoPushMessage[] = [];

  for (const msg of valid) {
    batch.push({
      sound: "default",
      priority: "high",
      channelId: "default",
      ...msg,
      to: msg.to.trim(),
    });
    if (batch.length >= CHUNK_SIZE) {
      results.push(...(await postExpoBatch(batch)));
      batch = [];
    }
  }
  if (batch.length > 0) results.push(...(await postExpoBatch(batch)));

  return results;
}

/** Send a single push; returns true when Expo accepted the message. */
export async function sendSingleExpoPush(message: ExpoPushMessage): Promise<boolean> {
  const [ok] = await sendExpoPushMessages([message]);
  return ok === true;
}
