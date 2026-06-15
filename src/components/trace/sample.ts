/**
 * Sample trace data for the home hero. Lives outside the client-marked
 * Trace component so that a server component can import it as plain data.
 */

import type { TraceEvent, TraceAnnotation } from "./Trace";

export const SAMPLE_TRACE: {
  durationMs: number;
  events: TraceEvent[];
  annotations: TraceAnnotation[];
} = {
  durationMs: 92_000,
  events: [
    { t: 1_200, kind: "focus", label: "begin" },
    { t: 3_400, kind: "edit" },
    { t: 5_100, kind: "edit" },
    { t: 9_200, kind: "edit" },
    { t: 14_000, kind: "pause" },
    { t: 18_500, kind: "erase" },
    { t: 21_200, kind: "edit" },
    { t: 24_800, kind: "erase", label: "tried again" },
    { t: 28_000, kind: "edit" },
    { t: 31_100, kind: "pause" },
    { t: 34_300, kind: "tab", label: "googled" },
    { t: 41_700, kind: "focus" },
    { t: 44_900, kind: "edit" },
    { t: 47_100, kind: "edit" },
    { t: 49_800, kind: "edit" },
    { t: 53_400, kind: "pause" },
    { t: 58_100, kind: "edit" },
    { t: 62_800, kind: "edit" },
    { t: 66_500, kind: "edit" },
    { t: 70_000, kind: "edit" },
    { t: 74_200, kind: "edit" },
    { t: 78_900, kind: "edit" },
    { t: 84_300, kind: "edit" },
    { t: 89_400, kind: "submit", label: "submit" },
  ],
  annotations: [{ t: 24_800, caption: "abandoned first approach" }],
};
