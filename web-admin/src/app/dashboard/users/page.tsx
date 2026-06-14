"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { AdminPaginationBar } from "@/components/dashboard/AdminPaginationBar";
import { Spinner } from "@/components/ui/feedback";
import { AdminSelect } from "@/components/ui/AdminSelect";
import { useAuth } from "@/context/auth";
import { adminFetch, authHeaders, apiUrl } from "@/lib/api";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

interface AdminUser {
  id: number;
  username: string;
  displayName: string | null;
  email: string;
  role: string;
  subscription: string;
  isBanned: boolean;
  isEmailVerified: boolean;
  prayersShared: number | null;
  prayedFor: number | null;
  createdAt: string;
}

const ROLES = ["user", "moderator", "admin"] as const;

const USERS_PAGE_SIZE = 30;

export default function UsersPage() {
  const { token, user: me } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalMatching, setTotalMatching] = useState(0);
  const [refreshTick, setRefreshTick] = useState(0);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 380);
  const [roleUpdating, setRoleUpdating] = useState<number | null>(null);
  const [banBusy, setBanBusy] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [deleteBusy, setDeleteBusy] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const prevFiltersRef = useRef<{ q: string } | null>(null);

  useEffect(() => {
    if (!token) return;

    const next = { q: debouncedSearch.trim() };
    const prev = prevFiltersRef.current;
    const changed = !prev || prev.q !== next.q;
    prevFiltersRef.current = next;

    const effectivePage = changed ? 1 : page;
    if (changed && page !== 1) setPage(1);

    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const params = new URLSearchParams({
          limit: String(USERS_PAGE_SIZE),
          page: String(effectivePage),
        });
        if (next.q) params.set("q", next.q);
        const res = await adminFetch(`/admin/users?${params}`, token);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;
        setUsers(data.users ?? []);
        setTotalMatching(typeof data.totalMatching === "number" ? data.totalMatching : 0);
        setTotalPages(typeof data.totalPages === "number" ? Math.max(1, data.totalPages) : 1);
        if (typeof data.page === "number") setPage(data.page);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, debouncedSearch, page, refreshTick]);

  const updateRole = async (userId: number, role: string) => {
    if (!token) return;
    setRoleUpdating(userId);
    try {
      const res = await adminFetch(`/admin/users/${userId}/role`, token, { method: "POST", body: JSON.stringify({ role  }),
      });
      if (res.ok) {
        setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
      }
    } finally {
      setRoleUpdating(null);
    }
  };

  const toggleBan = async (u: AdminUser) => {
    if (!token) return;
    setBanBusy(u.id);
    try {
      const endpoint = u.isBanned ? `/admin/users/${u.id}/unban` : `/admin/users/${u.id}/ban`;
      const res = await adminFetch(endpoint, token, { method: "POST" });
      if (res.ok) setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, isBanned: !u.isBanned } : x)));
    } finally {
      setBanBusy(null);
    }
  };

  const deleteUser = async (userId: number) => {
    if (!token) return;
    setDeleteBusy(userId);
    try {
      await adminFetch(`/admin/users/${userId}`, token, { method: "DELETE" });
      setDeleteConfirm(null);
      setRefreshTick((t) => t + 1);
    } finally {
      setDeleteBusy(null);
    }
  };

  return (
    <Fragment>
      <PageHeader
        title="Users & roles"
        description="Manage roles, bans, and accounts"
        action={
          <div className="relative w-full min-w-0 sm:w-60">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted)]"
              strokeWidth={1.75}
              aria-hidden
            />
            <input
              type="search"
              placeholder="Search username, email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-2 pl-9 pr-4 text-[13px] text-[var(--color-primary)] placeholder:text-[#C0BDBA] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--color-flame)]"
            />
          </div>
        }
      />

      {loading && users.length === 0 ? (
        <Spinner />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
          <table className="w-full min-w-[860px] text-[13px]">
            <thead className="border-b border-[var(--color-border)] bg-[var(--color-cream)]">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-[var(--color-primary)]">User</th>
                <th className="px-4 py-3 text-left font-semibold text-[var(--color-primary)]">Email</th>
                <th className="px-4 py-3 text-left font-semibold text-[var(--color-primary)]">Role</th>
                <th className="px-4 py-3 text-left font-semibold text-[var(--color-primary)]">Subscription</th>
                <th className="px-4 py-3 text-left font-semibold text-[var(--color-primary)]">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-[var(--color-primary)]">Joined</th>
                <th className="w-8 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <Fragment key={u.id}>
                  <tr
                    className={`cursor-pointer border-b border-[var(--color-border)] last:border-0 hover:bg-[color-mix(in_srgb,var(--color-cream)_55%,white)] ${expandedId === u.id ? "bg-[color-mix(in_srgb,var(--color-cream)_55%,white)]" : ""}`}
                    onClick={() => setExpandedId(expandedId === u.id ? null : u.id)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-[var(--color-primary)]">{u.displayName ?? u.username}</p>
                      <p className="text-[11px] text-[var(--color-muted)]">@{u.username}</p>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">{u.email}</td>
                    <td className="px-4 py-3">
                      <RoleBadge role={u.role} />
                    </td>
                    <td className="px-4 py-3">
                      <SubscriptionBadge subscription={u.subscription} />
                    </td>
                    <td className="px-4 py-3">
                      {u.isBanned ? (
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-[var(--color-danger)]">
                          Banned
                        </span>
                      ) : (
                        <span className="rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-semibold text-green-600">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[var(--color-muted)]">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-muted)]">
                      <svg
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className={`h-4 w-4 transition-transform ${expandedId === u.id ? "rotate-180" : ""}`}
                      >
                        <path
                          fillRule="evenodd"
                          d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </td>
                  </tr>
                  {expandedId === u.id && (
                    <tr className="border-b border-[var(--color-border)] bg-[var(--color-cream)]">
                      <td colSpan={7} className="px-4 py-4">
                        <div className="flex flex-wrap items-center gap-4">
                          <div className="space-y-0.5 text-[12px] text-[var(--color-muted)]">
                            <p>
                              Subscription:{" "}
                              <span className="font-medium text-[var(--color-primary)]">
                                {formatSubscriptionLabel(u.subscription)}
                              </span>
                            </p>
                            <p>🙏 {u.prayersShared ?? 0} prayers shared</p>
                            <p>❤️ {u.prayedFor ?? 0} prayed for</p>
                            <p>
                              {u.isEmailVerified ? "✅" : "⚠️"} Email {u.isEmailVerified ? "verified" : "unverified"}
                            </p>
                          </div>

                          <div className="ml-auto flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <AdminSelect
                              label="Role"
                              size="compact"
                              className="min-w-[140px]"
                              value={u.role}
                              disabled={u.id === me?.id || roleUpdating === u.id}
                              onChange={(role) => void updateRole(u.id, role)}
                            >
                              {ROLES.map((r) => (
                                <option key={r} value={r}>
                                  {r}
                                </option>
                              ))}
                            </AdminSelect>
                            {roleUpdating === u.id && (
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-flame)] border-t-transparent" />
                            )}
                          </div>

                          {u.id !== me?.id && (
                            <button
                              disabled={banBusy === u.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                void toggleBan(u);
                              }}
                              className={`rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors disabled:opacity-40 ${
                                u.isBanned
                                  ? "bg-green-50 text-green-700 hover:bg-green-100"
                                  : "bg-red-50 text-[var(--color-danger)] hover:bg-red-100"
                              }`}
                            >
                              {banBusy === u.id ? "…" : u.isBanned ? "Unban" : "Ban"}
                            </button>
                          )}

                          {u.id !== me?.id &&
                            (deleteConfirm === u.id ? (
                              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                <span className="text-[12px] font-medium text-[var(--color-danger)]">Delete account?</span>
                                <button
                                  disabled={deleteBusy === u.id}
                                  onClick={() => void deleteUser(u.id)}
                                  className="rounded-lg bg-[var(--color-danger)] px-2.5 py-1 text-[12px] font-medium text-white disabled:opacity-40"
                                >
                                  {deleteBusy === u.id ? "…" : "Confirm"}
                                </button>
                                <button
                                  onClick={() => setDeleteConfirm(null)}
                                  className="rounded-lg bg-[var(--color-border)] px-2.5 py-1 text-[12px] text-[var(--color-primary)]"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteConfirm(u.id);
                                }}
                                className="rounded-lg border border-[color-mix(in_srgb,var(--color-danger)_45%,transparent)] px-3 py-1.5 text-[12px] text-[var(--color-danger)] transition-colors hover:bg-red-50"
                              >
                                Delete account
                              </button>
                            ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-[var(--color-muted)]">
                    {debouncedSearch.trim() ? "No users match your search" : "No users found"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {totalMatching > 0 ? (
        <AdminPaginationBar
          className="mt-4"
          page={page}
          totalPages={totalPages}
          totalMatching={totalMatching}
          pageSize={USERS_PAGE_SIZE}
          loading={loading}
          onPageChange={setPage}
        />
      ) : null}
    </Fragment>
  );
}

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, string> = {
    admin: "bg-[var(--color-primary)] text-white",
    moderator: "bg-purple-100 text-purple-700",
    user: "bg-[var(--color-border)] text-[var(--color-muted)]",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${map[role] ?? map.user}`}>{role}</span>
  );
}

function formatSubscriptionLabel(subscription: string | null | undefined): string {
  const tier = String(subscription ?? "free").toLowerCase();
  if (tier === "premium") return "Premium (paid)";
  if (tier === "trial") return "Trial";
  if (tier === "free") return "Free";
  return tier;
}

function SubscriptionBadge({ subscription }: { subscription: string | null | undefined }) {
  const tier = String(subscription ?? "free").toLowerCase();
  const map: Record<string, string> = {
    premium: "bg-amber-100 text-amber-800",
    trial: "bg-sky-100 text-sky-700",
    free: "bg-[var(--color-border)] text-[var(--color-muted)]",
  };
  const label = formatSubscriptionLabel(subscription);
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${map[tier] ?? map.free}`}>{label}</span>
  );
}
