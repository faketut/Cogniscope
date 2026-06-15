"use client";

/**
 * Trace — the signature visual of Cogniscope.
 *
 * A horizontal time-strip of a problem-solving session, drawn as ink ticks
 * of varying opacity on a vellum baseline. One yellow `marker` dot per
 * session is the AI's "look here" annotation. All labels are Plex Mono.
 *
 * The trace is intentionally the only "loud" object in the product.
 */

import { useMemo, useState } from "react";

export type TraceEventKind =
  | "focus" // started a step / came back from a tab switch
  | "edit" // typed / changed something
  | "paste" // pasted content (loud)
  | "erase" // backspaced > 3 chars / reversed a previous answer
  | "pause" // no input for > 4s (quiet)
  | "tab" // tab-switched away
  | "submit"; // final answer submitted

export interface TraceEvent {
  /** ms from session start */
  t: number;
  kind: TraceEventKind;
  /** Optional caption shown as Plex Mono label below the tick */
  label?: string;
  /**
   * Optional metadata for interactive surfaces (tooltip / click-through).
   * Not used by the static render.
   */
  meta?: {
    rawType?: string;
    stepId?: string | null;
    payload?: Record<string, unknown> | null;
  };
}

export interface TraceAnnotation {
  /** ms from session start */
  t: number;
  /** Short caption rendered above the marker dot */
  caption: string;
}

export interface TraceProps {
  /** Total session length in ms (defines the x-axis range) */
  durationMs: number;
  events: TraceEvent[];
  /** AI-placed "look here" marker(s) — keep to 1 for max impact */
  annotations?: TraceAnnotation[];
  /** Height of the strip in px (default 168) */
  height?: number;
  /** Apply the entrance animation (false for static screenshots) */
  animate?: boolean;
  /** Extra className for the outer wrapper */
  className?: string;
  /** Click handler for an event tick (interactive mode) */
  onEventClick?: (event: TraceEvent, index: number) => void;
}

// Opacity-encoded event weight — see /memories/repo/design.md
const KIND_WEIGHT: Record<TraceEventKind, number> = {
  paste: 1.0,
  submit: 1.0,
  focus: 0.95,
  edit: 0.75,
  erase: 0.45,
  tab: 0.45,
  pause: 0.18,
};

const KIND_HEIGHT: Record<TraceEventKind, number> = {
  paste: 0.95,
  submit: 1.0,
  focus: 0.85,
  edit: 0.6,
  erase: 0.5,
  tab: 0.4,
  pause: 0.25,
};

const KIND_WIDTH: Record<TraceEventKind, number> = {
  paste: 3,
  submit: 3,
  focus: 2,
  edit: 1.5,
  erase: 2,
  tab: 1,
  pause: 1,
};

