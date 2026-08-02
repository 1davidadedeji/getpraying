"use client";

import { panelCls } from "@/components/dashboard/form-styles";

export function PremiumToggle({
  checked,
  onChange,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={`${panelCls} p-3 ${className ?? ""}`.trim()}>
      <label className="flex cursor-pointer items-start gap-2.5">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-primary)]"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="min-w-0">
          <span className="block text-[12px] font-semibold text-[var(--color-text)]">Premium content</span>
          <span className="mt-0.5 block text-[11px] leading-snug text-[var(--color-muted)]">
            Free users see a short preview; audio and video require a subscription.
          </span>
        </span>
      </label>
    </div>
  );
}
