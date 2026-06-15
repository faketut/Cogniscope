import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";

const EventSchema = z.object({
  type: z.string().min(1),
  stepId: z.string().nullish(),
  payload: z.record(z.string(), z.unknown()).nullish(),
  ts: z.number(),
});

const BatchSchema = z.object({
  events: z.array(EventSchema).max(500),
});

export async function POST(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "missing sessionId" }, { status: 400 });
  }
  const body = await req.json().catch(() => null);
  const parsed = BatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const db = getDb();
  const stmt = db.prepare(
    "INSERT INTO events (session_id, type, step_id, payload_json, ts) VALUES (?, ?, ?, ?, ?)"
  );
  const insertMany = db.transaction((events: z.infer<typeof EventSchema>[]) => {
    for (const e of events) {
      stmt.run(
        sessionId,
        e.type,
        e.stepId ?? null,
        e.payload ? JSON.stringify(e.payload) : null,
        e.ts
      );
    }
  });
  try {
    insertMany(parsed.data.events);
  } catch (err) {
    // FK violation when sessionId doesn't exist — translate to a 404 so the
    // client can stop sending instead of seeing a generic 500.
    if (
      err instanceof Error &&
      /FOREIGN KEY|SQLITE_CONSTRAINT/i.test(err.message)
    ) {
      return NextResponse.json(
        { error: "session not found" },
        { status: 404 }
      );
    }
    throw err;
  }

  return NextResponse.json({ ok: true, count: parsed.data.events.length });
}
