"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { SummaryTab } from "./SummaryTab";
import { TimelineTab } from "./TimelineTab";
import { ChatTab } from "./ChatTab";
import { ReplayTab } from "./ReplayTab";
import type { FeatureSet } from "@/lib/features";
import type { BehaviorTags } from "@/lib/prompts/behaviorTagging";
import type { Diagnosis } from "@/lib/prompts/diagnosis";
import type { TraceEvent, TraceAnnotation } from "@/components/trace/Trace";

interface Props {
  sessionId: string;
  features: FeatureSet;
  tags: BehaviorTags;
  diagnosis: Diagnosis;
  feedback: string;
  traceEvents: TraceEvent[];
  annotations: TraceAnnotation[];
}

const TABS = [
  { id: "summary", label: "Reading" },
  { id: "timeline", label: "By step" },
  { id: "replay", label: "Replay" },
  { id: "chat", label: "Tutor" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function ReportTabs(props: Props) {
  const [tab, setTab] = useState<TabId>("summary");
  // When the trace is clicked on the Summary tab, we lift state up here so
  // the Timeline tab can scroll to and briefly highlight that step.
  const [activeStepId, setActiveStepId] = useState<string | null>(null);

  // Map a click on a trace event to a stepId by finding the step whose first
  // focus came at-or-before the event time. Steps are ordered by firstFocusTs.
  const stepsByFocus = [...props.features.steps]
    .filter((s) => s.firstFocusTs != null)
    .sort((a, b) => (a.firstFocusTs ?? 0) - (b.firstFocusTs ?? 0));
  const sessionStart =
    stepsByFocus.length > 0 ? (stepsByFocus[0].firstFocusTs ?? 0) : 0;

  const handleTraceClick = (ev: TraceEvent) => {
    // Prefer the explicit stepId on the event if present.
    let stepId = ev.meta?.stepId ?? null;
    if (!stepId) {
      const tAbs = (ev.t ?? 0) + sessionStart;
      for (const s of stepsByFocus) {
        if ((s.firstFocusTs ?? 0) <= tAbs) stepId = s.stepId;
        else break;
      }
    }
    if (!stepId) return;
    setActiveStepId(stepId);
    setTab("timeline");
  };

  // Clear the highlight a beat after switching (the row will pulse, then rest).
  useEffect(() => {
    if (!activeStepId) return;
    const t = setTimeout(() => setActiveStepId(null), 2200);
    return () => clearTimeout(t);
  }, [activeStepId]);

  return (
    <div className="mt-8">
      <div
        role="tablist"
        aria-label="Report sections"
        className="flex items-baseline gap-6 border-b border-rule"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "relative -mb-px py-2.5 font-display-tight text-base transition-colors",
              tab === t.id
                ? "text-ink"
                : "text-chalk hover:text-graphite"
            )}
          >
            {t.label}
            {tab === t.id && (
              <span className="absolute inset-x-0 -bottom-px h-[2px] bg-ink" />
            )}
          </button>
        ))}
      </div>

      <div className="mt-8 animate-fade-up">
        {tab === "summary" && (
          <SummaryTab
            features={props.features}
            tags={props.tags}
            diagnosis={props.diagnosis}
            feedback={props.feedback}
            traceEvents={props.traceEvents}
            annotations={props.annotations}
            onTraceEventClick={handleTraceClick}
          />
        )}
        {tab === "timeline" && (
          <TimelineTab
            features={props.features}
            tags={props.tags}
            activeStepId={activeStepId}
          />
        )}
        {tab === "replay" && <ReplayTab sessionId={props.sessionId} />}
        {tab === "chat" && (
          <ChatTab sessionId={props.sessionId} />
        )}
      </div>
    </div>
  );
}
