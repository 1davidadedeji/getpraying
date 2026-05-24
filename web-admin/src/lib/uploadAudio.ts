import { apiUrl } from "@/lib/api";
import { parseUploadJson } from "@/lib/parseUploadResponse";

/** CMS audio upload (moderator/admin only, no app-level size cap). */
export async function uploadAdminAudio(token: string, file: File): Promise<string> {
  const body = new FormData();
  body.append("file", file);

  let res: Response;
  try {
    res = await fetch(apiUrl("/uploads/admin-audio"), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body,
    });
  } catch {
    throw new Error(
      "Upload could not reach the API. If the file is large, the server nginx upload limit may need to be raised.",
    );
  }

  const data = await parseUploadJson(res);
  if (!res.ok) {
    throw new Error(data.error ?? `Upload failed (${res.status})`);
  }
  if (!data.url?.trim()) {
    throw new Error("Upload did not return a URL");
  }
  return data.url.trim();
}