function formatTime(ms: number): string {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function Trace({
  durationMs,
  events,
  annotations = [],
  height = 168,
  animate = true,
  className,
  onEventClick,
}: TraceProps) {
  const W = 1000; // viewBox width, scales fluidly via preserveAspectRatio
  const H = height;
  const padX = 8;
  const padY = 24;
  const baselineY = H - padY;
  const trackTop = padY;
  const trackH = baselineY - trackTop;
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const interactive = !!onEventClick;

  // X-position for a given timestamp
  const xOf = (t: number) => padX + (Math.max(0, Math.min(durationMs, t)) / durationMs) * (W - padX * 2);

  // Tick anchors along the baseline — every 15s, plus 0 and end
  const ticks = useMemo(() => {
    const arr: number[] = [0];
    const step = 15_000;
    for (let t = step; t < durationMs; t += step) arr.push(t);
    arr.push(durationMs);
    return arr;
  }, [durationMs]);

  return (
    <figure className={className} style={{ position: "relative" }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="block h-full w-full"
        role="img"
        aria-label="A trace of a problem-solving session"
      >
        {/* Baseline */}
        <line
          x1={padX}
          y1={baselineY}
          x2={W - padX}
          y2={baselineY}
          stroke="var(--ink)"
          strokeWidth={1}
          opacity={0.9}
          style={
            animate
              ? {
                  strokeDasharray: 1000,
                  animation: "trace-draw 1100ms cubic-bezier(0.22, 0.61, 0.36, 1) both",
                }
              : undefined
          }
        />

        {/* Tick anchors with timestamps */}
        {ticks.map((t, i) => (
          <g key={`tick-${i}`}>
            <line
              x1={xOf(t)}
              y1={baselineY - 3}
              x2={xOf(t)}
              y2={baselineY + 3}
              stroke="var(--ink)"
              strokeWidth={1}
              opacity={0.4}
            />
            <text
              x={xOf(t)}
              y={baselineY + 16}
              textAnchor="middle"
              fontSize={10}
              fontFamily="var(--font-mono), monospace"
              fill="var(--chalk)"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {formatTime(t)}
            </text>
          </g>
        ))}

        {/* Event ticks — drawn from baseline upward */}
        {events.map((e, i) => {
          const x = xOf(e.t);
          const w = KIND_WIDTH[e.kind];
          const h = trackH * KIND_HEIGHT[e.kind];
          const op = KIND_WEIGHT[e.kind];
          const delay = animate ? 80 + (e.t / durationMs) * 1100 : 0;
          const isHover = hoverIdx === i;
          return (
            <g key={`ev-${i}`}>
              <rect
                x={x - w / 2}
                y={baselineY - h}
                width={w}
                height={h}
                fill={isHover ? "var(--marker)" : "var(--ink)"}
                opacity={isHover ? 1 : op}
                style={
                  animate
                    ? {
                        transformOrigin: `${x}px ${baselineY}px`,
                        animation: `trace-tick 280ms cubic-bezier(0.22, 0.61, 0.36, 1) both`,
                        animationDelay: `${delay}ms`,
                      }
                    : undefined
                }
              />
              {interactive && (
                <rect
                  x={x - 6}
                  y={trackTop}
                  width={12}
                  height={trackH}
                  fill="transparent"
                  style={{ cursor: "pointer" }}
                  onMouseEnter={() => setHoverIdx(i)}
                  onMouseLeave={() => setHoverIdx((prev) => (prev === i ? null : prev))}
                  onClick={() => onEventClick?.(e, i)}
                  role="button"
                  aria-label={`${e.kind} at ${formatTime(e.t)}`}
                />
              )}
              {e.label && (
                <text
                  x={x}
                  y={baselineY - h - 6}
                  textAnchor="middle"
                  fontSize={9.5}
                  fontFamily="var(--font-mono), monospace"
                  fill="var(--graphite)"
                  style={{
                    fontVariantNumeric: "tabular-nums",
                    opacity: animate ? 0 : 1,
                    animation: animate
                      ? `fade-up 360ms ease-out ${delay + 200}ms both`
                      : undefined,
                  }}
                >
                  {e.label}
                </text>
              )}
            </g>
          );
        })}

        {/* Annotations — yellow marker dots */}
        {annotations.map((a, i) => {
          const x = xOf(a.t);
          return (
            <g key={`an-${i}`}>
              {/* halo */}
              <circle
                cx={x}
                cy={baselineY}
                r={9}
                fill="var(--marker)"
                opacity={0.32}
                style={{ animation: "marker-pulse 2.6s ease-in-out infinite" }}
              />
              {/* dot */}
              <circle
                cx={x}
                cy={baselineY}
                r={5}
                fill="var(--marker)"
                stroke="var(--ink)"
                strokeWidth={1}
              />
              {/* caption above */}
              <text
                x={x}
                y={trackTop - 8}
                textAnchor="middle"
                fontSize={11}
                fontFamily="var(--font-mono), monospace"
                fill="var(--ink)"
                fontWeight={500}
                style={{
                  opacity: animate ? 0 : 1,
                  animation: animate ? "fade-up 500ms ease-out 1400ms both" : undefined,
                }}
              >
                {a.caption}
              </text>
              <line
                x1={x}
                y1={trackTop - 2}
                x2={x}
                y2={baselineY - 8}
                stroke="var(--marker)"
                strokeWidth={1.5}
                style={{
                  opacity: animate ? 0 : 0.9,
                  animation: animate ? "fade-up 500ms ease-out 1500ms both" : undefined,
                }}
              />
            </g>
          );
        })}
      </svg>

      {interactive && hoverIdx != null && events[hoverIdx] && (
        <TraceTooltip
          event={events[hoverIdx]}
          leftPct={(events[hoverIdx].t / Math.max(1, durationMs)) * 100}
        />
      )}
    </figure>
  );
}

function TraceTooltip({
  event,
  leftPct,
}: {
  event: TraceEvent;
  leftPct: number;
}) {
  const m = event.meta;
  const time = (() => {
    const total = Math.round(event.t / 1000);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  })();
  // Pin the tooltip near the tick but clamp so it doesn't fall off the edge.
  const clamped = Math.min(94, Math.max(6, leftPct));
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-sm border border-ink bg-vellum px-2.5 py-1.5 font-mono text-[11px] leading-snug text-ink shadow-sm"
      style={{ left: `${clamped}%`, top: 0 }}
    >
      <div className="flex items-baseline gap-2">
        <span className="font-semibold">{event.kind}</span>
        <span className="text-chalk tabular-nums">{time}</span>
      </div>
      {m?.rawType && m.rawType !== event.kind && (
        <div className="text-chalk">type {m.rawType}</div>
      )}
      {m?.stepId && <div className="text-graphite">step {m.stepId}</div>}
      {m?.payload && Object.keys(m.payload).length > 0 && (
        <div className="mt-1 max-w-[18rem] truncate text-graphite">
          {Object.entries(m.payload)
            .slice(0, 2)
            .map(([k, v]) => `${k}=${truncate(String(v), 32)}`)
            .join(" · ")}
        </div>
      )}
    </div>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

/* ============================================================================
   Trace.Legend — small key explaining the opacity / marker encoding
   ========================================================================== */
export function TraceLegend({ className }: { className?: string }) {
  const items: { label: string; weight: number; w: number }[] = [
    { label: "focus", weight: KIND_WEIGHT.focus, w: KIND_WIDTH.focus },
    { label: "edit", weight: KIND_WEIGHT.edit, w: KIND_WIDTH.edit },
    { label: "erase", weight: KIND_WEIGHT.erase, w: KIND_WIDTH.erase },
    { label: "pause", weight: KIND_WEIGHT.pause, w: KIND_WIDTH.pause },
    { label: "paste", weight: KIND_WEIGHT.paste, w: KIND_WIDTH.paste },
  ];
  return (
    <div className={`flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-graphite ${className ?? ""}`}>
      <span className="eyebrow">legend</span>
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-3 bg-ink"
            style={{ width: it.w, opacity: it.weight }}
            aria-hidden
          />
          <span className="font-mono">{it.label}</span>
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full bg-marker"
          style={{ outline: "1px solid var(--ink)" }}
          aria-hidden
        />
        <span className="font-mono">marker</span>
        <span className="text-chalk">— where the AI looked twice</span>
      </span>
    </div>
  );
}

