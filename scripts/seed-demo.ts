/**
 * scripts/seed-demo.ts
 *
 * Seeds 4 realistic sessions so /history and /report land hard on first visit.
 * Each session fabricates a plausible event stream, writes it to the DB, then
 * runs the real analyzer pipeline so the reports are genuine.
 *
 * Run with:  pnpm seed
 *
 * Safe to run multiple times — it removes its prior seed rows first.
 * Uses whatever LLM_PROVIDER is set in your .env.local (mock = fast, gemini = real).
 */

import { nanoid } from "nanoid";
import { getDb, deleteSession } from "@/lib/db";
import { analyzeSession } from "@/lib/analyzer";

// Tag rows so re-seeding cleans up its own mess and never touches user data.
const SEED_PREFIX = "seed-";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Four hand-tuned event streams.                                           */
/*  These read like real sessions, not "every event type once".              */
/* ────────────────────────────────────────────────────────────────────────── */

type Ev = { type: string; stepId?: string; payload?: Record<string, unknown>; tOffsetMs: number };
type Built = { ev: Ev[]; duration: number; finalAnswer: string; isCorrect: boolean | null };

function quadraticStuckSession(): Built {
  // 4-minute session, learner gets the first step but flounders on the second.
  const ev: Ev[] = [
    { type: "step_focus", stepId: "find-factors", tOffsetMs: 800 },
    { type: "answer_change", stepId: "find-factors", payload: { value: "2" }, tOffsetMs: 4_200 },
    { type: "answer_change", stepId: "find-factors", payload: { value: "2,3" }, tOffsetMs: 6_800 },
    { type: "answer_change", stepId: "find-factors", payload: { value: "-3,2" }, tOffsetMs: 14_500 },
    { type: "step_blur", stepId: "find-factors", tOffsetMs: 16_100 },

    { type: "step_focus", stepId: "factored-form", tOffsetMs: 17_000 },
    { type: "answer_change", stepId: "factored-form", payload: { value: "(x+3)(x-2)" }, tOffsetMs: 28_000 },
    { type: "idle", payload: { durationMs: 12_000 }, tOffsetMs: 42_000 },
    { type: "erase", stepId: "factored-form", payload: { count: 12 }, tOffsetMs: 56_000 },
    { type: "answer_change", stepId: "factored-form", payload: { value: "(x-3)(x-2)" }, tOffsetMs: 70_000 },
    { type: "idle", payload: { durationMs: 18_000 }, tOffsetMs: 92_000 },
    { type: "tab_blur", tOffsetMs: 95_000 },
    { type: "tab_focus", tOffsetMs: 140_000 },
    { type: "answer_change", stepId: "factored-form", payload: { value: "(x+3)(x+2)" }, tOffsetMs: 150_000 },
    { type: "step_blur", stepId: "factored-form", tOffsetMs: 152_000 },

    { type: "step_focus", stepId: "roots", tOffsetMs: 153_000 },
    { type: "answer_change", stepId: "roots", payload: { value: "-3,-2" }, tOffsetMs: 168_000 },
    { type: "step_blur", stepId: "roots", tOffsetMs: 170_000 },

    { type: "step_submit", payload: { kind: "final" }, tOffsetMs: 175_000 },
  ];
  return {
    ev,
    duration: 178_000,
    finalAnswer: JSON.stringify({
      "find-factors": "-3,2",
      "factored-form": "(x+3)(x+2)",
      roots: "-3,-2",
    }),
    isCorrect: false,
  };
}

