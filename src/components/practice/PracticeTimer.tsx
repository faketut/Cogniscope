"use client";

import { useEffect, useRef, useState } from "react";
import { formatDuration } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface Props {
  startedAt: number | null;
  /** Optional hard cap in milliseconds. When elapsed >= maxMs, onExpire fires once. */
  maxMs?: number;
  /** Called exactly once when the cap is reached. */
  onExpire?: () => void;
}

export function PracticeTimer({ startedAt, maxMs, onExpire }: Props) {
  const [now, setNow] = useState(Date.now());
  const firedRef = useRef(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!startedAt || !maxMs || !onExpire || firedRef.current) return;
    if (now - startedAt >= maxMs) {
      firedRef.current = true;
      onExpire();
    }
  }, [now, startedAt, maxMs, onExpire]);

  if (!startedAt) return <span className="font-mono">—</span>;

  const elapsed = now - startedAt;

  if (!maxMs) {
    return (
      <span className="font-mono tabular-nums">{formatDuration(elapsed)}</span>
    );
  }

  const remaining = Math.max(0, maxMs - elapsed);
  const warning = remaining <= 60_000 && remaining > 0;
  const expired = remaining === 0;

  return (
    <span
      className={cn(
        "font-mono tabular-nums",
        warning && "text-amber-600 dark:text-amber-400",
        expired && "text-red-600 dark:text-red-400"
      )}
      title={`Elapsed ${formatDuration(elapsed)} of ${formatDuration(maxMs)} cap`}
    >
      {formatDuration(elapsed)} / {formatDuration(maxMs)}
      {warning && !expired ? " · time low" : ""}
      {expired ? " · time up" : ""}
    </span>
  );
}
