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

// Match the live design tokens. Inlined here so the artifact is self-contained.
const INK = "#13141A";
const VELLUM = "#EDEDE6";
const CHALK = "#9095A0";
const MARKER = "#F4D03F";

interface RenderOpts {
  durationMs: number;
  events: TraceEvent[];
  annotations: TraceAnnotation[];
  title: string;
  subtitle?: string;
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

export function renderTraceSVG({
  durationMs,
  events,
  annotations,
  title,
  subtitle,
  width = 1200,
  height = 600,
}: RenderOpts): string {
  const W = width;
  const H = height;
  const padX = 56;
  const padTop = 200; // room for headline + subtitle + annotation captions
  const padBottom = 96; // baseline + tick labels + footer
  const baselineY = H - padBottom;
  const trackTop = padTop;
  const trackH = baselineY - trackTop;
  const dur = Math.max(1, durationMs);
  const xOf = (t: number) =>
    padX + (Math.max(0, Math.min(dur, t)) / dur) * (W - padX * 2);

  // Tick anchors every 15s, plus 0 and end.
  const ticks: number[] = [0];
  for (let t = 15_000; t < dur; t += 15_000) ticks.push(t);
  ticks.push(dur);

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

  // Headline + subtitle live above the trace; footer brands it.
  const eyebrow = `cogniscope · trace`;
  const meta = `${formatTime(dur)} · ${events.length} events${annotations.length ? ` · ${annotations.length} marker` : ""}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="${VELLUM}"/>

  <!-- Eyebrow -->
  <text x="${padX}" y="56" font-size="13" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" fill="${CHALK}" letter-spacing="2">${esc(eyebrow.toUpperCase())}</text>

  <!-- Title -->
  <text x="${padX}" y="100" font-size="36" font-family="Georgia, 'Times New Roman', serif" fill="${INK}" font-weight="500">${esc(title)}</text>

  <!-- Subtitle -->
  ${subtitle ? `<text x="${padX}" y="126" font-size="15" font-family="Georgia, 'Times New Roman', serif" fill="#5A5D67">${esc(subtitle)}</text>` : ""}

  <!-- Right-aligned meta -->
  <text x="${W - padX}" y="56" text-anchor="end" font-size="13" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" fill="${CHALK}" letter-spacing="1">${esc(meta)}</text>

  <!-- Baseline -->
  <line x1="${padX}" y1="${baselineY}" x2="${W - padX}" y2="${baselineY}" stroke="${INK}" stroke-width="1.2" opacity="0.9"/>

  ${tickMarks}
  ${eventTicks}
  ${annoEls}

  <!-- Footer brand -->
  <text x="${padX}" y="${H - 28}" font-size="12" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" fill="${CHALK}" letter-spacing="2">COGNISCOPE.LOCAL</text>
</svg>`;
}
