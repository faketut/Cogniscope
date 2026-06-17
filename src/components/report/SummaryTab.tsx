"use client";

import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Trace, TraceLegend } from "@/components/trace/Trace";
import { formatDuration } from "@/lib/utils";
import type { FeatureSet } from "@/lib/features";
import type { BehaviorTags } from "@/lib/prompts/behaviorTagging";
import type { Diagnosis } from "@/lib/prompts/diagnosis";
import type { TraceEvent, TraceAnnotation } from "@/components/trace/Trace";

interface Props {
  features: FeatureSet;
  tags: BehaviorTags;
  diagnosis: Diagnosis;
  feedback: string;
  traceEvents: TraceEvent[];
  annotations: TraceAnnotation[];
  onTraceEventClick?: (event: TraceEvent, index: number) => void;
}

const STRATEGY_LABEL: Record<BehaviorTags["strategy"], string> = {
  systematic: "Systematic",
  trial_and_error: "Trial & error",
  pattern_matching: "Pattern matching",
  skip_and_guess: "Skip & guess",
  external_reference: "External lookup",
};

const STATE_LABEL: Record<BehaviorTags["cognitiveState"], string> = {
  fluent: "Fluent",
  stuck: "Stuck",
  confused: "Confused",
  distracted: "Distracted",
};

export function SummaryTab({
  features,
  tags,
  diagnosis,
  feedback,
  traceEvents,
  annotations,
  onTraceEventClick,
}: Props) {
  return (
    <div className="space-y-12">
      {/* ──────────────────────────────────────────────────────────────────
          THE TRACE — spine of the report
          ────────────────────────────────────────────────────────────────── */}
      <section>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
          <p className="eyebrow">your session, end to end</p>
          <p className="eyebrow tabular-nums">
            {formatDuration(features.durationMs)} ·{" "}
            {traceEvents.length} events
            {annotations.length > 0 && ` · ${annotations.length} marker`}
          </p>
        </div>
        <div className="mt-3 border border-rule bg-surface px-4 py-5 sm:px-6 sm:py-6">
          <Trace
            durationMs={features.durationMs || 1}
            events={traceEvents}
            annotations={annotations}
            height={180}
            animate
            onEventClick={onTraceEventClick}
          />
        </div>
        <div className="mt-3 flex items-baseline justify-between gap-4">
          <TraceLegend />
          {onTraceEventClick && (
            <p className="hidden font-mono text-[11px] text-chalk sm:block">
              hover a tick · click to jump to its step
            </p>
          )}
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────────────
          AT A GLANCE — a sentence the trace can't say on its own
          ────────────────────────────────────────────────────────────────── */}
      <section className="grid grid-cols-2 gap-x-8 gap-y-6 border-y border-rule py-7 sm:grid-cols-4">
        <Glance label="state" value={STATE_LABEL[tags.cognitiveState]} />
        <Glance label="strategy" value={STRATEGY_LABEL[tags.strategy]} />
        <Glance label="idle" value={`${Math.round(features.idleRatio * 100)}%`} mono />
        <Glance label="edits" value={String(features.editsTotal)} mono />
      </section>

      {/* ──────────────────────────────────────────────────────────────────
          THE READING — Fraunces letter from the tutor
          ────────────────────────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 gap-x-12 gap-y-8 sm:grid-cols-12">
        <div className="sm:col-span-3">
          <p className="eyebrow">a reading</p>
          <p className="mt-2 font-display-tight text-base text-graphite">
            What the trace says about your reasoning.
          </p>
        </div>
        <article className="prose-feedback sm:col-span-9">
          <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
            {feedback}
          </ReactMarkdown>
        </article>
      </section>

      {/* ──────────────────────────────────────────────────────────────────
          STRENGTHS — only when present
          ────────────────────────────────────────────────────────────────── */}
      {diagnosis.strengths && diagnosis.strengths.length > 0 && (
        <section className="grid grid-cols-1 gap-x-12 gap-y-4 border-t border-rule pt-8 sm:grid-cols-12">
          <div className="sm:col-span-3">
            <p className="eyebrow">what worked</p>
          </div>
          <ul className="sm:col-span-9 space-y-2 font-display-tight text-lg text-ink">
            {diagnosis.strengths.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="font-mono text-chalk tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Glance({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <p
        className={
          mono
            ? "mt-1.5 font-mono text-2xl tabular-nums text-ink"
            : "mt-1.5 font-display-tight text-2xl leading-tight text-ink"
        }
      >
        {value}
      </p>
    </div>
  );
}
