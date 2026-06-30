"use client";

import { useState } from "react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { useAuth } from "@/context/auth";
import { adminFetch, authHeaders, apiUrl } from "@/lib/api";

export default function NotificationsPage() {
  const { token } = useAuth();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const send = async () => {
    if (!token || !title.trim() || !body.trim()) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await adminFetch("/admin/notifications/broadcast", token, {
        method: "POST",
        body: JSON.stringify({ title: title.trim(), body: body.trim() }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string; sent?: number } | null;
      if (!res.ok) {
        setResult({ ok: false, message: data?.error ?? `Failed to send (${res.status}).` });
      } else {
        setResult({ ok: true, message: `Broadcast sent to ${data?.sent ?? 0} device(s).` });
      }
    } catch {
      setResult({ ok: false, message: "Network error. Try again." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader title="Push notifications" description="Broadcast an immediate push to all users" />

      <div className="flex flex-col gap-4 rounded-xl border border-(--color-border) bg-(--color-surface) p-5">
        <div>
          <label className="text-[11px] font-semibold text-[#8A8FA8] uppercase tracking-wide block mb-1.5">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            placeholder="e.g. Daily Reflection"
            className="w-full px-3 py-2.5 rounded-lg border border-[#E8E4DC] bg-[#F9F6F0] text-[13px] text-[#1A1F36] placeholder-[#C0BDBA] focus:outline-none focus:ring-2 focus:ring-[#F97316]"
          />
          <p className="text-[11px] text-[#C0BDBA] text-right mt-1">{title.length}/80</p>
        </div>

        <div>
          <label className="text-[11px] font-semibold text-[#8A8FA8] uppercase tracking-wide block mb-1.5">Message</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={256}
            rows={4}
            placeholder="Type your message here…"
            className="w-full px-3 py-2.5 rounded-lg border border-[#E8E4DC] bg-[#F9F6F0] text-[13px] text-[#1A1F36] placeholder-[#C0BDBA] focus:outline-none focus:ring-2 focus:ring-[#F97316] resize-none"
          />
          <p className="text-[11px] text-[#C0BDBA] text-right mt-1">{body.length}/256</p>
        </div>

        {result && (
          <div className={`text-[13px] px-3.5 py-3 rounded-lg border ${result.ok ? "bg-green-50 border-green-100 text-green-700" : "bg-red-50 border-red-100 text-[#EF4444]"}`}>
            {result.message}
          </div>
        )}

        <button
          disabled={busy || !title.trim() || !body.trim()}
          onClick={send}
          className="w-full py-2.5 rounded-xl bg-[#F97316] text-white font-semibold text-[13px] flex items-center justify-center gap-2 disabled:opacity-40 hover:bg-orange-500 transition-colors"
        >
          {busy
            ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"/></svg>
          }
          {busy ? "Sending…" : "Send Broadcast"}
        </button>

        <p className="text-[11px] text-[#C0BDBA] text-center">
          Sends immediately to all users with notifications enabled.
        </p>
      </div>
    </div>
  );
}
