/** Shared form control styles — compact admin dashboard */
export const inputCls =
  "w-full rounded-md border border-[var(--color-border)] bg-[var(--color-cream)] px-2.5 py-1.5 text-[12px] text-[var(--color-primary)] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--color-flame)]";

export const panelCls =
  "rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]";

export const panelHeaderCls =
  "border-b border-[var(--color-border)] bg-[var(--color-cream)]/50 px-3 py-2";

export const btnPrimary =
  "rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-[#252c4a] disabled:opacity-40";

export const btnSecondary =
  "rounded-md border border-[var(--color-border)] bg-[var(--color-cream)] px-3 py-1.5 text-[12px] font-medium text-[var(--color-primary)] transition-colors hover:border-[var(--color-flame)]";

export const btnDangerOutline =
  "rounded-md border border-[color-mix(in_srgb,var(--color-danger)_45%,transparent)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-danger)] transition-colors hover:bg-red-50";

export const btnGhost =
  "rounded-md border border-[var(--color-border)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-primary)] transition-colors hover:border-[var(--color-flame)]";

/** Muted helper / empty-state copy under form panels */
export const helpMutedCls = "text-[12px] text-muted";

/** Inline validation or save error under forms */
export const formErrorCls = "text-[12px] text-danger";

export const helpMutedSmCls = "text-[11px] text-muted";

export const formErrorSmCls = "text-[11px] text-danger";

export const premiumCheckboxCls = "mt-0.5 h-4 w-4 shrink-0 accent-primary";

export const premiumToggleTitleCls = "block text-[12px] font-semibold text-primary";

export const premiumToggleHintCls = "mt-0.5 block text-[11px] leading-snug text-muted";

export const btnModerationApproveCls =
  "rounded-md bg-success px-2.5 py-1 text-[11px] font-medium text-white disabled:opacity-40";

export const btnModerationDeclineConfirmCls =
  "rounded-md bg-danger px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-40";

export const btnModerationDeclineOutlineCls =
  "rounded-md border border-danger px-2.5 py-1 text-[11px] text-danger";

export const btnModerationCancelCls =
  "rounded-md border border-border px-2.5 py-1 text-[11px]";
