import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import { getDb, type EventRow } from "@/lib/db";
import { getProblem } from "@/content/problems";
import { Badge } from "@/components/ui/Badge";
import { formatDuration } from "@/lib/utils";
import { ReportTabs } from "@/components/report/ReportTabs";
import { eventsToTraceEvents, pickAnnotations } from "@/lib/trace";
import { ReportViewTracker } from "@/components/report/ReportViewTracker";
import { RecommendationsSection } from "@/components/report/RecommendationsSection";
import { recommendNext } from "@/lib/recommend";
import type { FeatureSet, StoredEvent } from "@/lib/features";
import type { BehaviorTags } from "@/lib/prompts/behaviorTagging";
import type { Diagnosis } from "@/lib/prompts/diagnosis";

export default function ReportPage({
  params,
}: {
  params: { sessionId: string };
}) {
  const db = getDb();
  const report = db
    .prepare(
      "SELECT session_id, tags_json, diagnosis_json, feedback_md, features_json, created_at FROM reports WHERE session_id = ?"
    )
    .get(params.sessionId) as
    | {
        session_id: string;
        tags_json: string;
        diagnosis_json: string;
        feedback_md: string;
        features_json: string;
        created_at: number;
      }
    | undefined;
  if (!report) notFound();

  const session = db
    .prepare(
      "SELECT id, problem_id, started_at, submitted_at, is_correct FROM sessions WHERE id = ?"
    )
    .get(params.sessionId) as
    | {
        id: string;
        problem_id: string;
        started_at: number;
        submitted_at: number | null;
        is_correct: number | null;
      }
    | undefined;
  if (!session) notFound();
  const problem = getProblem(session.problem_id);
  if (!problem) notFound();

  // A corrupt JSON column (half-written row, hand-edit during dev) shouldn't
  // 500 the whole page — surface a clean 404 and let the user re-analyze.
  let features: FeatureSet;
  let tags: BehaviorTags;
  let diagnosis: Diagnosis;
  try {
    features = JSON.parse(report.features_json);
    tags = JSON.parse(report.tags_json);
    diagnosis = JSON.parse(report.diagnosis_json);
  } catch {
    notFound();
  }

  // Raw event stream → trace inputs
  const eventRows = db
    .prepare(
      "SELECT id, session_id, type, step_id, payload_json, ts FROM events WHERE session_id = ? ORDER BY ts ASC"
    )
    .all(params.sessionId) as EventRow[];
  const storedEvents: StoredEvent[] = eventRows.map((r) => ({
    type: r.type,
    step_id: r.step_id,
    payload_json: r.payload_json,
    ts: r.ts,
  }));
  const traceEvents = eventsToTraceEvents(storedEvents, session.started_at);
  const annotations = pickAnnotations(storedEvents, session.started_at, tags);

  const isCorrect = session.is_correct === 1;
  const isWrong = session.is_correct === 0;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <ReportViewTracker
        sessionId={params.sessionId}
        problemId={problem.id}
        subject={problem.subject}
      />
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs text-chalk hover:text-ink"
      >
        <ArrowLeft size={12} /> Back
      </Link>

      <header className="mt-4 grid grid-cols-1 items-end gap-y-3 border-b border-ink pb-5 sm:grid-cols-12">
        <div className="sm:col-span-8">
          <p className="eyebrow">
            {problem.subject} · {problem.topic}
          </p>
          <h1 className="mt-1 font-display text-3xl leading-tight sm:text-[2.5rem]">
            {problem.title}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:col-span-4 sm:justify-end">
          <Badge>
            <span className="tabular-nums">{formatDuration(features.durationMs)}</span>
          </Badge>
          {isCorrect && <Badge tone="success">correct</Badge>}
          {isWrong && <Badge tone="danger">incorrect</Badge>}
          {session.is_correct === null && <Badge>submitted</Badge>}
          <Link
            href={`/inspect/${params.sessionId}`}
            className="ml-1 inline-flex items-center border border-rule px-2 py-1 font-mono text-[11px] uppercase tracking-wider text-chalk transition-colors hover:border-ink hover:text-ink"
            title="Open the raw stored session data"
          >
            Inspect
          </Link>
          <a
            href={`/api/sessions/${params.sessionId}/trace.png`}
            download={`cogniscope-trace-${params.sessionId}.png`}
            className="inline-flex items-center gap-1.5 border border-ink border-r-0 px-2 py-1 font-mono text-[11px] uppercase tracking-wider text-ink transition-colors hover:bg-ink hover:text-vellum"
            title="Download a PNG of this trace"
          >
            <Download size={12} /> Share trace
          </a>
          <a
            href={`/api/sessions/${params.sessionId}/trace.png?format=svg`}
            download={`cogniscope-trace-${params.sessionId}.svg`}
            className="-ml-2 inline-flex items-center border border-ink px-2 py-1 font-mono text-[11px] uppercase tracking-wider text-ink transition-colors hover:bg-ink hover:text-vellum"
            title="Download a vector SVG of this trace"
          >
            svg
          </a>
        </div>
      </header>

      <ReportTabs
        sessionId={params.sessionId}
        features={features}
        tags={tags}
        diagnosis={diagnosis}
        feedback={report.feedback_md}
        traceEvents={traceEvents}
        annotations={annotations}
      />

      <RecommendationsSection
        items={recommendNext(
          problem,
          session.is_correct == null ? null : session.is_correct === 1
        )}
      />
    </div>
  );
}
