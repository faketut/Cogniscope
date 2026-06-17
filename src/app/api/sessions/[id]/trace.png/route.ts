import { NextRequest, NextResponse } from "next/server";
import { Resvg } from "@resvg/resvg-js";
import { getDb, type EventRow } from "@/lib/db";
import { getProblem } from "@/content/problems";
import { eventsToTraceEvents, pickAnnotations } from "@/lib/trace";
import { renderTraceSVG, type TraceOutcome } from "@/lib/traceRenderer";
import type { StoredEvent } from "@/lib/features";
import type { BehaviorTags } from "@/lib/prompts/behaviorTagging";
import type { Diagnosis } from "@/lib/prompts/diagnosis";

/**
 * GET /api/sessions/[id]/trace.png?format=svg|png   (default png)
 *
 * Renders a self-contained PNG of the session trace for sharing.
 * Loads the same event stream + AI annotations as the in-app Trace,
 * draws them via `renderTraceSVG`, and rasterizes with resvg-js.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const db = getDb();
  const session = db
    .prepare(
      "SELECT id, problem_id, started_at, submitted_at, is_correct FROM sessions WHERE id = ?"
    )
    .get(params.id) as
    | {
        id: string;
        problem_id: string;
        started_at: number;
        submitted_at: number | null;
        is_correct: number | null;
      }
    | undefined;
  if (!session) {
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }
  const problem = getProblem(session.problem_id);
  if (!problem) {
    return NextResponse.json({ error: "problem not found" }, { status: 404 });
  }

  const eventRows = db
    .prepare(
      "SELECT id, session_id, type, step_id, payload_json, ts FROM events WHERE session_id = ? ORDER BY ts ASC"
    )
    .all(params.id) as EventRow[];
  const stored: StoredEvent[] = eventRows.map((r) => ({
    type: r.type,
    step_id: r.step_id,
    payload_json: r.payload_json,
    ts: r.ts,
  }));
  const traceEvents = eventsToTraceEvents(stored, session.started_at);
  const durationMs = Math.max(
    1,
    (session.submitted_at ?? Date.now()) - session.started_at
  );

  // Try to pull AI annotations + a one-line takeaway from the report (if
  // analyzed). If not analyzed yet, fall back gracefully — the trace itself
  // still renders.
  let annotations = [] as ReturnType<typeof pickAnnotations>;
  let takeaway: string | undefined;
  const reportRow = db
    .prepare(
      "SELECT tags_json, diagnosis_json FROM reports WHERE session_id = ?"
    )
    .get(params.id) as
    | { tags_json: string; diagnosis_json: string }
    | undefined;
  if (reportRow) {
    try {
      const tags: BehaviorTags = JSON.parse(reportRow.tags_json);
      annotations = pickAnnotations(stored, session.started_at, tags);
    } catch {
      // ignore — render without annotations
    }
    try {
      const dx: Diagnosis = JSON.parse(reportRow.diagnosis_json);
      // First root cause's description = the most representative takeaway.
      takeaway = dx.rootCauses?.[0]?.description;
    } catch {
      // ignore — render without takeaway
    }
  }

  // Map session.is_correct + submitted_at into the visual outcome chip.
  let outcome: TraceOutcome;
  if (session.is_correct === 1) outcome = "correct";
  else if (session.is_correct === 0) outcome = "incorrect";
  else if (session.submitted_at !== null) outcome = "submitted";
  else outcome = "in-progress";

  const svg = renderTraceSVG({
    durationMs,
    events: traceEvents,
    annotations,
    title: problem.title,
    subtitle: `${problem.subject} · ${problem.topic}`,
    outcome,
    takeaway,
  });

  const format = (req.nextUrl.searchParams.get("format") || "png").toLowerCase();
  if (format === "svg") {
    return new NextResponse(svg, {
      status: 200,
      headers: {
        "content-type": "image/svg+xml",
        "cache-control": "private, max-age=0, must-revalidate",
      },
    });
  }

  // Default: rasterize to PNG via resvg.
  const resvg = new Resvg(svg, {
    background: "#EDEDE6",
    fitTo: { mode: "width", value: 1200 },
  });
  const pngData = resvg.render().asPng();

  return new NextResponse(new Uint8Array(pngData), {
    status: 200,
    headers: {
      "content-type": "image/png",
      "content-disposition": `inline; filename="cogniscope-trace-${params.id}.png"`,
      "cache-control": "private, max-age=0, must-revalidate",
    },
  });
}
