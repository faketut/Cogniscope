import type { FeatureSet } from "@/lib/features";
import type { Problem } from "@/content/problems";
import type { BehaviorTags } from "./behaviorTagging";

export const DiagnosisSchema = {
  type: "object",
  properties: {
    rootCauses: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["conceptual", "procedural", "computational", "strategic", "metacognitive"],
          },
          description: { type: "string" },
          evidence: { type: "string" },
          confidence: { type: "number" },
        },
        required: ["type", "description", "evidence"],
      },
    },
    misconceptions: { type: "array", items: { type: "string" } },
    strengths: { type: "array", items: { type: "string" } },
  },
  required: ["rootCauses", "misconceptions", "strengths"],
} as const;

export interface Diagnosis {
  rootCauses: {
    type: "conceptual" | "procedural" | "computational" | "strategic" | "metacognitive";
    description: string;
    evidence: string;
    confidence?: number;
  }[];
  misconceptions: string[];
  strengths: string[];
}

export function buildDiagnosisPrompt(
  features: FeatureSet,
  problem: Problem,
  tags: BehaviorTags
): string {
  return [
    `[PHASE:diagnosis]`,
    `You are an expert tutor analyzing a learner's REASONING based on telemetry + initial behavior tags.`,
    `Your goal: find ROOT CAUSES of where their understanding broke down — not surface symptoms.`,
    ``,
    `Distinctions to make:`,
    `- conceptual: misunderstood a definition or rule`,
    `- procedural: knew the concept but mis-applied the steps`,
    `- computational: simple arithmetic / typo slip`,
    `- strategic: chose a bad solving approach`,
    `- metacognitive: didn't notice their own confusion / didn't check work`,
    ``,
    `For EACH root cause, you must cite specific telemetry evidence (e.g. "step 2 took 45s with 4 edits").`,
    ``,
    `Problem:`,
    JSON.stringify(problem, null, 2),
    ``,
    `Telemetry features:`,
    JSON.stringify(features, null, 2),
    ``,
    `Initial behavior tags:`,
    JSON.stringify(tags, null, 2),
    ``,
    `Return ONLY JSON matching the schema. Be CONCISE. 1–3 root causes max. Strengths: 1–2 items.`,
  ].join("\n");
}
