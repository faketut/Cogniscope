import type {
  ChatMessage,
  LLMProvider,
} from "./types";

/**
 * Mock LLM — returns plausible canned data so we can develop the pipeline and
 * UI without burning quota. Activated by `LLM_PROVIDER=mock`.
 */
export class MockProvider implements LLMProvider {
  name = "mock";

  async complete(_prompt: string): Promise<string> {
    return "This is a mock LLM response. Set LLM_PROVIDER=gemini and add a GEMINI_API_KEY to enable real analysis.";
  }

  async completeJSON<T>(prompt: string): Promise<T> {
    // Phase markers are injected by each prompt builder (e.g. "[PHASE:behavior_tagging]").
    if (prompt.includes("[PHASE:behavior_tagging]")) {
      return {
        cognitiveState: "stuck",
        strategy: "trial_and_error",
        errorTypes: ["conceptual"],
        perStep: [
          {
            stepId: "find-factors",
            state: "stuck",
            note: "Multiple sign-flip attempts before settling on the right pair.",
          },
          { stepId: "factored-form", state: "fluent" },
          { stepId: "roots", state: "fluent" },
        ],
        confidence: 0.6,
        summary:
          "Trial-and-error on step 1 (3 distinct edits in ~24s) suggests an unsettled rule for sign handling rather than a careless slip.",
      } as unknown as T;
    }
    if (prompt.includes("[PHASE:diagnosis]")) {
      return {
        rootCauses: [
          {
            type: "conceptual",
            description:
              "Uncertain about which factor takes the negative sign when c < 0.",
            evidence:
              "Step 1 saw 3 answer changes (2,-3 → -2,3 → -3,2) in 24s.",
            confidence: 0.7,
          },
        ],
        misconceptions: [
          "Sign assignment when factoring quadratics with negative constants",
        ],
        strengths: [
          "Once the factor pair was correct, conversion to factored form and roots was fast and clean.",
        ],
      } as unknown as T;
    }
    return {
      note: "mock JSON response — pipeline phase not specifically mocked",
    } as unknown as T;
  }

  async *streamChat(messages: ChatMessage[]): AsyncIterable<string> {
    const last = messages[messages.length - 1]?.content ?? "";
    const reply = `Mock reply to: "${last.slice(0, 80)}..." Set LLM_PROVIDER=gemini for real tutoring.`;
    for (const chunk of reply.match(/.{1,8}/g) ?? []) {
      await new Promise((r) => setTimeout(r, 30));
      yield chunk;
    }
  }
}
