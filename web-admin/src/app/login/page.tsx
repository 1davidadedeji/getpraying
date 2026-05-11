"use client";

import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth";

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [user, loading, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const err = await login(email.trim(), password);
    setBusy(false);
    if (err) { setError(err); return; }
    router.replace("/dashboard");
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-[var(--color-cream-muted)] px-4 py-12">
      <div className="w-full max-w-[340px]">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img src="/logo.png" alt="Get Praying" className="w-16 h-16 object-contain mb-4" />
          <h1 className="font-heading text-xl font-bold tracking-tight text-[var(--color-primary)]">Get Praying Admin</h1>
          <p className="text-[13px] text-[#8A8FA8] mt-1">Sign in with your admin account</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-[#E8E4DC] p-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-semibold text-[#1A1F36]" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@getpraying.com"
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E4DC] bg-[#F9F6F0] text-[#1A1F36] placeholder-[#C0BDBA] text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-transparent"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-semibold text-[#1A1F36]" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E4DC] bg-[#F9F6F0] text-[#1A1F36] placeholder-[#C0BDBA] text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-transparent"
            />
          </div>

          {error && (
            <div className="text-[13px] text-[#EF4444] bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full py-2.5 rounded-xl bg-[#1A1F36] text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60 hover:bg-[#252c4a] transition-colors"
          >
            {busy && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="text-center text-[11px] text-[#B0B5C8] mt-5">
          Access restricted to Admin and Moderator accounts
        </p>
      </div>
    </div>
  );
}
