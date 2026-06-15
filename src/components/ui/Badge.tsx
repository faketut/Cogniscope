import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeTone = "neutral" | "accent" | "success" | "warn" | "danger";

// Badges are restrained — a single hairline + ink text. Tone is encoded by
// the dot, not by a flooded background, so the page never looks candy-coded.
const toneDot: Record<BadgeTone, string> = {
  neutral: "bg-chalk",
  accent: "bg-marker",
  success: "bg-[var(--success)]",
  warn: "bg-[var(--warn)]",
  danger: "bg-[var(--danger)]",
};

export function Badge({
  className,
  tone = "neutral",
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border border-rule bg-surface px-2 py-0.5 font-mono text-[0.6875rem] uppercase tracking-wider text-ink",
        className
      )}
      {...props}
    >
      <span className={cn("inline-block h-1.5 w-1.5 rounded-full", toneDot[tone])} aria-hidden />
      {children}
    </span>
  );
}

