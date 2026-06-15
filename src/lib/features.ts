import type { Problem } from "@/content/problems";

export interface StoredEvent {
  type: string;
  step_id: string | null;
  payload_json: string | null;
  ts: number;
}

export interface StepFeature {
  stepId: string;
  prompt: string;
  expected: string;
  submitted: string;
  firstFocusTs: number | null;
  dwellMs: number; // total time focused on this step
  editCount: number; // distinct answer_change events
  pasteCount: number;
  hintRequested: boolean;
  firstAttemptCorrect: boolean | null; // null when grading not available
  finalCorrect: boolean | null;
}

export interface FeatureSet {
  sessionId: string;
  problemId: string;
  subject: "math" | "programming";
  durationMs: number;
  totalEvents: number;
  pasteCount: number;
  tabSwitchCount: number;
  idleEventCount: number;
  idleMsTotal: number;
  idleRatio: number;
  editsTotal: number;
  hintsRequested: number;
  // For math: per-step features. For programming: a single synthetic step.
  steps: StepFeature[];
  // Order in which steps were first focused (math). Helps detect skipping.
  focusOrder: string[];
  // Was the order strictly increasing through problem.steps?
  inOrder: boolean | null;
  // Final answer
  finalAnswer: string | null;
  finalCorrect: boolean | null;
  // For programming
  code?: {
    finalLines: number;
    finalChars: number;
    runs: number;
    bestRunPassed: number | null;
    bestRunTotal: number | null;
  };
}

