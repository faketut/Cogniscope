"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

export interface BehaviorEvent {
  type: string;
  stepId?: string;
  payload?: Record<string, unknown>;
  ts: number;
}

interface RecorderContextValue {
  sessionId: string | null;
  startedAt: number | null;
  emit: (
    type: string,
    payload?: Record<string, unknown>,
    stepId?: string
  ) => void;
  flush: () => Promise<void>;
}

const RecorderContext = createContext<RecorderContextValue | null>(null);

export function BehaviorRecorderProvider({
  problemId,
  children,
}: {
  problemId: string;
  children: React.ReactNode;
}) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const bufferRef = useRef<BehaviorEvent[]>([]);
  const sidRef = useRef<string | null>(null);
  const lastInputRef = useRef<number>(Date.now());
  const idleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Create session on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ problemId }),
      });
      const data = await res.json();
      if (cancelled) return;
      sidRef.current = data.id;
      setSessionId(data.id);
      setStartedAt(data.startedAt);
      bufferRef.current.push({
        type: "session_start",
        ts: data.startedAt,
        payload: { problemId },
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [problemId]);

  const flush = useCallback(async () => {
    if (!sidRef.current || bufferRef.current.length === 0) return;
    const events = bufferRef.current;
    bufferRef.current = [];
    try {
      await fetch(`/api/events?sessionId=${sidRef.current}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ events }),
        keepalive: true,
      });
    } catch {
      // re-buffer on failure
      bufferRef.current.unshift(...events);
    }
  }, []);

  const emit = useCallback(
    (type: string, payload?: Record<string, unknown>, stepId?: string) => {
      const ts = Date.now();
      lastInputRef.current = ts;
      bufferRef.current.push({ type, payload, stepId, ts });
    },
    []
  );

  // Periodic flush every 2s
  useEffect(() => {
    if (!sessionId) return;
    const t = setInterval(() => flush(), 2000);
    return () => clearInterval(t);
  }, [sessionId, flush]);

  // Flush on unmount + page hide
  useEffect(() => {
    const onHide = () => {
      // Detect tab visibility separately too
      if (document.visibilityState === "hidden") {
        bufferRef.current.push({
          type: "tab_visibility",
          ts: Date.now(),
          payload: { state: "hidden" },
        });
      } else {
        bufferRef.current.push({
          type: "tab_visibility",
          ts: Date.now(),
          payload: { state: "visible" },
        });
      }
      flush();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", flush);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", flush);
    };
  }, [flush]);

  // Idle detection — emits an idle event when > 10s without input
  useEffect(() => {
    if (!sessionId) return;
    idleTimerRef.current = setInterval(() => {
      const since = Date.now() - lastInputRef.current;
      if (since >= 10_000) {
        bufferRef.current.push({
          type: "idle",
          ts: Date.now(),
          payload: { durationMs: since },
        });
        lastInputRef.current = Date.now(); // reset so we don't spam
      }
    }, 5_000);
    return () => {
      if (idleTimerRef.current) clearInterval(idleTimerRef.current);
    };
  }, [sessionId]);

  // ─────────────────────────────────────────────────────────────────────
  // rrweb session recording — runs alongside the structured event stream.
  // Dynamically imported so it doesn't bloat the initial bundle, and
  // gracefully no-ops if rrweb fails to load.
  // ─────────────────────────────────────────────────────────────────────
  const rrwebBufferRef = useRef<unknown[]>([]);
  const rrwebStopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    (async () => {
      try {
        const rrweb = await import("rrweb");
        if (cancelled) return;
        const stop = rrweb.record({
          emit(ev) {
            rrwebBufferRef.current.push(ev);
          },
          // Skip recording inputs in passwords/sensitive fields by default.
          maskAllInputs: false,
          // Snapshot every 30s as a safety net if the user keeps the page open.
          checkoutEveryNms: 30_000,
        });
        if (stop) rrwebStopRef.current = stop;
      } catch {
        // rrweb isn't critical — silently disable if it fails to load.
      }
    })();
    return () => {
      cancelled = true;
      if (rrwebStopRef.current) {
        rrwebStopRef.current();
        rrwebStopRef.current = null;
      }
    };
  }, [sessionId]);

  const flushRrweb = useCallback(async () => {
    const sid = sidRef.current;
    if (!sid || rrwebBufferRef.current.length === 0) return;
    const events = rrwebBufferRef.current;
    rrwebBufferRef.current = [];
    try {
      await fetch(`/api/sessions/${sid}/rrweb`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ events }),
        keepalive: true,
      });
    } catch {
      // re-buffer on failure
      rrwebBufferRef.current.unshift(...events);
    }
  }, []);

  // Periodic rrweb flush, slower cadence than behavior events.
  useEffect(() => {
    if (!sessionId) return;
    const t = setInterval(() => flushRrweb(), 5_000);
    return () => clearInterval(t);
  }, [sessionId, flushRrweb]);

  // Final flush on tab hide / unload.
  useEffect(() => {
    const onHide = () => flushRrweb();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", onHide);
    };
  }, [flushRrweb]);

  return (
    <RecorderContext.Provider value={{ sessionId, startedAt, emit, flush }}>
      {children}
    </RecorderContext.Provider>
  );
}

export function useRecorder(): RecorderContextValue {
  const ctx = useContext(RecorderContext);
  if (!ctx)
    throw new Error("useRecorder must be used within BehaviorRecorderProvider");
  return ctx;
}
