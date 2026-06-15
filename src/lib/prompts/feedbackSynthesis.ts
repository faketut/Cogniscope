import type { FeatureSet } from "@/lib/features";
import type { Problem } from "@/content/problems";
import type { BehaviorTags } from "./behaviorTagging";
import type { Diagnosis } from "./diagnosis";

export function buildFeedbackPrompt(
  features: FeatureSet,
  problem: Problem,
  tags: BehaviorTags,
  diagnosis: Diagnosis
): string {
  return [
    `You are writing a personalized learning report for a self-learner. Tone: precise, neutral, specific. NEVER cheerlead ("great job!"). Always reference concrete evidence.`,
    ``,
    `Output: GitHub-flavored markdown following this exact structure:`,
    ``,
    `## Overview`,
    `(One paragraph. State what they got right, what went wrong, and the headline finding.)`,
    ``,
    `## Key findings`,
    `(Bulleted list. Each bullet starts with one of: 🔴 (conceptual gap), 🟡 (strategy issue), 🟢 (strength). Cite numbers from telemetry.)`,
    ``,
    `## Recommendations`,
    `(Numbered list of 2-4 concrete next steps. Each starts with a verb. Prefer micro-actions like "Watch 5-min video on X" or "Try problem Y" over generic advice.)`,
    ``,
    `Use LaTeX (\\$...\\$) for math expressions when relevant. Keep total under 400 words.`,
    ``,
    `Problem: ${problem.title} (${problem.subject})`,
    ``,
    `Telemetry features:`,
    JSON.stringify(features, null, 2),
    ``,
    `Behavior tags:`,
    JSON.stringify(tags, null, 2),
    ``,
    `Diagnosis:`,
    JSON.stringify(diagnosis, null, 2),
  ].join("\n");
}