function chainRuleFluentSession(): Built {
  // ~90s clean run, no idle, all correct.
  const ev: Ev[] = [
    { type: "step_focus", stepId: "outer", tOffsetMs: 500 },
    { type: "answer_change", stepId: "outer", payload: { value: "cos(u)" }, tOffsetMs: 6_000 },
    { type: "step_blur", stepId: "outer", tOffsetMs: 7_000 },

    { type: "step_focus", stepId: "inner", tOffsetMs: 7_500 },
    { type: "answer_change", stepId: "inner", payload: { value: "6x" }, tOffsetMs: 14_000 },
    { type: "step_blur", stepId: "inner", tOffsetMs: 15_000 },

    { type: "step_focus", stepId: "combine", tOffsetMs: 15_500 },
    { type: "answer_change", stepId: "combine", payload: { value: "6x*cos(3x^2+1)" }, tOffsetMs: 32_000 },
    { type: "step_blur", stepId: "combine", tOffsetMs: 33_000 },

    { type: "step_submit", payload: { kind: "final" }, tOffsetMs: 34_500 },
  ];
  return {
    ev,
    duration: 36_000,
    finalAnswer: JSON.stringify({
      outer: "cos(u)",
      inner: "6x",
      combine: "6x*cos(3x^2+1)",
    }),
    isCorrect: true,
  };
}

function twoSumPasteSession(): Built {
  // 3 min, one suspicious paste, two code runs, eventual pass.
  const finalCode = `function twoSum(nums, target) {
  const seen = new Map();
  for (let i = 0; i < nums.length; i++) {
    const need = target - nums[i];
    if (seen.has(need)) return [seen.get(need), i];
    seen.set(nums[i], i);
  }
}`;
  const ev: Ev[] = [
    { type: "step_focus", stepId: "code", tOffsetMs: 1_000 },
    { type: "answer_change", stepId: "code", payload: { value: "function twoSum() {}" }, tOffsetMs: 8_000 },
    { type: "idle", payload: { durationMs: 11_000 }, tOffsetMs: 22_000 },
    { type: "paste", stepId: "code", payload: { length: 142 }, tOffsetMs: 38_000 },
    { type: "large_paste", stepId: "code", payload: { length: 142 }, tOffsetMs: 38_000 },
    { type: "answer_change", stepId: "code", payload: { value: "// pasted skeleton" }, tOffsetMs: 39_000 },
    { type: "code_run", payload: { passed: 1, total: 3 }, tOffsetMs: 60_000 },
    { type: "erase", stepId: "code", payload: { count: 45 }, tOffsetMs: 78_000 },
    { type: "answer_change", stepId: "code", payload: { value: "// iterating" }, tOffsetMs: 100_000 },
    { type: "answer_change", stepId: "code", payload: { value: finalCode }, tOffsetMs: 145_000 },
    { type: "code_run", payload: { passed: 3, total: 3 }, tOffsetMs: 165_000 },
    { type: "step_submit", payload: { kind: "final" }, tOffsetMs: 175_000 },
  ];
  return {
    ev,
    duration: 178_000,
    finalAnswer: finalCode,
    isCorrect: null,
  };
}

function integrationDistractedSession(): Built {
  // 6 min, multiple tab switches, partial correct (uv-∫v du arithmetic slip)
  const ev: Ev[] = [
    { type: "step_focus", stepId: "choose-u", tOffsetMs: 1_000 },
    { type: "answer_change", stepId: "choose-u", payload: { value: "x" }, tOffsetMs: 5_000 },
    { type: "step_blur", stepId: "choose-u", tOffsetMs: 6_000 },

    { type: "step_focus", stepId: "choose-dv", tOffsetMs: 6_500 },
    { type: "tab_blur", tOffsetMs: 12_000 },
    { type: "tab_focus", tOffsetMs: 55_000 },
    { type: "answer_change", stepId: "choose-dv", payload: { value: "e^x dx" }, tOffsetMs: 62_000 },
    { type: "step_blur", stepId: "choose-dv", tOffsetMs: 63_000 },

    { type: "step_focus", stepId: "compute-du-v", tOffsetMs: 64_000 },
    { type: "answer_change", stepId: "compute-du-v", payload: { value: "dx,e^x" }, tOffsetMs: 95_000 },
    { type: "step_blur", stepId: "compute-du-v", tOffsetMs: 96_000 },

    { type: "step_focus", stepId: "result", tOffsetMs: 97_000 },
    { type: "tab_blur", tOffsetMs: 110_000 },
    { type: "tab_focus", tOffsetMs: 180_000 },
    { type: "answer_change", stepId: "result", payload: { value: "x*e^x+e^x+C" }, tOffsetMs: 240_000 },
    { type: "idle", payload: { durationMs: 25_000 }, tOffsetMs: 270_000 },
    { type: "erase", stepId: "result", payload: { count: 4 }, tOffsetMs: 300_000 },
    { type: "answer_change", stepId: "result", payload: { value: "x*e^x-e^x" }, tOffsetMs: 320_000 },
    { type: "step_blur", stepId: "result", tOffsetMs: 322_000 },

    { type: "step_submit", payload: { kind: "final" }, tOffsetMs: 330_000 },
  ];
  return {
    ev,
    duration: 333_000,
    finalAnswer: JSON.stringify({
      "choose-u": "x",
      "choose-dv": "e^x dx",
      "compute-du-v": "dx,e^x",
      result: "x*e^x-e^x", // missing + C
    }),
    isCorrect: false,
  };
}

