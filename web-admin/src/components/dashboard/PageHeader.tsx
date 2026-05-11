import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function PageHeader({
  title,
  description,
  className,
  action,
}: {
  title: string;
  description?: string;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <div className={cn("mb-7 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between sm:gap-6", className)}>
      <div className="min-w-0">
        <h1 className="font-heading text-[1.35rem] font-bold tracking-tight text-[var(--color-primary)] sm:text-[1.65rem]">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-[62ch] text-[13px] leading-relaxed text-[var(--color-muted)] sm:text-[14px]">{description}</p>
        ) : null}
      </div>
      {action ? <div className="w-full shrink-0 sm:w-auto sm:max-w-md">{action}</div> : null}
    </div>
  );
}
