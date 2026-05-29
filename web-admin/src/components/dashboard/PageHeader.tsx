import type { ReactNode } from "react";
import { BackLink } from "@/components/dashboard/BackLink";
import { cn } from "@/lib/cn";

export function PageHeader({
  title,
  description,
  className,
  action,
  backHref,
  backLabel,
}: {
  title: string;
  description?: string;
  className?: string;
  action?: ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className={cn("mb-4", className)}>
      {backHref ? <BackLink href={backHref} label={backLabel ?? "Back"} /> : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h1 className="font-heading text-lg font-bold tracking-tight text-[var(--color-primary)] sm:text-xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-0.5 max-w-[56ch] text-[12px] leading-snug text-[var(--color-muted)]">{description}</p>
          ) : null}
        </div>
        {action ? <div className="w-full shrink-0 sm:w-auto">{action}</div> : null}
      </div>
    </div>
  );
}
