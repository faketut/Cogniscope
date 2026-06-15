import {
  GoogleGenerativeAI,
  type GenerationConfig,
  type Content,
} from "@google/generative-ai";
import type {
  ChatMessage,
  CompleteOptions,
  LLMProvider,
} from "./types";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

export class GeminiProvider implements LLMProvider {
  name = "gemini";
  private client: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenerativeAI(apiKey);
  }

  private buildConfig(opts?: CompleteOptions): GenerationConfig {
    const cfg: GenerationConfig = {
      temperature: opts?.temperature ?? 0.4,
      maxOutputTokens: opts?.maxTokens ?? 2048,
    };
    if (opts?.responseSchema) {
      cfg.responseMimeType = "application/json";
      // @ts-expect-error — responseSchema is supported by Gemini but not always typed
      cfg.responseSchema = opts.responseSchema;
    }
    return cfg;
  }

  async complete(prompt: string, opts?: CompleteOptions): Promise<string> {
    const model = this.client.getGenerativeModel({
      model: MODEL,
      generationConfig: this.buildConfig(opts),
    });
    const r = await model.generateContent(prompt);
    return r.response.text();
  }

  async completeJSON<T>(prompt: string, opts?: CompleteOptions): Promise<T> {
    const text = await this.complete(prompt, {
      ...opts,
      responseSchema: opts?.responseSchema ?? { type: "object" },
    });
    const first = tryParseLoose<T>(text);
    if (first !== undefined) return first;
    // Retry once with a much stricter instruction. Some Gemini versions still
    // wrap output in ```json fences or trail prose after the closing brace.
    const fixed = await this.complete(
      `${prompt}\n\nReturn ONLY a single valid JSON object. No prose, no markdown fences, no trailing commas.`,
      opts
    );
    const second = tryParseLoose<T>(fixed);
    if (second !== undefined) return second;
    // Final retry for long outputs that were likely truncated: force compact
    // JSON and give the model a larger output budget.
    const expanded = await this.complete(
      `${prompt}\n\nReturn ONLY one valid minified JSON object on a single line. No prose, no markdown fences, no comments, no trailing commas.`,
      {
        ...opts,
        responseSchema: opts?.responseSchema ?? { type: "object" },
        maxTokens: Math.max(opts?.maxTokens ?? 2048, 8192),
      }
    );
    const third = tryParseLoose<T>(expanded);
    if (third !== undefined) return third;
    throw new Error(
      `Gemini returned unparseable JSON after retries. First 200 chars: ${expanded.slice(0, 200)}`
    );
  }

  async *streamChat(
    messages: ChatMessage[],
    opts?: CompleteOptions
  ): AsyncIterable<string> {
    const systemMsgs = messages.filter((m) => m.role === "system");
    const convo = messages.filter((m) => m.role !== "system");
    const model = this.client.getGenerativeModel({
      model: MODEL,
      generationConfig: this.buildConfig(opts),
      systemInstruction: systemMsgs.length
        ? systemMsgs.map((m) => m.content).join("\n\n")
        : undefined,
    });
    const contents: Content[] = convo.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
    const stream = await model.generateContentStream({ contents });
    for await (const chunk of stream.stream) {
      const t = chunk.text();
      if (t) yield t;
    }
  }
}

/**
 * Best-effort JSON parse that tolerates the common ways Gemini drifts:
 *   - ```json … ``` fences
 *   - a leading prose paragraph before the JSON object
 *   - trailing text after the closing brace
 * Returns `undefined` if no JSON object could be recovered.
 */
function tryParseLoose<T>(raw: string): T | undefined {
  if (!raw) return undefined;
  // Strip surrounding ```json … ``` or ``` … ``` fences if present.
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : raw;
  // Fast path: try parsing the candidate as-is.
  try {
    return JSON.parse(candidate.trim()) as T;
  } catch {
    // fall through
  }
  // Slow path: find the first balanced JSON object in the string.
  const start = candidate.indexOf("{");
  if (start < 0) return undefined;
  let depth = 0;
  let inStr = false;
  let escape = false;
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inStr = !inStr;
      continue;
    }
    if (inStr) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(candidate.slice(start, i + 1)) as T;
        } catch {
          return undefined;
        }
      }
    }
  }
  return undefined;
}
