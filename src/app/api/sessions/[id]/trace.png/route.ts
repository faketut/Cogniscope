import { NextRequest, NextResponse } from "next/server";
import { Resvg } from "@resvg/resvg-js";
import { getDb, type EventRow } from "@/lib/db";
import { getProblem } from "@/content/problems";
import { eventsToTraceEvents, pickAnnotations } from "@/lib/trace";
import { renderTraceSVG } from "@/lib/traceRenderer";
import type { StoredEvent } from "@/lib/features";
import type { BehaviorTags } from "@/lib/prompts/behaviorTagging";

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
      "SELECT id, problem_id, started_at, submitted_at FROM sessions WHERE id = ?"
    )
    .get(params.id) as
    | {
        id: string;
        problem_id: string;
        started_at: number;
        submitted_at: number | null;
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

  // Try to pull AI annotations from the report (if analyzed). If not analyzed
  // yet, fall back to empty annotations — the trace itself still renders.
  let annotations = [] as ReturnType<typeof pickAnnotations>;
  const reportRow = db
    .prepare("SELECT tags_json FROM reports WHERE session_id = ?")
    .get(params.id) as { tags_json: string } | undefined;
  if (reportRow) {
    try {
      const tags: BehaviorTags = JSON.parse(reportRow.tags_json);
      annotations = pickAnnotations(stored, session.started_at, tags);
    } catch {
      // ignore — render without annotations
    }
  }

  const svg = renderTraceSVG({
    durationMs,
    events: traceEvents,
    annotations,
    title: problem.title,
    subtitle: `${problem.subject} · ${problem.topic}`,
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
