import { panelCls } from "@/components/dashboard/form-styles";
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
    <div className={panelCls + " p-3"}>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
        {label}
      </p>
      <p
        className={cn(
          "text-lg font-bold",
          accent ? "text-[var(--color-flame)]" : "text-[var(--color-primary)]",
        )}
      >
        {value === undefined ? <span className="text-[#C0BDBA]">—</span> : value.toLocaleString()}
      </p>
      {sub ? <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">{sub}</p> : null}
    </div>
  );
}
