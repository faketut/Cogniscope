import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getDb } from "@/lib/db";
import { getProblem } from "@/content/problems";
import { Badge } from "@/components/ui/Badge";
import { formatDuration, formatRelativeTime } from "@/lib/utils";
import {
  DeleteSessionButton,
  ClearAllSessionsButton,
} from "@/components/history/SessionDeleteActions";

export const dynamic = "force-dynamic";

interface Row {
  id: string;
  problem_id: string;
  started_at: number;
  submitted_at: number | null;
  is_correct: number | null;
  has_report: number;
}

export default function HistoryPage() {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT s.id, s.problem_id, s.started_at, s.submitted_at, s.is_correct,
              CASE WHEN r.session_id IS NOT NULL THEN 1 ELSE 0 END AS has_report
       FROM sessions s
       LEFT JOIN reports r ON r.session_id = s.id
       ORDER BY s.started_at DESC
       LIMIT 50`
    )
    .all() as Row[];

  return (
    <div className="mx-auto max-w-5xl px-6 pb-24 pt-10 sm:pt-14">
      <header className="flex flex-col gap-3 border-b border-ink pb-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">your sessions</p>
          <h1 className="mt-1 font-display text-3xl sm:text-[2.5rem]">History</h1>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <p className="eyebrow tabular-nums">{rows.length} of last 50</p>
          <ClearAllSessionsButton count={rows.length} />
        </div>
      </header>

      {rows.length === 0 ? (
        <div className="mt-12 border border-dashed border-rule px-6 py-16 text-center">
          <p className="font-display-tight text-lg text-ink">
            No sessions yet.
          </p>
          <p className="mt-2 text-sm text-graphite">
            Solve a problem and we&apos;ll save the trace here.
          </p>
          <Link
            href="/"
            className="mt-5 inline-flex items-baseline gap-2 text-sm font-medium text-ink"
          >
            <span className="marker-underline">Browse problems</span>
            <span aria-hidden>→</span>
          </Link>
        </div>
      ) : (
        <ul>
          {rows.map((r) => {
            const p = getProblem(r.problem_id);
            const duration =
              r.submitted_at && r.started_at
                ? r.submitted_at - r.started_at
                : 0;
            const href = r.has_report
              ? `/report/${r.id}`
              : r.submitted_at
                ? `/analysis/${r.id}`
                : `/practice/${r.problem_id}`;
            return (
              <li key={r.id} className="border-b border-rule">
                <Link
                  href={href}
                  className="group grid grid-cols-12 items-baseline gap-x-4 gap-y-1 py-5 transition-colors hover:bg-surface"
                >
                  <span className="col-span-12 font-display-tight text-lg leading-tight text-ink sm:col-span-5">
                    {p?.title ?? r.problem_id}
                  </span>
                  <span className="col-span-6 text-sm text-graphite sm:col-span-3">
                    {p?.subject ?? "?"} · {p?.topic ?? "—"}
                  </span>
                  <span className="col-span-6 font-mono text-xs tabular-nums text-chalk sm:col-span-2">
                    {formatRelativeTime(r.started_at)}
                    {duration > 0 && <> · {formatDuration(duration)}</>}
                  </span>
                  <span className="col-span-12 flex items-center justify-end gap-2 sm:col-span-2">
                    {r.is_correct === 1 && <Badge tone="success">correct</Badge>}
                    {r.is_correct === 0 && <Badge tone="danger">wrong</Badge>}
                    {r.has_report ? (
                      <Badge tone="accent">analyzed</Badge>
                    ) : r.submitted_at ? (
                      <Badge tone="warn">pending</Badge>
                    ) : (
                      <Badge>in progress</Badge>
                    )}
                    <ArrowRight
                      size={14}
                      className="text-chalk transition-transform group-hover:translate-x-0.5 group-hover:text-ink"
                    />
                  </span>
                </Link>
                <div className="-mt-3 flex items-center justify-end gap-2 pb-4">
                  <Link
                    href={`/inspect/${r.id}`}
                    className="inline-flex items-center border border-rule px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-chalk transition-colors hover:border-ink hover:text-ink"
                    title="Open raw stored data for this session"
                  >
                    Inspect raw
                  </Link>
                  <DeleteSessionButton
                    sessionId={r.id}
                    title={p?.title ?? r.problem_id}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
