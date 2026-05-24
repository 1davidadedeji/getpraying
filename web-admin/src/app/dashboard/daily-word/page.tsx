"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { useAuth } from "@/context/auth";
import { apiUrl, authHeaders } from "@/lib/api";

type DailyWordPayload = {
  date: string;
  quoteText: string;
  reference: string;
  source: "default" | "override";
  autoRotation?: boolean;
};

function todayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function DailyWordPage() {
  const { token } = useAuth();
  const [autoRotation, setAutoRotation] = useState(false);
  const [settingsBusy, setSettingsBusy] = useState(true);
  const [dateStr, setDateStr] = useState(todayYmd);
  const [quoteText, setQuoteText] = useState("");
  const [reference, setReference] = useState("");
  const [source, setSource] = useState<"default" | "override">("default");
  const [loadBusy, setLoadBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [clearBusy, setClearBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const loadSettings = useCallback(async () => {
    if (!token) return;
    setSettingsBusy(true);
    try {
      const res = await fetch(apiUrl("/admin/daily-word/settings"), {
        headers: authHeaders(token),
      });
      const data = (await res.json()) as { autoRotation?: boolean; error?: string };
      if (res.ok) setAutoRotation(!!data.autoRotation);
    } catch {
      /* ignore */
    } finally {
      setSettingsBusy(false);
    }
  }, [token]);

  const loadWord = useCallback(async () => {
    if (!token || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) return;
    setLoadBusy(true);
    setMessage(null);
    try {
      const res = await fetch(apiUrl(`/daily-word?date=${encodeURIComponent(dateStr.trim())}`), {
        headers: authHeaders(token),
      });
      const data = (await res.json()) as DailyWordPayload & { error?: string };
      if (!res.ok) {
        setMessage({ ok: false, text: data.error ?? "Could not load daily word" });
        return;
      }
      setQuoteText(data.quoteText);
      setReference(data.reference);
      setSource(data.source);
      if (typeof data.autoRotation === "boolean") setAutoRotation(data.autoRotation);
    } catch {
      setMessage({ ok: false, text: "Network error loading daily word." });
    } finally {
      setLoadBusy(false);
    }
  }, [token, dateStr]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    void loadWord();
  }, [loadWord]);

  const setMode = async (next: boolean) => {
    if (!token || settingsBusy) return;
    setSettingsBusy(true);
    setMessage(null);
    try {
      const res = await fetch(apiUrl("/admin/daily-word/settings"), {
        method: "PATCH",
        headers: authHeaders(token),
        body: JSON.stringify({ autoRotation: next }),
      });
      const data = (await res.json()) as { autoRotation?: boolean; error?: string };
      if (!res.ok) {
        setMessage({ ok: false, text: data.error ?? "Could not update mode" });
        return;
      }
      setAutoRotation(!!data.autoRotation);
      setMessage({
        ok: true,
        text: data.autoRotation
          ? "Auto mode on — the verse rotates daily from the built-in list."
          : "Manual mode on — Psalm 34:17 stays unless you set a date override.",
      });
      void loadWord();
    } catch {
      setMessage({ ok: false, text: "Network error updating mode." });
    } finally {
      setSettingsBusy(false);
    }
  };

  const saveOverride = async () => {
    if (!token) return;
    const d = dateStr.trim();
    const qt = quoteText.trim();
    const ref = reference.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !qt || !ref) {
      setMessage({ ok: false, text: "Use YYYY-MM-DD and fill in quote and reference." });
      return;
    }
    setSaveBusy(true);
    setMessage(null);
    try {
      const res = await fetch(apiUrl("/admin/daily-word"), {
        method: "PUT",
        headers: authHeaders(token),
        body: JSON.stringify({ effectiveDate: d, quoteText: qt, reference: ref }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMessage({ ok: false, text: data.error ?? "Save failed" });
        return;
      }
      setMessage({ ok: true, text: `Saved override for ${d}.` });
      setSource("override");
    } catch {
      setMessage({ ok: false, text: "Network error saving override." });
    } finally {
      setSaveBusy(false);
    }
  };

  const clearOverride = async () => {
    if (!token) return;
    const d = dateStr.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      setMessage({ ok: false, text: "Use date YYYY-MM-DD." });
      return;
    }
    setClearBusy(true);
    setMessage(null);
    try {
      const res = await fetch(apiUrl(`/admin/daily-word?date=${encodeURIComponent(d)}`), {
        method: "DELETE",
        headers: authHeaders(token),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMessage({ ok: false, text: data.error ?? "Clear failed" });
        return;
      }
      setMessage({ ok: true, text: `Override cleared for ${d}.` });
      void loadWord();
    } catch {
      setMessage({ ok: false, text: "Network error clearing override." });
    } finally {
      setClearBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader
        title="Daily Word"
        description="Welcome screen verse — manual by default (Psalm 34:17), or auto-rotate daily"
      />

      <div className="flex flex-col gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 mb-4">
        <div>
          <p className="text-[11px] font-semibold text-[#8A8FA8] uppercase tracking-wide mb-2">
            Update mode
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={settingsBusy}
              onClick={() => void setMode(false)}
              className={`flex-1 py-2.5 rounded-xl text-[13px] font-semibold border transition-colors ${
                !autoRotation
                  ? "bg-[#1A1F36] text-white border-[#1A1F36]"
                  : "bg-[#F9F6F0] text-[#5B6280] border-[#E8E4DC] hover:border-[#C0BDBA]"
              }`}
            >
              Manual
            </button>
            <button
              type="button"
              disabled={settingsBusy}
              onClick={() => void setMode(true)}
              className={`flex-1 py-2.5 rounded-xl text-[13px] font-semibold border transition-colors ${
                autoRotation
                  ? "bg-[#1A1F36] text-white border-[#1A1F36]"
                  : "bg-[#F9F6F0] text-[#5B6280] border-[#E8E4DC] hover:border-[#C0BDBA]"
              }`}
            >
              Auto
            </button>
          </div>
          <p className="text-[12px] text-[#8A8FA8] mt-2 leading-relaxed">
            {autoRotation
              ? "Auto picks a different verse each day from the built-in rotation. Date overrides still take priority."
              : "Manual keeps Psalm 34:17 on the welcome screen unless you set an override for a specific date."}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <p className="text-[12px] text-[#8A8FA8]">
          {source === "override"
            ? "This date has an admin override."
            : autoRotation
              ? "This date uses the automatic rotation."
              : "This date uses the default manual verse."}
        </p>

        <div>
          <label className="text-[11px] font-semibold text-[#8A8FA8] uppercase tracking-wide block mb-1.5">
            Date (YYYY-MM-DD)
          </label>
          <input
            type="text"
            value={dateStr}
            onChange={(e) => setDateStr(e.target.value)}
            onBlur={() => void loadWord()}
            className="w-full px-3 py-2.5 rounded-lg border border-[#E8E4DC] bg-[#F9F6F0] text-[13px] text-[#1A1F36] focus:outline-none focus:ring-2 focus:ring-[#F97316]"
          />
        </div>

        <div>
          <label className="text-[11px] font-semibold text-[#8A8FA8] uppercase tracking-wide block mb-1.5">
            Quote
          </label>
          <textarea
            value={quoteText}
            onChange={(e) => setQuoteText(e.target.value)}
            rows={3}
            className="w-full px-3 py-2.5 rounded-lg border border-[#E8E4DC] bg-[#F9F6F0] text-[13px] text-[#1A1F36] focus:outline-none focus:ring-2 focus:ring-[#F97316] resize-none"
          />
        </div>

        <div>
          <label className="text-[11px] font-semibold text-[#8A8FA8] uppercase tracking-wide block mb-1.5">
            Reference
          </label>
          <input
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="— Psalm 34:17"
            className="w-full px-3 py-2.5 rounded-lg border border-[#E8E4DC] bg-[#F9F6F0] text-[13px] text-[#1A1F36] focus:outline-none focus:ring-2 focus:ring-[#F97316]"
          />
        </div>

        {message && (
          <div
            className={`text-[13px] px-3.5 py-3 rounded-lg border ${
              message.ok
                ? "bg-green-50 border-green-100 text-green-700"
                : "bg-red-50 border-red-100 text-[#EF4444]"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            disabled={saveBusy || loadBusy}
            onClick={() => void saveOverride()}
            className="flex-1 py-2.5 rounded-xl bg-[#22C55E] text-white font-semibold text-[13px] disabled:opacity-40"
          >
            {saveBusy ? "Saving…" : "Save override"}
          </button>
          <button
            type="button"
            disabled={clearBusy || loadBusy || source !== "override"}
            onClick={() => void clearOverride()}
            className="flex-1 py-2.5 rounded-xl border border-[#EF4444] text-[#EF4444] font-semibold text-[13px] disabled:opacity-40"
          >
            {clearBusy ? "Clearing…" : "Clear override"}
          </button>
        </div>
      </div>
    </div>
  );
}
