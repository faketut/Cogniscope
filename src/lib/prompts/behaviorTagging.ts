import type { FeatureSet } from "@/lib/features";
import type { Problem } from "@/content/problems";

export const BehaviorTagsSchema = {
  type: "object",
  properties: {
    cognitiveState: {
      type: "string",
      enum: ["fluent", "stuck", "confused", "distracted"],
    },
    strategy: {
      type: "string",
      enum: [
        "systematic",
        "trial_and_error",
        "pattern_matching",
        "skip_and_guess",
        "external_reference",
      ],
    },
    errorTypes: {
      type: "array",
      items: {
        type: "string",
        enum: ["conceptual", "procedural", "computational", "careless", "none"],
      },
    },
    perStep: {
      type: "array",
      items: {
        type: "object",
        properties: {
          stepId: { type: "string" },
          state: {
            type: "string",
            enum: ["fluent", "hesitant", "stuck", "error"],
          },
          note: { type: "string" },
        },
        required: ["stepId", "state"],
      },
    },
    confidence: { type: "number" },
    summary: { type: "string" },
  },
  required: ["cognitiveState", "strategy", "errorTypes", "perStep", "summary"],
} as const;

export interface BehaviorTags {
  cognitiveState: "fluent" | "stuck" | "confused" | "distracted";
  strategy:
    | "systematic"
    | "trial_and_error"
    | "pattern_matching"
    | "skip_and_guess"
    | "external_reference";
  errorTypes: ("conceptual" | "procedural" | "computational" | "careless" | "none")[];
  perStep: { stepId: string; state: "fluent" | "hesitant" | "stuck" | "error"; note?: string }[];
  confidence?: number;
  summary: string;
}

export function buildBehaviorTaggingPrompt(features: FeatureSet, problem: Problem): string {
  return [
    `[PHASE:behavior_tagging]`,
    `You are a learning-science analyst. The input is **behavior telemetry** from a self-learner solving a problem, plus the problem itself. Your job is to classify the learner's process — NOT to grade the answer.`,
    ``,
    `Use this taxonomy:`,
    `- cognitiveState: fluent | stuck | confused | distracted`,
    `- strategy: systematic | trial_and_error | pattern_matching | skip_and_guess | external_reference`,
    `- errorTypes: subset of {conceptual, procedural, computational, careless, none}`,
    ``,
    `Behavior tagging guidelines:`,
    `- Many edits + long dwell + wrong answer => likely stuck + conceptual`,
    `- Few edits + short dwell + wrong answer => likely careless or skip_and_guess`,
    `- Hint requested + subsequent correct => pattern_matching ok`,
    `- Tab switches > 1 => external_reference likely`,
    `- Skipping the problem step order => skip_and_guess or non-systematic`,
    ``,
    `Problem (JSON):`,
    JSON.stringify(
      {
        id: problem.id,
        subject: problem.subject,
        title: problem.title,
        topic: problem.topic,
        difficulty: problem.difficulty,
      },
      null,
      2
    ),
    ``,
    `Telemetry features (JSON):`,
    JSON.stringify(features, null, 2),
    ``,
    `Return ONLY a JSON object matching the schema. The "summary" must be ONE precise sentence referencing actual numbers from the features (e.g. "Step 2 saw 4 edits in 38s").`,
  ].join("\n");
}
