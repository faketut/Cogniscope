import type {
  ChatMessage,
  CompleteOptions,
  LLMProvider,
} from "./types";

/**
 * Qwen provider using Alibaba DashScope's OpenAI-compatible endpoint.
 *   https://dashscope.aliyuncs.com/compatible-mode/v1
 *
 * Implements the same surface as the Gemini provider so callers can switch
 * between them by changing `LLM_PROVIDER` alone. JSON-mode is requested via
 * `response_format: { type: "json_object" }` when a schema is supplied; the
 * `completeJSON` helper also strips fences / extracts the first JSON object
 * as a safety net.
 */
const ENDPOINT =
  process.env.QWEN_BASE_URL ||
  "https://dashscope.aliyuncs.com/compatible-mode/v1";
const MODEL = process.env.QWEN_MODEL || "qwen-plus";

interface ChatCompletionMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatCompletionResponse {
  choices?: { delta?: { content?: string }; message?: { content?: string } }[];
}

export class QwenProvider implements LLMProvider {
  name = "qwen";
  private apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey) throw new Error("Qwen provider requires QWEN_API_KEY");
    this.apiKey = apiKey;
  }

  private async chat(
    messages: ChatCompletionMessage[],
    opts?: CompleteOptions,
    stream = false
  ): Promise<Response> {
    const body: Record<string, unknown> = {
      model: MODEL,
      messages,
      temperature: opts?.temperature ?? 0.4,
      max_tokens: opts?.maxTokens ?? 2048,
      stream,
    };
    if (opts?.responseSchema) {
      body.response_format = { type: "json_object" };
    }
    const res = await fetch(`${ENDPOINT}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Qwen ${res.status}: ${text.slice(0, 300)}`);
    }
    return res;
  }

  async complete(prompt: string, opts?: CompleteOptions): Promise<string> {
    const res = await this.chat(
      [{ role: "user", content: prompt }],
      opts,
      false
    );
    const data: ChatCompletionResponse = await res.json();
    return data.choices?.[0]?.message?.content ?? "";
  }

  async completeJSON<T>(prompt: string, opts?: CompleteOptions): Promise<T> {
    const text = await this.complete(prompt, {
      ...opts,
      responseSchema: opts?.responseSchema ?? { type: "object" },
    });
    const first = tryParseLoose<T>(text);
    if (first !== undefined) return first;
    const fixed = await this.complete(
      `${prompt}\n\nReturn ONLY a single valid JSON object. No prose, no markdown fences, no trailing commas.`,
      opts
    );
    const second = tryParseLoose<T>(fixed);
    if (second !== undefined) return second;
    throw new Error(
      `Qwen returned unparseable JSON after retry. First 200 chars: ${fixed.slice(0, 200)}`
    );
  }

  async *streamChat(
    messages: ChatMessage[],
    opts?: CompleteOptions
  ): AsyncIterable<string> {
    const res = await this.chat(messages, opts, true);
    if (!res.body) return;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      // SSE: each event is `data: {...}\n\n`
      let idx: number;
      while ((idx = buf.indexOf("\n\n")) >= 0) {
        const chunk = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        for (const line of chunk.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === "[DONE]") return;
          try {
            const parsed: ChatCompletionResponse = JSON.parse(payload);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) yield delta;
          } catch {
            // ignore malformed chunks
          }
        }
      }
    }
  }
}

function tryParseLoose<T>(raw: string): T | undefined {
  if (!raw) return undefined;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : raw;
  try {
    return JSON.parse(candidate.trim()) as T;
  } catch {
    // fall through
  }
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
