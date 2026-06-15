/**
 * Maps raw stored events from the DB into the data shape consumed by
 * the Trace component. Keeps the visualization layer ignorant of
 * telemetry storage details.
 */

import type { StoredEvent } from "./features";
import type {
  TraceEvent,
  TraceEventKind,
  TraceAnnotation,
} from "@/components/trace/Trace";
import type { BehaviorTags } from "./prompts/behaviorTagging";

/** Pulled from BehaviorRecorder — keep in sync if event names change. */
const KIND_MAP: Record<string, TraceEventKind> = {
  step_focus: "focus",
  step_blur: "focus",
  answer_change: "edit",
  paste: "paste",
  large_paste: "paste",
  erase: "erase",
  tab_blur: "tab",
  tab_focus: "focus",
  visibility_hidden: "tab",
  idle_threshold: "pause",
  hint_request: "edit",
  code_run: "edit",
  submit: "submit",
};

export function eventsToTraceEvents(
  events: StoredEvent[],
  startedAtMs: number
): TraceEvent[] {
  const out: TraceEvent[] = [];
  for (const e of events) {
    const kind = KIND_MAP[e.type];
    if (!kind) continue;
    let payload: Record<string, unknown> | null = null;
    if (e.payload_json) {
      try {
        payload = JSON.parse(e.payload_json) as Record<string, unknown>;
      } catch {
        payload = null;
      }
    }
    out.push({
      t: Math.max(0, e.ts - startedAtMs),
      kind,
      meta: {
        rawType: e.type,
        stepId: e.step_id,
        payload,
      },
    });
  }
  // Dedup adjacent identical-kind events that landed within 80ms
  const dedup: TraceEvent[] = [];
  for (const ev of out) {
    const last = dedup[dedup.length - 1];
    if (last && last.kind === ev.kind && ev.t - last.t < 80) continue;
    dedup.push(ev);
  }
  return dedup;
}

/**
 * Pick the most analytically interesting moment(s) in the trace, based on
 * the AI's behavior tags. We pin a single marker at the start of the step
 * the tagger flagged as the most struggle-coded — or skip if everything was
 * fluent.
 */
export function pickAnnotations(
  events: StoredEvent[],
  startedAtMs: number,
  tags: BehaviorTags
): TraceAnnotation[] {
  // Rank states by "interestingness"
  const rank: Record<string, number> = {
    stuck: 4,
    confused: 3,
    distracted: 2,
    fluent: 1,
  };
  const flagged = [...(tags.perStep ?? [])].sort(
    (a, b) => (rank[b.state] ?? 0) - (rank[a.state] ?? 0)
  )[0];
  if (!flagged || (rank[flagged.state] ?? 0) < 3) return [];

  // Find first focus on that step
  const firstFocus = events.find(
    (e) => e.step_id === flagged.stepId && e.type === "step_focus"
  );
  if (!firstFocus) return [];

  const stateCaption: Record<string, string> = {
    stuck: "got stuck here",
    confused: "lost the thread",
    distracted: "drifted",
  };

  return [
    {
      t: firstFocus.ts - startedAtMs,
      caption: stateCaption[flagged.state] ?? "look here",
    },
  ];
}
