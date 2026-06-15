import { NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getLLM, type ChatMessage } from "@/lib/llm";

export const dynamic = "force-dynamic";

const Schema = z.object({
  sessionId: z.string(),
  message: z.string().min(1).max(2000),
});

function systemPromptFor(
  reportFeedback: string,
  tagsJson: string,
  diagnosisJson: string,
  featuresJson: string
) {
  return [
    `You are a Socratic learning coach. The student just finished a problem.`,
    `You have access to their behavior report below — REFERENCE specific evidence from it (numbers, step IDs) when relevant.`,
    `Tone: precise, neutral, slightly clinical. NEVER cheerlead. Ask 1 focused question per turn before offering more help.`,
    `End each response with one of: (a) a clarifying question, OR (b) a tiny verifiable micro-task ("Try X and tell me what you get.").`,
    `Use LaTeX (with \\$...\\$) for math when needed. Keep replies under 120 words unless explicitly asked for more.`,
    ``,
    `--- REPORT FEEDBACK ---`,
    reportFeedback,
    ``,
    `--- BEHAVIOR TAGS (JSON) ---`,
    tagsJson,
    ``,
    `--- DIAGNOSIS (JSON) ---`,
    diagnosisJson,
    ``,
    `--- TELEMETRY FEATURES (JSON) ---`,
    featuresJson,
  ].join("\n");
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "invalid body" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  const { sessionId, message } = parsed.data;
  const db = getDb();

  const report = db
    .prepare(
      "SELECT tags_json, diagnosis_json, feedback_md, features_json FROM reports WHERE session_id = ?"
    )
    .get(sessionId) as
    | {
        tags_json: string;
        diagnosis_json: string;
        feedback_md: string;
        features_json: string;
      }
    | undefined;
  if (!report) {
    return new Response(JSON.stringify({ error: "report not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  const history = db
    .prepare(
      // Keep the prompt budget bounded: take the most recent N then reverse to
      // chronological order. 20 turns ≈ comfortable for a Socratic exchange
      // without blowing the system-prompt + report context budget.
      `SELECT role, content FROM (
         SELECT role, content, ts FROM chat_messages
         WHERE session_id = ?
         ORDER BY ts DESC
         LIMIT 20
       ) ORDER BY ts ASC`
    )
    .all(sessionId) as { role: "user" | "assistant" | "system"; content: string }[];

  // Persist user message
  db.prepare(
    "INSERT INTO chat_messages (session_id, role, content, ts) VALUES (?, ?, ?, ?)"
  ).run(sessionId, "user", message, Date.now());

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: systemPromptFor(
        report.feedback_md,
        report.tags_json,
        report.diagnosis_json,
        report.features_json
      ),
    },
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user" as const, content: message },
  ];

  const llm = getLLM();
  const encoder = new TextEncoder();
  let collected = "";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of llm.streamChat(messages, { temperature: 0.6 })) {
          collected += chunk;
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (err) {
        controller.enqueue(
          encoder.encode(`\n\n[error: ${(err as Error).message}]`)
        );
      } finally {
        // Persist whatever we got — even partial content — so the next turn
        // doesn't see a user message with no assistant reply.
        if (collected.length > 0) {
          try {
            db.prepare(
              "INSERT INTO chat_messages (session_id, role, content, ts) VALUES (?, ?, ?, ?)"
            ).run(sessionId, "assistant", collected, Date.now());
          } catch {
            // best-effort
          }
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-cache, no-transform",
    },
  });
}

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId");
  if (!sessionId) {
    return new Response(JSON.stringify({ error: "missing sessionId" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  const rows = getDb()
    .prepare(
      "SELECT role, content, ts FROM chat_messages WHERE session_id = ? ORDER BY ts ASC"
    )
    .all(sessionId);
  return Response.json({ messages: rows });
}
