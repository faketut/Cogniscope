"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Microscope, Sparkles, Zap } from "lucide-react";

const STEPS = [
  { label: "Extracting features", icon: Microscope },
  { label: "Tagging behavior", icon: Zap },
  { label: "Diagnosing root causes", icon: Sparkles },
  { label: "Writing your report", icon: Sparkles },
];

export default function AnalysisPage({
  params,
}: {
  params: { sessionId: string };
}) {
  const router = useRouter();
  const [phase, setPhase] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const triggered = useRef(false);

  useEffect(() => {
    if (triggered.current) return;
    triggered.current = true;

    const ticker = setInterval(() => {
      setPhase((p) => Math.min(p + 1, STEPS.length - 1));
    }, 1200);

    (async () => {
      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId: params.sessionId }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `analyze failed (${res.status})`);
        }
        clearInterval(ticker);
        router.replace(`/report/${params.sessionId}`);
      } catch (err: unknown) {
        clearInterval(ticker);
        setError((err as Error).message);
      }
    })();

    return () => clearInterval(ticker);
  }, [params.sessionId, router]);

  return (
    <div className="mx-auto max-w-md px-6 py-24 text-center">
      <div className="relative mx-auto mb-8 inline-flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft">
        <Loader2 className="absolute inset-0 m-auto h-14 w-14 animate-spin text-accent/30" />
        <Microscope className="h-6 w-6 text-accent" />
      </div>
      <h1 className="font-serif text-2xl tracking-tight">
        Analyzing your session
      </h1>
      <p className="mt-2 font-mono text-sm text-text-3">
        #{params.sessionId}
      </p>

      <ul className="mt-10 space-y-2 text-left">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const done = i < phase;
          const active = i === phase;
          return (
            <li
              key={s.label}
              className="flex items-center gap-3 rounded-md border border-border bg-surface px-3 py-2.5 text-sm"
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                  done
                    ? "bg-success/15 text-success"
                    : active
                      ? "bg-accent-soft text-accent"
                      : "bg-surface-2 text-text-3"
                }`}
              >
                {active ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Icon size={12} />
                )}
              </span>
              <span
                className={
                  done
                    ? "text-text-2 line-through"
                    : active
                      ? "text-text-1"
                      : "text-text-3"
                }
              >
                {s.label}
              </span>
            </li>
          );
        })}
      </ul>

      {error && (
        <div className="mt-6 rounded-md border border-danger/40 bg-danger/10 px-4 py-3 text-left text-sm text-danger">
          {error}
        </div>
      )}
    </div>
  );
}
