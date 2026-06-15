import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { getDb } from "@/lib/db";
import { getProblem } from "@/content/problems";

const CreateSessionSchema = z.object({
  problemId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = CreateSessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  if (!getProblem(parsed.data.problemId)) {
    return NextResponse.json(
      { error: "unknown problemId" },
      { status: 404 }
    );
  }
  const id = nanoid(12);
  const now = Date.now();
  getDb()
    .prepare(
      "INSERT INTO sessions (id, problem_id, started_at) VALUES (?, ?, ?)"
    )
    .run(id, parsed.data.problemId, now);
  return NextResponse.json({ id, startedAt: now });
}

export async function GET() {
  const rows = getDb()
    .prepare(
      "SELECT id, problem_id, started_at, submitted_at, final_answer, is_correct FROM sessions ORDER BY started_at DESC LIMIT 50"
    )
    .all();
  return NextResponse.json({ sessions: rows });
}
