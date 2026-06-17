"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Loads the rrweb recording for this session and renders it using rrweb's
 * Replayer directly (rrweb-player@2.0.1's ESM build is broken — its bundled
 * Svelte Player declares `replayer` as a prop but never instantiates one, so
 * the iframe never mounts; see rrweb-io/rrweb#1602). We render a minimal
 * play / pause / scrub bar around the Replayer ourselves.
 */
export function ReplayTab({ sessionId }: { sessionId: string }) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const replayerRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);
  const [status, setStatus] = useState<"loading" | "empty" | "ready" | "error">(
    "loading"
  );
  const [eventCount, setEventCount] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [currentMs, setCurrentMs] = useState(0);
  const [totalMs, setTotalMs] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let ro: ResizeObserver | null = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let replayer: any = null;

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

        // rrweb ships its own iframe CSS; load it as a side-effect import.
        const [rrweb] = await Promise.all([
          import("rrweb"),
          import("rrweb/dist/style.css"),
        ]);
        if (cancelled || !stageRef.current || !wrapperRef.current) return;

        // Clear any previous instance (tab re-mount / strict-mode double-call).
        stageRef.current.innerHTML = "";

        replayer = new rrweb.Replayer(
          data.events as Parameters<typeof rrweb.Replayer>[0],
          {
            root: stageRef.current,
            speed: 1,
            skipInactive: true,
            showWarning: false,
          }
        );
        replayerRef.current = replayer;

        const meta = replayer.getMetaData();
        setTotalMs(meta.totalTime);
        setCurrentMs(0);

        replayer.on("finish", () => {
          setPlaying(false);
          if (rafRef.current !== null) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
          }
        });

        // Fit the recorded viewport into our column using a CSS scale.
        const fit = () => {
          if (!wrapperRef.current || !stageRef.current) return;
          const wrapperW = wrapperRef.current.clientWidth;
          const rrwebWrapper = stageRef.current.querySelector<HTMLElement>(
            ".replayer-wrapper"
          );
          const iframe = stageRef.current.querySelector<HTMLIFrameElement>(
            ".replayer-wrapper iframe"
          );
          if (!rrwebWrapper || !iframe) return;
          const iw = iframe.offsetWidth || 1024;
          const ih = iframe.offsetHeight || 576;
          // Leave a hair of breathing room so we never hit the edge.
          const padded = Math.max(280, wrapperW - 4);
          const scale = Math.min(1, padded / iw);
          rrwebWrapper.style.transformOrigin = "top left";
          rrwebWrapper.style.transform = `scale(${scale})`;
          // Reserve space for the scaled iframe so the controls sit below it.
          stageRef.current.style.height = `${Math.round(ih * scale)}px`;
          stageRef.current.style.width = `${Math.round(iw * scale)}px`;
        };
        // Wait a tick so the iframe is in the DOM before we measure it.
        requestAnimationFrame(() => {
          fit();
          setStatus("ready");
        });

        if (typeof ResizeObserver !== "undefined") {
          ro = new ResizeObserver(() => fit());
          ro.observe(wrapperRef.current);
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      try {
        ro?.disconnect();
      } catch {
        // ignore
      }
      try {
        replayer?.pause?.();
        replayer?.destroy?.();
      } catch {
        // ignore
      }
      replayerRef.current = null;
    };
  }, [sessionId]);

  const togglePlay = () => {
    const r = replayerRef.current;
    if (!r) return;
    if (playing) {
      r.pause();
      setPlaying(false);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    } else {
      // If we ran off the end, restart from 0; otherwise resume.
      const resumeAt = currentMs >= totalMs - 50 ? 0 : currentMs;
      r.play(resumeAt);
      setPlaying(true);
      const tick = () => {
        const cur = replayerRef.current;
        if (!cur) return;
        try {
          setCurrentMs(cur.getCurrentTime());
        } catch {
          // ignore
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    }
  };

  const onScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const r = replayerRef.current;
    if (!r) return;
    const ms = Number(e.target.value);
    setCurrentMs(ms);
    if (playing) {
      r.play(ms);
    } else {
      r.pause(ms);
    }
  };

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
        ref={wrapperRef}
        className="min-w-0 max-w-full overflow-hidden rounded-sm border border-rule bg-vellum"
      >
        <div className="flex items-center justify-center bg-white p-2">
          <div ref={stageRef} className="relative mx-auto overflow-hidden" />
        </div>

        {status === "ready" && (
          <div className="flex items-center gap-3 border-t border-rule px-3 py-2">
            <button
              type="button"
              onClick={togglePlay}
              className="rounded-sm border border-ink px-3 py-1 font-mono text-xs uppercase tracking-wider text-ink transition hover:bg-ink hover:text-vellum"
            >
              {playing ? "Pause" : "Play"}
            </button>
            <input
              type="range"
              min={0}
              max={totalMs}
              step={50}
              value={Math.min(currentMs, totalMs)}
              onChange={onScrub}
              className="flex-1 accent-ink"
              aria-label="Scrub"
            />
            <span className="font-mono text-xs tabular-nums text-graphite">
              {formatMs(currentMs)} / {formatMs(totalMs)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function formatMs(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}


