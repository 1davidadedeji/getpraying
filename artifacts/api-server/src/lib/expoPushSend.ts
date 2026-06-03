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
  details?: { error?: string };
};

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
  if (code === "DeviceNotRegistered" || code === "InvalidCredentials") {
    await invalidateToken(token);
  }
  return false;
}

async function postExpoBatch(batch: ExpoPushMessage[]): Promise<boolean[]> {
  const results: boolean[] = batch.map(() => false);
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
      results[i] = await handleTicketError(token, tickets[i]);
    }
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
