"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { cn } from "@/lib/utils";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

export function ChatTab({ sessionId }: { sessionId: string }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/chat?sessionId=${sessionId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (cancelled) return;
      setMessages(
        (data.messages || []).map((m: { role: string; content: string }) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }))
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);
    setMessages((m) => [
      ...m,
      { role: "user", content: text },
      { role: "assistant", content: "" },
    ]);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, message: text }),
      });
      if (!res.body) throw new Error("no body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", content: acc };
          return copy;
        });
      }
    } catch (err) {
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = {
          role: "assistant",
          content: `_error: ${(err as Error).message}_`,
        };
        return copy;
      });
    } finally {
      setSending(false);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="mx-auto flex h-[70vh] max-w-2xl flex-col">
      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto px-1 py-2"
      >
        {messages.length === 0 && (
          <div className="border-l-2 border-marker py-2 pl-4 text-sm text-graphite">
            <p className="flex items-center gap-2 font-display-tight text-base text-ink">
              <Sparkles size={14} className="text-ink" /> The tutor has read your trace.
            </p>
            <p className="mt-1 text-graphite">
              Ask what you got wrong, where you hesitated, or what to drill next.
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <Bubble
            key={i}
            role={m.role}
            content={m.content}
            streaming={sending && i === messages.length - 1}
          />
        ))}
      </div>

      <div className="mt-3 border border-rule bg-surface">
        <Textarea
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          placeholder="Ask the tutor a question."
          className="resize-none border-0 bg-transparent p-3 text-sm focus-visible:border-transparent"
        />
        <div className="flex items-center justify-between border-t border-rule px-3 py-2">
          <p className="eyebrow">⌘ / ctrl + enter to send</p>
          <Button variant="primary" onClick={send} disabled={sending || !input.trim()}>
            {sending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Send size={14} />
            )}
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}

function Bubble({
  role,
  content,
  streaming,
}: {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}) {
  return (
    <div
      className={cn(
        "px-4 py-3 text-sm leading-relaxed",
        role === "assistant"
          ? "border-l-2 border-ink bg-surface text-ink"
          : "border-l-2 border-rule text-graphite"
      )}
    >
      <p className="eyebrow mb-1">
        {role === "assistant" ? "tutor" : "you"}
      </p>
      <div className="prose-feedback text-[0.9375rem]">
        {content ? (
          <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
            {content}
          </ReactMarkdown>
        ) : (
          streaming && (
            <span className="inline-block h-3 w-1 animate-pulse bg-ink" />
          )
        )}
      </div>
    </div>
  );
}
