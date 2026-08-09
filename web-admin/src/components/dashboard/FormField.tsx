export function FormField({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      {children}
    </div>
  );
}
