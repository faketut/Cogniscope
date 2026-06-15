"use client";

import { useEffect } from "react";
import { track } from "@/lib/pendo";

/**
 * Fires a single `report_viewed` Pendo event when the report page mounts.
 * Server component on /report/[sessionId] renders this once on first paint.
 */
export function ReportViewTracker({
  sessionId,
  problemId,
  subject,
}: {
  sessionId: string;
  problemId: string;
  subject: "math" | "programming";
}) {
  useEffect(() => {
    track("report_viewed", { sessionId, problemId, subject });
  }, [sessionId, problemId, subject]);

  return null;
}
