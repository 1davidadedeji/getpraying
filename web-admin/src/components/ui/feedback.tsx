export function Spinner({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center py-16 ${className}`}>
      <div
        className="h-7 w-7 animate-spin rounded-full border-4 border-flame border-t-transparent"
        aria-hidden
      />
    </div>
  );
}

export function CenterSpinner() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-cream">
      <div
        className="h-8 w-8 animate-spin rounded-full border-4 border-flame border-t-transparent"
        aria-hidden
      />
    </div>
  );
}

export function EmptyState({ label }: { label: string }) {
  return <p className="py-16 text-center text-[13px] text-muted">{label}</p>;
}
