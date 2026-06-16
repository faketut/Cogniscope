import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";

const SubmitSchema = z.object({
  finalAnswer: z.string().optional(),
  isCorrect: z.boolean().nullable().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json().catch(() => ({}));
  const parsed = SubmitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const now = Date.now();
  const result = getDb()
    .prepare(
      "UPDATE sessions SET submitted_at = ?, final_answer = ?, is_correct = ? WHERE id = ?"
    )
    .run(
      now,
      parsed.data.finalAnswer ?? null,
      parsed.data.isCorrect == null ? null : parsed.data.isCorrect ? 1 : 0,
      params.id
    );
  if (result.changes === 0) {
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, submittedAt: now });
}
