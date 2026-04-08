import { ApiError } from "@workspace/api-client-react";

export function getApiErrorMessage(err: unknown, fallback = "Something went wrong."): string {
  if (err instanceof ApiError) {
    const body = err.data as { error?: string } | null | undefined;
    if (body && typeof body.error === "string" && body.error.trim()) {
      return body.error;
    }
  }
  const msg =
    err && typeof err === "object" && "message" in err && typeof (err as Error).message === "string"
      ? (err as Error).message
      : "";
  if (
    msg.includes("Network request failed") ||
    msg.includes("Failed to fetch") ||
    msg.includes("NetworkError")
  ) {
    return "Could not reach the server. Check your connection and that the API URL is correct.";
  }
  if (msg) return msg;
  return fallback;
}
