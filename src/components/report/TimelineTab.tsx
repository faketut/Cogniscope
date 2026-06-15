"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { formatDuration } from "@/lib/utils";
import type { FeatureSet, StepFeature } from "@/lib/features";
import type { BehaviorTags } from "@/lib/prompts/behaviorTagging";

interface Props {
  features: FeatureSet;
  tags: BehaviorTags;
  activeStepId?: string | null;
}

// Monochrome encoding: state determines OPACITY of the ink bar, not its color.
// Marker yellow is reserved for the genuinely interesting moment (stuck).
const STATE_OPACITY: Record<string, number> = {
  fluent: 0.85,
  hesitant: 0.55,
  stuck: 1.0,
  error: 1.0,
  unknown: 0.3,
};

const STATE_TONE: Record<string, "neutral" | "success" | "warn" | "danger"> = {
  fluent: "success",
  hesitant: "warn",
  stuck: "danger",
  error: "danger",
  unknown: "neutral",
};

export function TimelineTab({ features, tags, activeStepId }: Props) {
  const stepTagMap = useMemo(() => {
    const map = new Map<string, BehaviorTags["perStep"][number]>();
    for (const s of tags.perStep) map.set(s.stepId, s);
    return map;
  }, [tags.perStep]);

  const total = Math.max(1, features.durationMs);

  const rows = features.steps.map((s) => {
    const tag = stepTagMap.get(s.stepId);
    const state = tag?.state ?? inferState(s);
    return { step: s, tag, state };
  });

  return (
    <div className="space-y-10">
      <section>
        <div className="flex items-baseline justify-between border-b border-ink pb-2">
          <h2 className="font-display-tight text-2xl">Step by step</h2>
          <span className="eyebrow tabular-nums">
            total {formatDuration(features.durationMs)}
          </span>
        </div>

        <div className="mt-1">
          {rows.length === 0 && (
            <p className="py-6 text-sm text-chalk">No step data captured.</p>
          )}
          {rows.map(({ step, state, tag }, idx) => (
            <TimelineRow
              key={step.stepId}
              index={idx}
              step={step}
              state={state}
              note={tag?.note}
              totalMs={total}
              isActive={activeStepId === step.stepId}
            />
          ))}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-x-8 gap-y-6 border-y border-rule py-7 sm:grid-cols-4">
        <Stat label="total time" value={formatDuration(features.durationMs)} />
        <Stat label="edits" value={String(features.editsTotal)} />
        <Stat label="idle" value={`${Math.round(features.idleRatio * 100)}%`} />
        <Stat label="paste" value={String(features.pasteCount)} />
      </section>
    </div>
  );
}

function TimelineRow({
  index,
  step,
  state,
  note,
  totalMs,
  isActive,
}: {
  index: number;
  step: StepFeature;
  state: string;
  note?: string;
  totalMs: number;
  isActive: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  // When this row becomes active (Trace tick clicked), scroll to it.
  useEffect(() => {
    if (isActive && ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [isActive]);
  const widthPct = Math.max(2, Math.min(100, (step.dwellMs / totalMs) * 100));
  const opacity = STATE_OPACITY[state] ?? STATE_OPACITY.unknown;
  const isMarked = state === "stuck" || state === "error";

  const correctness =
    step.finalCorrect == null
      ? null
      : step.finalCorrect
        ? "correct"
        : "wrong";

  return (
    <div
      ref={ref}
      className={
        "group border-b border-rule py-4 transition-colors " +
        (isActive
          ? "bg-marker/15 ring-1 ring-marker/60"
          : "hover:bg-surface")
      }
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-3 text-sm">
          <span className="font-mono tabular-nums text-chalk">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="text-ink">{step.prompt.slice(0, 80)}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {correctness === "correct" && <Badge tone="success">correct</Badge>}
          {correctness === "wrong" && <Badge tone="danger">wrong</Badge>}
          <span className="font-mono text-xs tabular-nums text-chalk">
            {formatDuration(step.dwellMs)}
          </span>
        </div>
      </div>

      {/* Dwell bar — ink, opacity-encoded. Marker dot if AI flagged this step. */}
      <div className="relative mt-3 flex h-2 items-center">
        <div
          className="h-full bg-ink transition-all"
          style={{ width: `${widthPct}%`, opacity }}
        />
        {isMarked && (
          <span
            className="ml-2 inline-block h-2 w-2 rounded-full bg-marker"
            style={{ outline: "1px solid var(--ink)" }}
            aria-label="AI marked this step"
          />
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-chalk">
        <Badge tone={STATE_TONE[state]}>{state}</Badge>
        {step.editCount > 0 && <span>edits {step.editCount}</span>}
        {step.pasteCount > 0 && <span>· pastes {step.pasteCount}</span>}
        {step.hintRequested && <span>· hint used</span>}
        {step.firstAttemptCorrect === false && step.finalCorrect && (
          <span>· corrected after first try</span>
        )}
      </div>

      {note && hovered && (
        <p
          className="mt-3 border-l-2 border-marker py-1 pl-3 font-display-tight text-sm italic text-graphite"
          aria-live="polite"
        >
          “{note}”
        </p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <p className="mt-1.5 font-mono text-2xl tabular-nums text-ink">{value}</p>
    </div>
  );
}

function inferState(s: StepFeature): "fluent" | "hesitant" | "stuck" | "error" {
  if (s.finalCorrect === false) return "error";
  if (s.editCount >= 4 || s.dwellMs > 60_000) return "stuck";
  if (s.editCount >= 2) return "hesitant";
  return "fluent";
}

