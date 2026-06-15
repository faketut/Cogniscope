"use client";

import dynamic from "next/dynamic";
import { useCallback, useRef, useState } from "react";
import { Loader2, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useRecorder } from "@/components/behavior/BehaviorRecorder";
import { useTheme } from "@/components/theme/ThemeProvider";
import { track } from "@/lib/pendo";
import type { ProgrammingProblem } from "@/content/problems";

const PracticeTimer = dynamic(
  () => import("./PracticeTimer").then((m) => m.PracticeTimer),
  { ssr: false }
);

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-xs text-text-3">
      Loading editor…
    </div>
  ),
});

export function CodePractice({ problem }: { problem: ProgrammingProblem }) {
  const router = useRouter();
  const { resolved } = useTheme();
  const { sessionId, startedAt, emit, flush } = useRecorder();
  const [code, setCode] = useState(problem.starterCode);
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [runOutput, setRunOutput] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevCodeRef = useRef(problem.starterCode);

  // Hard cap on session length to keep recordings bounded.
  // Use 2× the estimated time, but never less than 3 minutes.
  const maxMs = Math.max(problem.estMinutes * 2, 3) * 60_000;

  const onChange = (value: string | undefined) => {
    const v = value ?? "";
    setCode(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const delta = v.length - prevCodeRef.current.length;
      emit("answer_change", {
        len: v.length,
        delta,
      });
      prevCodeRef.current = v;
    }, 500);
  };

  const runTests = async () => {
    setRunning(true);
    emit("code_run");
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          problemId: problem.id,
          code,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        passed?: number;
        total?: number;
        results?: Array<{
          input: string;
          expected: string;
          got: string;
          ok: boolean;
        }>;
      };
      if (!res.ok) {
        throw new Error(data.error || `Run failed (${res.status})`);
      }
      const results = data.results ?? [];
      const pass = data.passed ?? results.filter((r) => r.ok).length;
      const total = data.total ?? results.length;
      setRunOutput(
        `${pass}/${total} passed\n\n` +
          results
            .map(
              (r, i) =>
                `Test ${i + 1} (${r.input}) → ${r.ok ? "✓" : "✗"}\n  expected: ${r.expected}\n  got: ${r.got}`
            )
            .join("\n")
      );
      emit("code_run_result", { passed: pass, total });
    } catch (err: unknown) {
      setRunOutput(`error: ${(err as Error).message}`);
      emit("code_run_result", { error: (err as Error).message });
    } finally {
      setRunning(false);
    }
  };

  const submit = async (auto = false) => {
    if (!sessionId) {
      if (!auto) toast.error("Session not ready yet.");
      return;
    }
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    emit("step_submit", { kind: "final", code, auto });
    try {
      await flush();
      const res = await fetch(`/api/sessions/${sessionId}/submit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ finalAnswer: code, isCorrect: null }),
      });
      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }
      track("session_submitted", {
        sessionId,
        problemId: problem.id,
        subject: "programming",
        auto,
      });
      router.push(`/analysis/${sessionId}`);
    } catch (err) {
      const msg =
        err instanceof TypeError
          ? "Couldn’t reach the server. Check your connection and try again."
          : `Submit failed: ${(err as Error).message}`;
      toast.error(msg);
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const onTimeUp = useCallback(() => {
    if (submittingRef.current) return;
    emit("time_expired", { maxMs });
    toast.info("Time’s up — submitting what you have.");
    void submit(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emit, maxMs, sessionId]);

  return (
    <div className="grid min-h-[calc(100vh-7rem)] grid-cols-1 lg:grid-cols-[minmax(0,420px)_1fr]">
      <aside className="border-b border-border bg-surface/50 px-5 py-6 sm:px-6 sm:py-8 lg:border-b-0 lg:border-r lg:px-8 lg:py-10">
        <div className="max-w-md lg:sticky lg:top-20">
          <div className="flex items-center gap-2">
            <Badge tone="accent">{problem.topic}</Badge>
            <Badge>{problem.difficulty}</Badge>
            <Badge>{problem.language}</Badge>
          </div>
          <h1 className="mt-4 font-serif text-2xl leading-tight tracking-tight">
            {problem.title}
          </h1>
          <div className="prose-statement mt-5 font-serif text-[17px] leading-[1.7] text-text-1">
            <ReactMarkdown>{problem.statement}</ReactMarkdown>
          </div>
        </div>
      </aside>

      <section className="flex flex-col">
        <div className="sticky top-14 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-bg/85 px-5 py-3 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 text-xs text-text-3">
            <span className="font-mono">
              {sessionId ? `#${sessionId}` : "starting…"}
            </span>
            <span aria-hidden>·</span>
            <PracticeTimer
              startedAt={startedAt}
              maxMs={maxMs}
              onExpire={onTimeUp}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="md" onClick={runTests} disabled={running}>
              {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              Run local tests
            </Button>
            <Button variant="primary" size="md" onClick={() => submit(false)} disabled={submitting || !sessionId}>
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Analyzing…
                </>
              ) : (
                "Submit & analyze"
              )}
            </Button>
          </div>
        </div>
        <div className="flex flex-1 flex-col">
          <div className="h-[60vh] border-b border-border lg:h-[55vh]">
            <MonacoEditor
              height="100%"
              language={problem.language}
              value={code}
              onChange={onChange}
              theme={resolved === "dark" ? "vs-dark" : "light"}
              options={{
                fontSize: 13,
                fontFamily: "var(--font-mono), JetBrains Mono, monospace",
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                lineNumbers: "on",
                renderLineHighlight: "gutter",
                padding: { top: 16 },
                tabSize: 2,
              }}
            />
          </div>
          <div className="bg-surface-2 px-5 py-4 font-mono text-xs text-text-2 sm:px-6 lg:px-8">
            <div className="mb-2 flex items-center gap-2 text-text-3">
              <span className="uppercase tracking-wider">Output</span>
              <span className="h-px flex-1 bg-border" />
            </div>
            {runOutput ? (
              <>
                <pre className="whitespace-pre-wrap leading-relaxed">{runOutput}</pre>
                <p className="mt-3 text-[11px] leading-relaxed text-text-3">
                  These tests run through a local server-side judge endpoint intended for demos.
                  It is not a hardened multi-tenant execution sandbox.
                </p>
              </>
            ) : (
              <p className="text-text-3">
                Press Run local tests to execute the sample cases via the local judge.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
