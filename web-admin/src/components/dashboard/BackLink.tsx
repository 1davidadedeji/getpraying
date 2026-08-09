import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/cn";

export function BackLink({ href, label, className }: { href: string; label: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "mb-3 inline-flex items-center gap-1 text-[12px] font-medium text-muted transition-colors hover:text-primary",
        className,
      )}
    >
      <ChevronLeft className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
      {label}
    </Link>
  );
}
