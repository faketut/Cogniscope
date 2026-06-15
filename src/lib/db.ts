import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "app.db");
export const SESSIONS_DIR = path.join(DATA_DIR, "sessions");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR, { recursive: true });

/**
 * Allowed shape for session ids. Accepts nanoid (URL-safe alphabet) and the
 * `seed-…` prefix used by the demo script. Used as defense-in-depth before any
 * string flows into a filesystem path.
 */
const VALID_ID = /^[A-Za-z0-9_-]{1,64}$/;

function assertValidId(id: string): void {
  if (!VALID_ID.test(id)) throw new Error(`invalid session id: ${id}`);
}

// Hot-reload safe singleton — Next.js dev re-evaluates modules but globalThis
// survives, so we don't accumulate dangling better-sqlite3 handles.
const globalForDb = globalThis as unknown as {
  __cogniscopeDb?: Database.Database;
};

export function getDb(): Database.Database {
  if (globalForDb.__cogniscopeDb) return globalForDb.__cogniscopeDb;
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  globalForDb.__cogniscopeDb = db;
  return db;
}

/**
 * Schema versioning via `PRAGMA user_version`. Bump `LATEST_VERSION` and add a
 * branch below when you change the schema. The `CREATE TABLE IF NOT EXISTS`
 * block is the v1 baseline and stays idempotent for new dev DBs.
 */
const LATEST_VERSION = 2;

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      problem_id TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      submitted_at INTEGER,
      final_answer TEXT,
      is_correct INTEGER
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      type TEXT NOT NULL,
      step_id TEXT,
      payload_json TEXT,
      ts INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id, ts);

    CREATE TABLE IF NOT EXISTS reports (
      session_id TEXT PRIMARY KEY,
      tags_json TEXT NOT NULL,
      diagnosis_json TEXT NOT NULL,
      feedback_md TEXT NOT NULL,
      features_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
      content TEXT NOT NULL,
      ts INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_chat_session ON chat_messages(session_id, ts);
  `);

  const current = (db.pragma("user_version", { simple: true }) as number) ?? 0;

  if (current < 2) {
    // Backfill CHECK constraint for existing dev DBs where chat_messages was
    // created before role validation existed.
    db.exec(`
      CREATE TABLE IF NOT EXISTS chat_messages_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
        content TEXT NOT NULL,
        ts INTEGER NOT NULL,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );

      INSERT INTO chat_messages_new (id, session_id, role, content, ts)
      SELECT id, session_id, role, content, ts
      FROM chat_messages
      WHERE role IN ('user','assistant','system');

      DROP TABLE chat_messages;
      ALTER TABLE chat_messages_new RENAME TO chat_messages;
      CREATE INDEX IF NOT EXISTS idx_chat_session ON chat_messages(session_id, ts);
    `);
  }

  if (current !== LATEST_VERSION) {
    db.pragma(`user_version = ${LATEST_VERSION}`);
  }
}

/* ------------------------- helpers ------------------------- */

export interface SessionRow {
  id: string;
  problem_id: string;
  started_at: number;
  submitted_at: number | null;
  final_answer: string | null;
  is_correct: number | null;
}

export interface EventRow {
  id: number;
  session_id: string;
  type: string;
  step_id: string | null;
  payload_json: string | null;
  ts: number;
}

export interface ReportRow {
  session_id: string;
  tags_json: string;
  diagnosis_json: string;
  feedback_md: string;
  features_json: string;
  created_at: number;
}

export interface ChatRow {
  id: number;
  session_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  ts: number;
}

/**
 * Path to the on-disk rrweb JSONL for a session. Validates the id before
 * joining to prevent traversal (`../`, encoded slashes, etc.).
 */
export function rrwebFilePath(sessionId: string): string {
  assertValidId(sessionId);
  return path.join(SESSIONS_DIR, `${sessionId}.rrweb.jsonl`);
}

/**
 * Deletes a session row (events / reports / chat cascade via FK) plus its
 * on-disk rrweb file. Returns the number of session rows deleted (0 or 1).
 */
export function deleteSession(sessionId: string): number {
  assertValidId(sessionId);
  const db = getDb();
  const res = db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
  try {
    fs.unlinkSync(path.join(SESSIONS_DIR, `${sessionId}.rrweb.jsonl`));
  } catch {
    // file may not exist — fine.
  }
  return res.changes as number;
}
