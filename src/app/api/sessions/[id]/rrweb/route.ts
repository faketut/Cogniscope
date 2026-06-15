import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { rrwebFilePath } from "@/lib/db";

/**
 * POST  /api/sessions/[id]/rrweb
 *   Body: { events: rrwebEvent[] }
 *   Appends each event as a single JSON line to data/sessions/[id].rrweb.jsonl
 *   Designed for periodic flushes from the browser. Idempotent across reloads
 *   only at the file level — clients should debounce.
 *
 * GET   /api/sessions/[id]/rrweb
 *   Returns: { events: rrwebEvent[] }
 *   Reads the full JSONL file. If absent, returns events=[].
 */

interface RrwebEvent {
  type: number;
  data: unknown;
  timestamp: number;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  let body: { events?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const events = Array.isArray(body.events) ? (body.events as RrwebEvent[]) : null;
  if (!events) {
    return NextResponse.json({ error: "events array required" }, { status: 400 });
  }
  if (events.length === 0) {
    return NextResponse.json({ ok: true, appended: 0 });
  }

  let filePath: string;
  try {
    filePath = rrwebFilePath(params.id);
  } catch {
    return NextResponse.json({ error: "invalid session id" }, { status: 400 });
  }
  // One event per line, newline-delimited so we can stream-read large traces.
  const lines = events.map((e) => JSON.stringify(e)).join("\n") + "\n";
  await fs.promises.appendFile(filePath, lines, "utf8");

  return NextResponse.json({ ok: true, appended: events.length });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  let filePath: string;
  try {
    filePath = rrwebFilePath(params.id);
  } catch {
    return NextResponse.json({ error: "invalid session id" }, { status: 400 });
  }
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ events: [] });
  }
  const text = await fs.promises.readFile(filePath, "utf8");
  const events: RrwebEvent[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line) as RrwebEvent);
    } catch {
      // skip malformed line — tolerate partial flushes
    }
  }
  return NextResponse.json({ events });
}
