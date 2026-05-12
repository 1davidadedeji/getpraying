import { apiUrl } from "@/lib/api";

/** Posts multipart audio to the API; returns `/api/static/uploads/...` path (same contract as mobile). */
export async function uploadPostAudio(token: string, file: File): Promise<string> {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch(apiUrl("/uploads/post-audio"), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body,
  });
  const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok) throw new Error(data.error ?? `Upload failed (${res.status})`);
  if (!data.url?.trim()) throw new Error("Upload did not return a URL");
  return data.url.trim();
}
