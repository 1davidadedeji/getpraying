import { apiFetch } from "@/lib/api";

export async function submitPostReport(
  postId: number,
  token: string | null,
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  if (!token) {
    return { ok: false, error: "Sign in to report a prayer." };
  }
  try {
    const res = await apiFetch(`/posts/${postId}/flag`, {
      method: "POST",
      token,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "inappropriate" }),
    });
    const json = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
    if (!res.ok) {
      return { ok: false, error: json.error ?? "Please try again." };
    }
    return {
      ok: true,
      message: json.message ?? "Thank you for helping keep the community safe.",
    };
  } catch {
    return { ok: false, error: "Check your connection and try again." };
  }
}
