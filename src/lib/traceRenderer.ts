/**
 * Server-side rendering of the Trace as a stand-alone SVG document.
 *
 * Keeps the same visual vocabulary as the live <Trace> component but
 * inlines colors and fonts so the artifact is portable (Twitter, Slack,
 * a saved PNG). No React, no client runtime — pure string assembly.
 */

import type { TraceEvent, TraceAnnotation } from "@/components/trace/Trace";

const KIND_WEIGHT: Record<string, number> = {
  paste: 1.0,
  submit: 1.0,
  focus: 0.95,
  edit: 0.75,
  erase: 0.45,
  tab: 0.45,
  pause: 0.18,
};
const KIND_HEIGHT: Record<string, number> = {
  paste: 0.95,
  submit: 1.0,
  focus: 0.85,
  edit: 0.6,
  erase: 0.5,
  tab: 0.4,
  pause: 0.25,
};
const KIND_WIDTH: Record<string, number> = {
  paste: 3,
  submit: 3,
  focus: 2,
  edit: 1.5,
  erase: 2,
  tab: 1,
  pause: 1,
};
// Legend order — most narrative-relevant kinds first so the reader's eye
// lands on the marks that matter (a paste or a submit tells a story; a
// pause is contextual).
const LEGEND_ORDER: TraceEvent["kind"][] = [
  "submit",
  "paste",
  "edit",
  "erase",
  "focus",
  "tab",
  "pause",
];
const KIND_LABEL: Record<TraceEvent["kind"], string> = {
  submit: "submit",
  paste: "paste",
  edit: "typing",
  erase: "erase",
  focus: "focus",
  tab: "tab-away",
  pause: "pause",
};

// Match the live design tokens. Inlined here so the artifact is self-contained.
const INK = "#13141A";
const VELLUM = "#EDEDE6";
const CHALK = "#9095A0";
const MARKER = "#F4D03F";
const SUCCESS = "#2E7D5B";
const DANGER = "#B23A48";

export type TraceOutcome = "correct" | "incorrect" | "submitted" | "in-progress";

interface RenderOpts {
  durationMs: number;
  events: TraceEvent[];
  annotations: TraceAnnotation[];
  title: string;
  subtitle?: string;
  /** Outcome chip rendered in the header. */
  outcome?: TraceOutcome;
  /** A one-sentence takeaway from the diagnosis, italicized under the subtitle. */
  takeaway?: string;
  /** Output canvas in px. Aspect is fixed at 2:1 for nice OG-card framing. */
  width?: number;
  height?: number;
}

