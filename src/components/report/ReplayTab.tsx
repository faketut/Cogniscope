"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Loads the rrweb recording for this session and renders it in rrweb-player.
 * If no recording exists (older sessions, or rrweb failed to load on capture),
 * we show a friendly empty state instead of an error.
 */
export function ReplayTab({ sessionId }: { sessionId: string }) {
  // Two refs: one for the wrapper (whose width we trust), one for the host
  // node we hand to rrweb-player. Keeping them separate means the player's
  // own markup can't pollute the measurement.
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<"loading" | "empty" | "ready" | "error">(
    "loading"
  );
  const [eventCount, setEventCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let player: { $destroy?: () => void; triggerResize?: () => void } | null =
      null;
    let ro: ResizeObserver | null = null;

    (async () => {
      try {
        const res = await fetch(`/api/sessions/${sessionId}/rrweb`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: { events: unknown[] } = await res.json();
        if (cancelled) return;
        if (!data.events || data.events.length < 2) {
          setStatus("empty");
          return;
        }
        setEventCount(data.events.length);

        // Dynamic import — rrweb-player ships its own CSS we need to load too.
        const [playerModule] = await Promise.all([
          import("rrweb-player"),
          // Side-effect: stylesheet
          import("rrweb-player/dist/style.css"),
        ]);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const RrwebPlayer: any = (playerModule as any).default ?? playerModule;
        if (cancelled || !hostRef.current || !wrapperRef.current) return;

        // Clear any previous player instance (e.g. tab re-mount)
        hostRef.current.innerHTML = "";

        // Floor to avoid sub-pixel overflow; cap at 960 so the player doesn't
        // stretch into an awkward letterbox on very wide screens.
        const measure = () =>
          Math.max(
            280,
            Math.min(960, Math.floor(wrapperRef.current?.clientWidth ?? 720))
          );
        const width = measure();
        const height = Math.round(width * 0.6);
        player = new RrwebPlayer({
          target: hostRef.current,
          props: {
            events: data.events,
            width,
            height,
            autoPlay: false,
            showController: true,
          },
        });
        setStatus("ready");

        // Keep the player sized to its container on window / layout changes.
        if (typeof ResizeObserver !== "undefined") {
          ro = new ResizeObserver(() => {
            try {
              player?.triggerResize?.();
            } catch {
              // rrweb-player versions without triggerResize — just no-op.
            }
          });
          ro.observe(wrapperRef.current);
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      try {
        ro?.disconnect();
      } catch {
        // ignore
      }
      try {
        player?.$destroy?.();
      } catch {
        // ignore
      }
    };
  }, [sessionId]);

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between border-b border-ink pb-2">
        <h2 className="font-display-tight text-2xl">Replay</h2>
        <span className="eyebrow tabular-nums">
          {status === "ready" && `${eventCount} frames`}
          {status === "loading" && "loading…"}
          {status === "empty" && "no recording"}
          {status === "error" && "couldn’t load"}
        </span>
      </div>

      {status === "empty" && (
        <p className="border border-dashed border-rule px-6 py-12 text-center text-sm text-graphite">
          No screen recording was captured for this session. Older sessions
          predate the replay feature; new ones will record automatically.
        </p>
      )}
      {status === "error" && (
        <p className="border border-dashed border-rule px-6 py-12 text-center text-sm text-graphite">
          Couldn’t load the replay. Try refreshing the page.
        </p>
      )}

      {/*
        Hard width constraint — `overflow-hidden` keeps the player's chrome
        from pushing siblings or the page itself wider than the viewport, and
        `max-w-full` plus the parent's grid column ensures the wrapper itself
        never exceeds its column. `min-w-0` defeats the flex/grid default
        intrinsic-min-content behavior that lets children blow out a column.
      */}
      <div
        ref={wrapperRef}
        className="min-w-0 max-w-full overflow-hidden rounded-sm border border-rule bg-vellum p-2"
      >
        <div ref={hostRef} className="mx-auto" />
      </div>
    </div>
  );
}

