"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Loads the rrweb recording for this session and renders it in rrweb-player.
 * If no recording exists (older sessions, or rrweb failed to load on capture),
 * we show a friendly empty state instead of an error.
 */
export function ReplayTab({ sessionId }: { sessionId: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<"loading" | "empty" | "ready" | "error">(
    "loading"
  );
  const [eventCount, setEventCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let player: { $destroy?: () => void } | null = null;

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
        if (cancelled || !containerRef.current) return;

        // Clear any previous player instance (e.g. tab re-mount)
        containerRef.current.innerHTML = "";

        const width = Math.min(
          960,
          containerRef.current.clientWidth || 720
        );
        const height = Math.round(width * 0.6);
        player = new RrwebPlayer({
          target: containerRef.current,
          props: {
            events: data.events,
            width,
            height,
            autoPlay: false,
            showController: true,
          },
        });
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
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

      <div
        ref={containerRef}
        className="rounded-sm border border-rule bg-vellum p-2"
        style={{ minHeight: status === "ready" ? undefined : 0 }}
      />
    </div>
  );
}