function formatTime(ms: number): string {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Truncate to N chars on a word boundary, with ellipsis. */
function clip(s: string, n: number): string {
  const t = s.trim();
  if (t.length <= n) return t;
  const cut = t.slice(0, n);
  const sp = cut.lastIndexOf(" ");
  return (sp > n * 0.6 ? cut.slice(0, sp) : cut).replace(/[.,;:!?]*$/, "") + "…";
}

export function renderTraceSVG({
  durationMs,
  events,
  annotations,
  title,
  subtitle,
  outcome,
  takeaway,
  width = 1200,
  height = 700,
}: RenderOpts): string {
  const W = width;
  const H = height;
  const padX = 56;
  // Bigger top pad if we have a takeaway sentence to render under the subtitle.
  const padTop = takeaway ? 240 : 200;
  // Bigger bottom pad to make room for the legend strip above the footer.
  const padBottom = 150;
  const baselineY = H - padBottom;
  const trackTop = padTop;
  const trackH = baselineY - trackTop;
  const dur = Math.max(1, durationMs);
  const xOf = (t: number) =>
    padX + (Math.max(0, Math.min(dur, t)) / dur) * (W - padX * 2);

  // Tick anchors every 15s, plus 0 and end. Drop the end tick if it lands
  // within 10s of the last 15s tick to avoid overlapping labels.
  const ticks: number[] = [0];
  for (let t = 15_000; t < dur; t += 15_000) ticks.push(t);
  if (dur - ticks[ticks.length - 1] > 10_000) ticks.push(dur);

  const tickMarks = ticks
    .map((t) => {
      const x = xOf(t).toFixed(1);
      return `<g><line x1="${x}" y1="${baselineY - 4}" x2="${x}" y2="${baselineY + 4}" stroke="${INK}" stroke-width="1" opacity="0.4"/><text x="${x}" y="${baselineY + 22}" text-anchor="middle" font-size="13" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" fill="${CHALK}">${formatTime(t)}</text></g>`;
    })
    .join("");

  const eventTicks = events
    .map((e) => {
      const x = xOf(e.t);
      const w = KIND_WIDTH[e.kind] ?? 1.5;
      const h = trackH * (KIND_HEIGHT[e.kind] ?? 0.5);
      const op = KIND_WEIGHT[e.kind] ?? 0.5;
      return `<rect x="${(x - w / 2).toFixed(1)}" y="${(baselineY - h).toFixed(1)}" width="${w}" height="${h.toFixed(1)}" fill="${INK}" opacity="${op}"/>`;
    })
    .join("");

  const annoEls = annotations
    .map((a) => {
      const x = xOf(a.t).toFixed(1);
      const caption = esc(a.caption);
      return `<g>
  <circle cx="${x}" cy="${baselineY}" r="13" fill="${MARKER}" opacity="0.32"/>
  <circle cx="${x}" cy="${baselineY}" r="7" fill="${MARKER}" stroke="${INK}" stroke-width="1.2"/>
  <line x1="${x}" y1="${trackTop - 4}" x2="${x}" y2="${baselineY - 10}" stroke="${MARKER}" stroke-width="2" opacity="0.9"/>
  <text x="${x}" y="${trackTop - 14}" text-anchor="middle" font-size="15" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" fill="${INK}" font-weight="500">${caption}</text>
</g>`;
    })
    .join("");

  // ── Legend: tiny swatch + label + count for each event kind seen. ──────
  // We render the swatch with the same encoding the timeline uses, so the
  // viewer can map "this short narrow tick = pause" without a separate key.
  const counts: Record<string, number> = {};
  for (const e of events) counts[e.kind] = (counts[e.kind] ?? 0) + 1;
  const legendItems = LEGEND_ORDER.filter((k) => (counts[k] ?? 0) > 0);
  const legendY = H - 84; // top of swatch row
  const swatchMaxH = 28; // visual height for tallest legend swatch
  // Distribute items evenly across the available width.
  const legendStartX = padX;
  const legendW = W - padX * 2;
  const slotW = legendItems.length > 0 ? legendW / legendItems.length : 0;
  const legendEls = legendItems
    .map((k, i) => {
      const cx = legendStartX + slotW * i + slotW / 2;
      const w = Math.max(3, (KIND_WIDTH[k] ?? 1.5) * 2.2); // upscale so it's legible
      const h = swatchMaxH * (KIND_HEIGHT[k] ?? 0.5);
      const op = KIND_WEIGHT[k] ?? 0.5;
      const swatchX = cx - 60;
      const swatchY = legendY + (swatchMaxH - h);
      const labelX = cx - 50;
      const labelY = legendY + swatchMaxH / 2 + 5;
      const count = counts[k] ?? 0;
      return `<g>
  <rect x="${swatchX.toFixed(1)}" y="${swatchY.toFixed(1)}" width="${w}" height="${h.toFixed(1)}" fill="${INK}" opacity="${op}"/>
  <text x="${labelX}" y="${labelY}" font-size="13" font-family="Georgia, 'Times New Roman', serif" fill="${INK}">${esc(KIND_LABEL[k])}</text>
  <text x="${labelX}" y="${labelY + 16}" font-size="11" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" fill="${CHALK}" letter-spacing="1">${count} ${count === 1 ? "EVENT" : "EVENTS"}</text>
</g>`;
    })
    .join("");

  // ── Outcome chip: small filled rectangle next to the meta. ─────────────
  let outcomeChip = "";
  if (outcome) {
    const palette: Record<TraceOutcome, { bg: string; fg: string; label: string }> = {
      correct: { bg: SUCCESS, fg: VELLUM, label: "CORRECT" },
      incorrect: { bg: DANGER, fg: VELLUM, label: "INCORRECT" },
      submitted: { bg: INK, fg: VELLUM, label: "SUBMITTED" },
      "in-progress": { bg: VELLUM, fg: INK, label: "IN PROGRESS" },
    };
    const p = palette[outcome];
    const chipW = 110;
    const chipH = 22;
    const chipX = W - padX - chipW;
    const chipY = 38;
    outcomeChip = `<g>
  <rect x="${chipX}" y="${chipY}" width="${chipW}" height="${chipH}" fill="${p.bg}" stroke="${INK}" stroke-width="${outcome === "in-progress" ? 1 : 0}"/>
  <text x="${chipX + chipW / 2}" y="${chipY + chipH / 2 + 4}" text-anchor="middle" font-size="11" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" fill="${p.fg}" letter-spacing="2" font-weight="500">${p.label}</text>
</g>`;
  }

  // Headline + subtitle live above the trace; footer brands it.
  const eyebrow = `cogniscope · trace`;
  const meta = `${formatTime(dur)} · ${events.length} events${annotations.length ? ` · ${annotations.length} marker` : ""}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="${VELLUM}"/>

  <!-- Eyebrow -->
  <text x="${padX}" y="56" font-size="13" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" fill="${CHALK}" letter-spacing="2">${esc(eyebrow.toUpperCase())}</text>

  <!-- Title -->
  <text x="${padX}" y="100" font-size="36" font-family="Georgia, 'Times New Roman', serif" fill="${INK}" font-weight="500">${esc(clip(title, 60))}</text>

  <!-- Subtitle -->
  ${subtitle ? `<text x="${padX}" y="126" font-size="15" font-family="Georgia, 'Times New Roman', serif" fill="#5A5D67">${esc(subtitle)}</text>` : ""}

  <!-- Takeaway: the one line that gives a stranger context for the marks -->
  ${takeaway ? `<text x="${padX}" y="172" font-size="17" font-family="Georgia, 'Times New Roman', serif" fill="${INK}" font-style="italic">“${esc(clip(takeaway, 120))}”</text>` : ""}

  <!-- Right-aligned outcome chip + meta -->
  ${outcomeChip}
  <text x="${W - padX}" y="${outcome ? 82 : 56}" text-anchor="end" font-size="13" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" fill="${CHALK}" letter-spacing="1">${esc(meta)}</text>

  <!-- Baseline -->
  <line x1="${padX}" y1="${baselineY}" x2="${W - padX}" y2="${baselineY}" stroke="${INK}" stroke-width="1.2" opacity="0.9"/>

  ${tickMarks}
  ${eventTicks}
  ${annoEls}

  <!-- Legend separator + items -->
  <line x1="${padX}" y1="${legendY - 18}" x2="${W - padX}" y2="${legendY - 18}" stroke="${INK}" stroke-width="0.5" opacity="0.25"/>
  <text x="${padX}" y="${legendY - 24}" font-size="11" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" fill="${CHALK}" letter-spacing="2">LEGEND</text>
  ${legendEls}

  <!-- Footer brand -->
  <text x="${padX}" y="${H - 28}" font-size="12" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" fill="${CHALK}" letter-spacing="2">COGNISCOPE.LOCAL</text>
</svg>`;
}