/* ────────────────────────────────────────────────────────────────────────── */

const SEEDS: Array<{ problemId: string; build: () => Built }> = [
  { problemId: "quadratic-factoring", build: quadraticStuckSession },
  { problemId: "chain-rule", build: chainRuleFluentSession },
  { problemId: "two-sum", build: twoSumPasteSession },
  { problemId: "integration-by-parts", build: integrationDistractedSession },
];

async function main() {
  const db = getDb();

  // Wipe prior seeds. `deleteSession` cascades events/reports/chat via FK and
  // also removes the on-disk rrweb file, so seeds don't pile up under
  // data/sessions/.
  const prevSeeds = db
    .prepare(`SELECT id FROM sessions WHERE id LIKE 'seed-%'`)
    .all() as { id: string }[];
  if (prevSeeds.length > 0) {
    for (const { id } of prevSeeds) deleteSession(id);
    console.log(`Removed ${prevSeeds.length} previous seed session(s).`);
  }

  // Stagger session start times so they appear distinct in /history.
  const now = Date.now();
  const offsets = [60 * 60_000, 3 * 60 * 60_000, 24 * 60 * 60_000, 3 * 24 * 60 * 60_000];

  const insertSession = db.prepare(
    `INSERT INTO sessions (id, problem_id, started_at, submitted_at, final_answer, is_correct)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  const insertEvent = db.prepare(
    `INSERT INTO events (session_id, type, step_id, payload_json, ts) VALUES (?, ?, ?, ?, ?)`
  );

  const ids: string[] = [];
  for (let i = 0; i < SEEDS.length; i++) {
    const seed = SEEDS[i];
    const built = seed.build();
    const startedAt = now - offsets[i] - built.duration;
    const submittedAt = startedAt + built.duration;
    const sessionId = `seed-${nanoid(8)}`;

    insertSession.run(
      sessionId,
      seed.problemId,
      startedAt,
      submittedAt,
      built.finalAnswer,
      built.isCorrect == null ? null : built.isCorrect ? 1 : 0
    );

    // Implicit session_start event
    insertEvent.run(sessionId, "session_start", null, JSON.stringify({ problemId: seed.problemId }), startedAt);
    for (const e of built.ev) {
      insertEvent.run(
        sessionId,
        e.type,
        e.stepId ?? null,
        e.payload ? JSON.stringify(e.payload) : null,
        startedAt + e.tOffsetMs
      );
    }
    console.log(`Seeded session ${sessionId} (${seed.problemId}).`);
    ids.push(sessionId);
  }

  // Run the real analyzer pipeline on each so reports are populated.
  console.log(`\nAnalyzing ${ids.length} sessions via LLM_PROVIDER=${process.env.LLM_PROVIDER ?? "mock"}...`);
  for (const id of ids) {
    try {
      await analyzeSession(id);
      console.log(`✓ analyzed ${id}`);
    } catch (err) {
      console.error(`✗ failed to analyze ${id}:`, (err as Error).message);
    }
  }

  console.log(`\nDone. Open /history to see them.`);
  console.log(`Seed session ids are prefixed with "${SEED_PREFIX}".`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
