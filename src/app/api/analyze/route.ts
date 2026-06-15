import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { analyzeSession } from "@/lib/analyzer";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { sessionId } = await req.json().catch(() => ({}));
  if (!sessionId) {
    return NextResponse.json({ error: "missing sessionId" }, { status: 400 });
  }
  try {
    await analyzeSession(sessionId);
    return NextResponse.json({ ok: true, sessionId });
  } catch (err: unknown) {
    console.error("[analyze]", err);
    return NextResponse.json(
      { error: (err as Error).message || "analysis failed" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "missing sessionId" }, { status: 400 });
  }
  const row = getDb()
    .prepare("SELECT session_id FROM reports WHERE session_id = ?")
    .get(sessionId) as { session_id: string } | undefined;
  return NextResponse.json({ ready: Boolean(row) });
}
