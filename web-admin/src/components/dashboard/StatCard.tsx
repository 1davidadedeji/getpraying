import { cn } from "@/lib/cn";

export function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: number | undefined;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5 sm:p-4">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)] sm:text-[11px]">
        {label}
      </p>
      <p
        className={cn(
          "text-xl font-bold sm:text-2xl",
          accent ? "text-[var(--color-flame)]" : "text-[var(--color-primary)]",
        )}
      >
        {value === undefined ? <span className="text-[#C0BDBA]">—</span> : value.toLocaleString()}
      </p>
      {sub ? <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">{sub}</p> : null}
    </div>
  );
}
