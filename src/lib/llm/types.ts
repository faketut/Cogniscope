export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CompleteOptions {
  temperature?: number;
  maxTokens?: number;
  /** When set, the provider will request JSON output matching this JSON Schema. */
  responseSchema?: object;
}

export interface LLMProvider {
  name: string;
  /** Single-turn text completion. */
  complete(prompt: string, opts?: CompleteOptions): Promise<string>;
  /** Single-turn completion that returns parsed JSON of type T. */
  completeJSON<T>(prompt: string, opts?: CompleteOptions): Promise<T>;
  /** Multi-turn streaming chat. */
  streamChat(
    messages: ChatMessage[],
    opts?: CompleteOptions
  ): AsyncIterable<string>;
}
