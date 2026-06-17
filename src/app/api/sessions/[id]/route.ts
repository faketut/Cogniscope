import { NextResponse } from "next/server";
import { deleteSession } from "@/lib/db";

/**
 * DELETE /api/sessions/[id]
 *
 * Removes a single session: the SQLite row (events / reports / chat cascade
 * via FK) and its on-disk rrweb recording. Idempotent — returns 204 even if
 * the id doesn't exist, so re-clicking a delete button after a stale page
 * load doesn't produce a confusing error.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    deleteSession(params.id);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "invalid id" },
      { status: 400 }
    );
  }
  return new NextResponse(null, { status: 204 });
}
