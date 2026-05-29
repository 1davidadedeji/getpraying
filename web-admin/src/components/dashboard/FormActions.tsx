import { btnPrimary, btnSecondary } from "@/components/dashboard/form-styles";

export function FormActions({
  primaryLabel,
  onPrimary,
  primaryDisabled,
  primaryLoading,
  onCancel,
  cancelLabel = "Cancel",
}: {
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  primaryLoading?: boolean;
  onCancel: () => void;
  cancelLabel?: string;
}) {
  return (
    <div className="flex flex-wrap gap-2 border-t border-[var(--color-border)] pt-3">
      <button
        type="button"
        onClick={onPrimary}
        disabled={primaryDisabled || primaryLoading}
        className={btnPrimary}
      >
        {primaryLoading ? "…" : primaryLabel}
      </button>
      <button type="button" onClick={onCancel} className={btnSecondary}>
        {cancelLabel}
      </button>
    </div>
  );
}
