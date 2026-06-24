import { apiFetch } from "@/lib/api";

export async function blockUser(
  username: string,
  token: string | null,
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  if (!token) {
    return { ok: false, error: "Sign in to block a user." };
  }
  const handle = username.trim();
  if (!handle) {
    return { ok: false, error: "User not found." };
  }
  try {
    const res = await apiFetch(`/users/${encodeURIComponent(handle)}/block`, {
      method: "POST",
      token,
    });
    const json = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
    if (!res.ok) {
      return { ok: false, error: json.error ?? "Could not block this user." };
    }
    return {
      ok: true,
      message: json.message ?? "User blocked.",
    };
  } catch {
    return { ok: false, error: "Check your connection and try again." };
  }
}

export async function unblockUser(
  username: string,
  token: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!token) {
    return { ok: false, error: "Sign in to unblock a user." };
  }
  const handle = username.trim();
  if (!handle) {
    return { ok: false, error: "User not found." };
  }
  try {
    const res = await apiFetch(`/users/${encodeURIComponent(handle)}/block`, {
      method: "DELETE",
      token,
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      return { ok: false, error: json.error ?? "Could not unblock this user." };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Check your connection and try again." };
  }
}
