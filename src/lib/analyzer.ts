import { getDb, type EventRow } from "@/lib/db";
import { getProblem } from "@/content/problems";
import { extractFeatures, type FeatureSet } from "@/lib/features";
import { getLLM } from "@/lib/llm";
import {
  buildBehaviorTaggingPrompt,
  BehaviorTagsSchema,
  type BehaviorTags,
} from "@/lib/prompts/behaviorTagging";
import {
  buildDiagnosisPrompt,
  DiagnosisSchema,
  type Diagnosis,
} from "@/lib/prompts/diagnosis";
import { buildFeedbackPrompt } from "@/lib/prompts/feedbackSynthesis";

export interface AnalysisResult {
  features: FeatureSet;
  tags: BehaviorTags;
  diagnosis: Diagnosis;
  feedback: string;
}

export async function analyzeSession(sessionId: string): Promise<AnalysisResult> {
  const db = getDb();
  const session = db
    .prepare(
      "SELECT id, problem_id, started_at, submitted_at, final_answer, is_correct FROM sessions WHERE id = ?"
    )
    .get(sessionId) as
    | {
        id: string;
        problem_id: string;
        started_at: number;
        submitted_at: number | null;
        final_answer: string | null;
        is_correct: number | null;
      }
    | undefined;
  if (!session) throw new Error("session not found");
  const problem = getProblem(session.problem_id);
  if (!problem) throw new Error("problem not found");

  const events = db
    .prepare(
      "SELECT type, step_id, payload_json, ts FROM events WHERE session_id = ? ORDER BY ts ASC"
    )
    .all(sessionId) as EventRow[];

  const features = extractFeatures(
    events.map((e) => ({
      type: e.type,
      step_id: e.step_id,
      payload_json: e.payload_json,
      ts: e.ts,
    })),
    problem,
    {
      sessionId: session.id,
      startedAt: session.started_at,
      submittedAt: session.submitted_at,
      finalAnswer: session.final_answer,
      isCorrect: session.is_correct,
    }
  );

  const llm = getLLM();

  // Phase 2: behavior tagging
  const tags = await llm.completeJSON<BehaviorTags>(
    buildBehaviorTaggingPrompt(features, problem),
    { responseSchema: BehaviorTagsSchema, temperature: 0.3, maxTokens: 4096 }
  );

  // Phase 3: diagnosis
  const diagnosis = await llm.completeJSON<Diagnosis>(
    buildDiagnosisPrompt(features, problem, tags),
    { responseSchema: DiagnosisSchema, temperature: 0.3, maxTokens: 4096 }
  );

  // Phase 4: feedback synthesis
  let feedback: string;
  if (llm.name === "mock") {
    feedback = mockFeedback(features, problem.title);
  } else {
    feedback = await llm.complete(
      buildFeedbackPrompt(features, problem, tags, diagnosis),
      { temperature: 0.5, maxTokens: 1200 }
    );
  }

  // Persist
  db.prepare(
    `INSERT OR REPLACE INTO reports (session_id, tags_json, diagnosis_json, feedback_md, features_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    sessionId,
    JSON.stringify(tags),
    JSON.stringify(diagnosis),
    feedback,
    JSON.stringify(features),
    Date.now()
  );

  return { features, tags, diagnosis, feedback };
}

function mockFeedback(features: FeatureSet, title: string): string {
  const secs = Math.round(features.durationMs / 1000);
  const correct = features.finalCorrect === true;
  return [
    `## Overview`,
    `You spent ${secs}s on **${title}** and your final answer was ${correct ? "correct" : "incorrect"}. The telemetry shows a ${features.editsTotal}-edit pattern with ${features.idleEventCount} idle window(s).`,
    ``,
    `## Key findings`,
    `- ${features.editsTotal > 6 ? "🔴" : "🟡"} You made **${features.editsTotal} edits** across all steps — ${features.editsTotal > 6 ? "high edit count suggests trial-and-error rather than systematic reasoning." : "edit volume is reasonable."}`,
    `- ${features.idleEventCount > 0 ? "🟡" : "🟢"} ${features.idleEventCount > 0 ? `${features.idleEventCount} idle window(s) (${Math.round(features.idleMsTotal / 1000)}s total) suggest moments of being stuck.` : "No noticeable idle periods — you stayed engaged throughout."}`,
    `- ${features.tabSwitchCount > 0 ? "🟡" : "🟢"} ${features.tabSwitchCount > 0 ? `Tab switched ${features.tabSwitchCount} time(s) — likely external lookup.` : "No tab switches detected."}`,
    ``,
    `## Recommendations`,
    `1. Re-derive the answer on paper without aids, then compare each step to your submission.`,
    `2. Find one analogous but slightly simpler problem and time-box yourself to 5 minutes.`,
    `3. Articulate the rule you applied at each step in one sentence — gaps in articulation reveal gaps in understanding.`,
    ``,
    `_This is a mock report. Set \`LLM_PROVIDER=gemini\` and add your API key for real analysis._`,
  ].join("\n");
}
