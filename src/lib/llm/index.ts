import type { LLMProvider } from "./types";
import { MockProvider } from "./mock";

let _provider: LLMProvider | null = null;

export function getLLM(): LLMProvider {
  if (_provider) return _provider;

  const choice = (process.env.LLM_PROVIDER || "mock").toLowerCase();

  if (choice === "gemini") {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn(
        "[llm] LLM_PROVIDER=gemini but GEMINI_API_KEY is missing — falling back to mock."
      );
      _provider = new MockProvider();
      return _provider;
    }
    // Lazy import so node doesn't load it in mock mode
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { GeminiProvider } = require("./gemini") as typeof import("./gemini");
    _provider = new GeminiProvider(apiKey);
    return _provider;
  }

  if (choice === "qwen") {
    const apiKey = process.env.QWEN_API_KEY;
    if (!apiKey) {
      console.warn(
        "[llm] LLM_PROVIDER=qwen but QWEN_API_KEY is missing — falling back to mock."
      );
      _provider = new MockProvider();
      return _provider;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { QwenProvider } = require("./qwen") as typeof import("./qwen");
      _provider = new QwenProvider(apiKey);
    } catch (err) {
      console.warn(
        `[llm] Qwen provider failed to initialise (${(err as Error).message}) — falling back to mock.`
      );
      _provider = new MockProvider();
    }
    return _provider;
  }

  _provider = new MockProvider();
  return _provider;
}

export type { LLMProvider, ChatMessage, CompleteOptions } from "./types";