function safeParse(json: string | null): Record<string, unknown> {
  if (!json) return {};
  try {
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function extractFeatures(
  events: StoredEvent[],
  problem: Problem,
  meta: { sessionId: string; startedAt: number; submittedAt: number | null; finalAnswer: string | null; isCorrect: number | null }
): FeatureSet {
  const sorted = [...events].sort((a, b) => a.ts - b.ts);

  const submittedAt = meta.submittedAt ?? sorted[sorted.length - 1]?.ts ?? meta.startedAt;
  const durationMs = Math.max(0, submittedAt - meta.startedAt);

  /* ------- per-step bookkeeping (math) ------- */
  const stepIds: string[] =
    problem.subject === "math" ? problem.steps.map((s) => s.id) : ["__code__"];

  const stepAcc = new Map<
    string,
    {
      firstFocus: number | null;
      lastFocus: number | null;
      dwellMs: number;
      editCount: number;
      pasteCount: number;
      hint: boolean;
      lastValue: string;
      firstAnswer: string | null;
    }
  >();
  for (const id of stepIds)
    stepAcc.set(id, {
      firstFocus: null,
      lastFocus: null,
      dwellMs: 0,
      editCount: 0,
      pasteCount: 0,
      hint: false,
      lastValue: "",
      firstAnswer: null,
    });

  let pasteCount = 0;
  let tabSwitchCount = 0;
  let idleEventCount = 0;
  let idleMsTotal = 0;
  let editsTotal = 0;
  let hintsRequested = 0;
  const focusOrder: string[] = [];
  const focusedSet = new Set<string>();
  let codeRuns = 0;
  let bestRunPassed: number | null = null;
  let bestRunTotal: number | null = null;

  for (const e of sorted) {
    const p = safeParse(e.payload_json);
    const sid = e.step_id;

    switch (e.type) {
      case "step_focus": {
        if (sid && stepAcc.has(sid)) {
          const acc = stepAcc.get(sid)!;
          if (acc.firstFocus == null) acc.firstFocus = e.ts;
          acc.lastFocus = e.ts;
          if (!focusedSet.has(sid)) {
            focusedSet.add(sid);
            focusOrder.push(sid);
          }
        }
        break;
      }
      case "step_blur": {
        if (sid && stepAcc.has(sid)) {
          const acc = stepAcc.get(sid)!;
          if (acc.lastFocus != null) {
            acc.dwellMs += Math.max(0, e.ts - acc.lastFocus);
            acc.lastFocus = null;
          }
        }
        break;
      }
      case "answer_change": {
        editsTotal++;
        if (sid && stepAcc.has(sid)) {
          const acc = stepAcc.get(sid)!;
          acc.editCount++;
          const to = String(p.to ?? "");
          if (acc.firstAnswer == null && to.trim().length > 0) {
            acc.firstAnswer = to;
          }
          acc.lastValue = to;
        } else if (problem.subject === "programming") {
          const acc = stepAcc.get("__code__")!;
          acc.editCount++;
        }
        break;
      }
      case "copy_paste": {
        if (p.kind === "paste") {
          pasteCount++;
          if (sid && stepAcc.has(sid)) stepAcc.get(sid)!.pasteCount++;
        }
        break;
      }
      case "tab_visibility": {
        if (p.state === "hidden") tabSwitchCount++;
        break;
      }
      case "idle": {
        idleEventCount++;
        idleMsTotal += Number(p.durationMs ?? 0);
        break;
      }
      case "hint_request": {
        hintsRequested++;
        if (sid && stepAcc.has(sid)) stepAcc.get(sid)!.hint = true;
        break;
      }
      case "code_run": {
        codeRuns++;
        break;
      }
      case "code_run_result": {
        const passed = Number(p.passed ?? 0);
        const total = Number(p.total ?? 0);
        if (total > 0) {
          if (bestRunPassed == null || passed > bestRunPassed) {
            bestRunPassed = passed;
            bestRunTotal = total;
          }
        }
        break;
      }
    }
  }

  // Close any still-focused step at submission time
  for (const acc of stepAcc.values()) {
    if (acc.lastFocus != null) {
      acc.dwellMs += Math.max(0, submittedAt - acc.lastFocus);
      acc.lastFocus = null;
    }
  }

  /* ------- compute step features ------- */
  let stepFeatures: StepFeature[];
  let finalAnswerMap: Record<string, string> = {};
  try {
    if (meta.finalAnswer && problem.subject === "math") {
      finalAnswerMap = JSON.parse(meta.finalAnswer);
    }
  } catch {
    /* ignore */
  }

  if (problem.subject === "math") {
    stepFeatures = problem.steps.map((s) => {
      const acc = stepAcc.get(s.id)!;
      const submitted = finalAnswerMap[s.id] ?? acc.lastValue ?? "";
      const finalCorrect = answersEqualLocal(submitted, s.expectedAnswer);
      const firstAttemptCorrect =
        acc.firstAnswer == null
          ? null
          : answersEqualLocal(acc.firstAnswer, s.expectedAnswer);
      return {
        stepId: s.id,
        prompt: s.prompt,
        expected: s.expectedAnswer,
        submitted,
        firstFocusTs: acc.firstFocus,
        dwellMs: acc.dwellMs,
        editCount: acc.editCount,
        pasteCount: acc.pasteCount,
        hintRequested: acc.hint,
        firstAttemptCorrect,
        finalCorrect,
      };
    });
  } else {
    const acc = stepAcc.get("__code__")!;
    const code = meta.finalAnswer ?? "";
    stepFeatures = [
      {
        stepId: "__code__",
        prompt: problem.title,
        expected: "(see test cases)",
        submitted: code,
        firstFocusTs: acc.firstFocus,
        dwellMs: durationMs, // code editing has no focus/blur per step
        editCount: acc.editCount,
        pasteCount: acc.pasteCount,
        hintRequested: false,
        firstAttemptCorrect: null,
        finalCorrect: null,
      },
    ];
  }

  // Check if focus order matches problem step order
  let inOrder: boolean | null = null;
  if (problem.subject === "math" && focusOrder.length > 0) {
    const expectedOrder = problem.steps.map((s) => s.id);
    const focused = focusOrder.filter((id) => expectedOrder.includes(id));
    inOrder = focused.every(
      (id, i) =>
        i === 0 ||
        expectedOrder.indexOf(id) >= expectedOrder.indexOf(focused[i - 1])
    );
  }

  const idleRatio = durationMs > 0 ? idleMsTotal / durationMs : 0;

  return {
    sessionId: meta.sessionId,
    problemId: problem.id,
    subject: problem.subject,
    durationMs,
    totalEvents: sorted.length,
    pasteCount,
    tabSwitchCount,
    idleEventCount,
    idleMsTotal,
    idleRatio,
    editsTotal,
    hintsRequested,
    steps: stepFeatures,
    focusOrder,
    inOrder,
    finalAnswer: meta.finalAnswer,
    finalCorrect: meta.isCorrect == null ? null : Boolean(meta.isCorrect),
    code:
      problem.subject === "programming"
        ? {
            finalLines: (meta.finalAnswer ?? "").split("\n").length,
            finalChars: (meta.finalAnswer ?? "").length,
            runs: codeRuns,
            bestRunPassed,
            bestRunTotal,
          }
        : undefined,
  };
}

// Local copy of grading.normalize to avoid a server/client coupling concern
function answersEqualLocal(a: string, b: string): boolean {
  const n = (s: string) =>
    s
      .toLowerCase()
      .replace(/[\u2212\u2013\u2014]/g, "-")
      .replace(/\s+/g, "")
      .replace(/[;]+$/g, "")
      .replace(/\*\*/g, "^")
      .replace(/·/g, "*");
  return n(a) === n(b);
}
