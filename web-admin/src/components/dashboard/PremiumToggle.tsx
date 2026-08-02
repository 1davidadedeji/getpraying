"use client";

import {
  panelCls,
  premiumCheckboxCls,
  premiumToggleHintCls,
  premiumToggleTitleCls,
} from "@/components/dashboard/form-styles";

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
          className={premiumCheckboxCls}
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="min-w-0">
          <span className={premiumToggleTitleCls}>Premium content</span>
          <span className={premiumToggleHintCls}>
            Free users see a short preview; audio and video require a subscription.
          </span>
        </span>
      </label>
    </div>
  );
}
