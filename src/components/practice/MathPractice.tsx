"use client";

import dynamic from "next/dynamic";
import { useCallback, useRef, useState } from "react";
import { Lightbulb, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { useRecorder } from "@/components/behavior/BehaviorRecorder";
import { answersEqual } from "@/lib/grading";
import { track } from "@/lib/pendo";
import type { MathProblem } from "@/content/problems";

const PracticeTimer = dynamic(
  () => import("./PracticeTimer").then((m) => m.PracticeTimer),
  { ssr: false }
);

interface Props {
  problem: MathProblem;
}

export function MathPractice({ problem }: Props) {
  const router = useRouter();
  const { sessionId, startedAt, emit, flush } = useRecorder();
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    Object.fromEntries(problem.steps.map((s) => [s.id, ""]))
  );
  const [hintsShown, setHintsShown] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const lastValRef = useRef<Record<string, string>>({});

  // Hard cap on session length to keep recordings bounded.
  // Use 2× the estimated time, but never less than 3 minutes.
  const maxMs = Math.max(problem.estMinutes * 2, 3) * 60_000;

  // Debounced answer_change emission
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const onAnswerChange = (stepId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [stepId]: value }));
    if (debounceTimers.current[stepId]) {
      clearTimeout(debounceTimers.current[stepId]);
    }
    debounceTimers.current[stepId] = setTimeout(() => {
      const oldVal = lastValRef.current[stepId] ?? "";
      if (oldVal !== value) {
        emit(
          "answer_change",
          { from: oldVal, to: value, len: value.length },
          stepId
        );
        lastValRef.current[stepId] = value;
      }
    }, 500);
  };

  const onStepFocus = (stepId: string) =>
    emit("step_focus", undefined, stepId);
  const onStepBlur = (stepId: string) =>
    emit("step_blur", undefined, stepId);
  const onPaste = (stepId: string, e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text").slice(0, 200);
    emit("copy_paste", { kind: "paste", text: pasted }, stepId);
  };
  const onCopy = (stepId: string) =>
    emit("copy_paste", { kind: "copy" }, stepId);
  const onHint = (stepId: string) => {
    setHintsShown((h) => ({ ...h, [stepId]: true }));
    emit("hint_request", undefined, stepId);
  };

  const submit = async (auto = false) => {
    if (!sessionId) {
      if (!auto) toast.error("Session not ready yet, try again in a moment.");
      return;
    }
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    // Compute correctness
    const stepResults = problem.steps.map((s) => ({
      stepId: s.id,
      submitted: answers[s.id] ?? "",
      correct: answersEqual(answers[s.id] ?? "", s.expectedAnswer),
    }));
    const allCorrect = stepResults.every((r) => r.correct);

    emit("step_submit", {
      kind: "final",
      stepResults,
      isCorrect: allCorrect,
      auto,
    });

    try {
      // Flush events first so the analyzer sees them
      await flush();

      const res = await fetch(`/api/sessions/${sessionId}/submit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          finalAnswer: JSON.stringify(answers),
          isCorrect: allCorrect,
        }),
      });
      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }
      track("session_submitted", {
        sessionId,
        problemId: problem.id,
        subject: "math",
        isCorrect: allCorrect,
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
    // submit is stable enough here: depends on sessionId (captured) and
    // synchronous refs. Re-creating onTimeUp on every render is fine.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emit, maxMs, sessionId]);

  return (
    <div className="grid min-h-[calc(100vh-7rem)] grid-cols-1 lg:grid-cols-[minmax(0,420px)_1fr]">
      {/* Left pane — problem statement */}
      <aside className="border-b border-border bg-surface/50 px-5 py-6 sm:px-6 sm:py-8 lg:border-b-0 lg:border-r lg:px-8 lg:py-10">
        <div className="max-w-md lg:sticky lg:top-20">
          <div className="flex items-center gap-2">
            <Badge tone="accent">{problem.topic}</Badge>
            <Badge>{problem.difficulty}</Badge>
          </div>
          <h1 className="mt-4 font-serif text-2xl leading-tight tracking-tight text-text-1">
            {problem.title}
          </h1>
          <div className="prose-statement mt-5 font-serif text-[17px] leading-[1.7] text-text-1">
            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
              {problem.statement}
            </ReactMarkdown>
          </div>
        </div>
      </aside>

      {/* Right pane — work area */}
      <section className="flex flex-col">
        <div className="sticky top-14 z-30 flex items-center justify-between gap-3 border-b border-border bg-bg/85 px-5 py-3 backdrop-blur sm:px-6 lg:px-8">
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
          <Button
            variant="primary"
            size="md"
            onClick={() => submit(false)}
            disabled={submitting || !sessionId}
          >
            {submitting ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Analyzing…
              </>
            ) : (
              "Submit & analyze"
            )}
          </Button>
        </div>
        <div className="flex-1 px-5 py-6 sm:px-6 sm:py-8 lg:px-8">
          <ol className="space-y-4">
            {problem.steps.map((step, idx) => (
              <li
                key={step.id}
                className={cn(
                  "rounded-lg border border-border bg-surface p-5 transition-colors",
                  "focus-within:border-accent"
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-mono text-xs uppercase tracking-wider text-text-3">
                      Step {idx + 1}
                    </p>
                    <p className="mt-1.5 text-sm text-text-1">{step.prompt}</p>
                  </div>
                  {step.hint && !hintsShown[step.id] && (
                    <button
                      type="button"
                      onClick={() => onHint(step.id)}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-text-3 hover:bg-surface-2 hover:text-text-2"
                    >
                      <Lightbulb size={12} /> Hint
                    </button>
                  )}
                </div>
                {hintsShown[step.id] && step.hint && (
                  <p className="mt-3 rounded-md bg-accent-soft px-3 py-2 text-xs text-text-2">
                    {step.hint}
                  </p>
                )}
                <Textarea
                  className="mt-3 font-mono"
                  rows={2}
                  placeholder="Type your reasoning, then the answer"
                  value={answers[step.id] ?? ""}
                  onChange={(e) => onAnswerChange(step.id, e.target.value)}
                  onFocus={() => onStepFocus(step.id)}
                  onBlur={() => onStepBlur(step.id)}
                  onPaste={(e) => onPaste(step.id, e)}
                  onCopy={() => onCopy(step.id)}
                />
              </li>
            ))}
          </ol>
          <p className="mt-6 text-xs text-text-3">
            Working time and edits are recorded locally. Nothing is uploaded
            except behavior events for analysis.
          </p>
        </div>
      </section>
    </div>
  );
}
