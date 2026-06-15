import fs from "fs";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getDb, rrwebFilePath, type EventRow } from "@/lib/db";
import { getProblem } from "@/content/problems";
import { formatDuration, formatRelativeTime } from "@/lib/utils";

interface ReportRow {
  session_id: string;
  tags_json: string;
  diagnosis_json: string;
  feedback_md: string;
  features_json: string;
  created_at: number;
}

function prettyJson(raw: string | null | undefined): string {
  if (!raw) return "null";
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border border-rule bg-surface px-3 py-2">
      <div className="font-mono text-[11px] uppercase tracking-wider text-chalk">{label}</div>
      <div className="mt-1 text-sm text-ink">{value}</div>
    </div>
  );
}

export default function InspectSessionPage({
  params,
}: {
  params: { sessionId: string };
}) {
  const db = getDb();

  const session = db
    .prepare(
      "SELECT id, problem_id, started_at, submitted_at, final_answer, is_correct FROM sessions WHERE id = ?"
    )
    .get(params.sessionId) as
    | {
        id: string;
        problem_id: string;
        started_at: number;
        submitted_at: number | null;
        final_answer: string | null;
        is_correct: number | null;
      }
    | undefined;
  if (!session) notFound();

  const problem = getProblem(session.problem_id);
  const report = db
    .prepare(
      "SELECT session_id, tags_json, diagnosis_json, feedback_md, features_json, created_at FROM reports WHERE session_id = ?"
    )
    .get(params.sessionId) as ReportRow | undefined;
  const events = db
    .prepare(
      "SELECT id, session_id, type, step_id, payload_json, ts FROM events WHERE session_id = ? ORDER BY ts ASC"
    )
    .all(params.sessionId) as EventRow[];
  const chats = db
    .prepare(
      "SELECT role, content, ts FROM chat_messages WHERE session_id = ? ORDER BY ts ASC"
    )
    .all(params.sessionId) as { role: string; content: string; ts: number }[];

  let rrwebPath: string | null = null;
  let rrwebExists = false;
  let rrwebBytes = 0;
  let rrwebLines = 0;
  try {
    rrwebPath = rrwebFilePath(params.sessionId);
    if (fs.existsSync(rrwebPath)) {
      rrwebExists = true;
      const stat = fs.statSync(rrwebPath);
      rrwebBytes = stat.size;
      const text = fs.readFileSync(rrwebPath, "utf8");
      rrwebLines = text.split("\n").filter(Boolean).length;
    }
  } catch {
    rrwebPath = null;
  }

  const duration = session.submitted_at
    ? session.submitted_at - session.started_at
    : null;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <Link
        href={report ? `/report/${params.sessionId}` : "/history"}
        className="inline-flex items-center gap-1.5 text-xs text-chalk hover:text-ink"
      >
        <ArrowLeft size={12} /> Back
      </Link>

      <header className="mt-4 border-b border-ink pb-5">
        <p className="eyebrow">session inspector</p>
        <h1 className="mt-1 font-display text-3xl leading-tight sm:text-[2.5rem]">
          {problem?.title ?? session.problem_id}
        </h1>
        <p className="mt-2 font-mono text-xs text-chalk">#{session.id}</p>
      </header>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Subject" value={problem?.subject ?? "?"} />
        <Stat label="Topic" value={problem?.topic ?? "—"} />
        <Stat label="Started" value={formatRelativeTime(session.started_at)} />
        <Stat label="Duration" value={duration == null ? "in progress" : formatDuration(duration)} />
        <Stat label="Final correctness" value={session.is_correct == null ? "null" : session.is_correct === 1 ? "correct" : "wrong"} />
        <Stat label="Event rows" value={events.length} />
        <Stat label="Chat messages" value={chats.length} />
        <Stat label="rrweb" value={rrwebExists ? `${rrwebLines} lines · ${rrwebBytes} bytes` : "missing"} />
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="space-y-6">
          <div>
            <h2 className="font-display-tight text-lg text-ink">Session row</h2>
            <pre className="mt-3 overflow-x-auto border border-rule bg-surface p-4 font-mono text-xs leading-relaxed text-ink">{prettyJson(JSON.stringify(session))}</pre>
          </div>

          <div>
            <h2 className="font-display-tight text-lg text-ink">Final answer</h2>
            <pre className="mt-3 overflow-x-auto border border-rule bg-surface p-4 font-mono text-xs leading-relaxed text-ink">{session.final_answer ?? "null"}</pre>
          </div>

          <div>
            <h2 className="font-display-tight text-lg text-ink">Event stream</h2>
            <pre className="mt-3 max-h-[32rem] overflow-auto border border-rule bg-surface p-4 font-mono text-xs leading-relaxed text-ink">{events.map((event) => prettyJson(JSON.stringify(event))).join("\n\n") || "(no events)"}</pre>
          </div>

          <div>
            <h2 className="font-display-tight text-lg text-ink">Chat messages</h2>
            <pre className="mt-3 max-h-[20rem] overflow-auto border border-rule bg-surface p-4 font-mono text-xs leading-relaxed text-ink">{chats.map((chat) => prettyJson(JSON.stringify(chat))).join("\n\n") || "(no chat)"}</pre>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <h2 className="font-display-tight text-lg text-ink">Report status</h2>
            <pre className="mt-3 overflow-x-auto border border-rule bg-surface p-4 font-mono text-xs leading-relaxed text-ink">{report ? `created_at=${report.created_at}` : "(no report row)"}</pre>
          </div>

          <div>
            <h2 className="font-display-tight text-lg text-ink">Features JSON</h2>
            <pre className="mt-3 max-h-[18rem] overflow-auto border border-rule bg-surface p-4 font-mono text-xs leading-relaxed text-ink">{report ? prettyJson(report.features_json) : "(no report)"}</pre>
          </div>

          <div>
            <h2 className="font-display-tight text-lg text-ink">Behavior tags JSON</h2>
            <pre className="mt-3 max-h-[18rem] overflow-auto border border-rule bg-surface p-4 font-mono text-xs leading-relaxed text-ink">{report ? prettyJson(report.tags_json) : "(no report)"}</pre>
          </div>

          <div>
            <h2 className="font-display-tight text-lg text-ink">Diagnosis JSON</h2>
            <pre className="mt-3 max-h-[18rem] overflow-auto border border-rule bg-surface p-4 font-mono text-xs leading-relaxed text-ink">{report ? prettyJson(report.diagnosis_json) : "(no report)"}</pre>
          </div>

          <div>
            <h2 className="font-display-tight text-lg text-ink">Feedback markdown</h2>
            <pre className="mt-3 max-h-[18rem] overflow-auto border border-rule bg-surface p-4 font-mono text-xs leading-relaxed text-ink">{report?.feedback_md ?? "(no report)"}</pre>
          </div>

          <div>
            <h2 className="font-display-tight text-lg text-ink">rrweb file</h2>
            <pre className="mt-3 overflow-x-auto border border-rule bg-surface p-4 font-mono text-xs leading-relaxed text-ink">{rrwebPath == null ? "invalid session id" : rrwebExists ? rrwebPath : `${rrwebPath}\n(missing)`}</pre>
          </div>
        </div>
      </section>
    </div>
  );
}
