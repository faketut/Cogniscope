# Cogniscope

[![License: MIT](https://img.shields.io/badge/License-MIT-1f8a48.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-14-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-38BDF8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![SQLite](https://img.shields.io/badge/SQLite-better--sqlite3-003B57?logo=sqlite&logoColor=white)](https://github.com/WiseLibs/better-sqlite3)
[![rrweb](https://img.shields.io/badge/rrweb-screen_recording-7c3aed)](https://www.rrweb.io/)
[![Monaco](https://img.shields.io/badge/Monaco-editor-1E90FF?logo=visualstudiocode&logoColor=white)](https://microsoft.github.io/monaco-editor/)
[![KaTeX](https://img.shields.io/badge/KaTeX-math-329F30)](https://katex.org/)
[![Gemini](https://img.shields.io/badge/Gemini-API-4285F4?logo=google&logoColor=white)](https://ai.google.dev/)
[![Qwen DashScope](https://img.shields.io/badge/Qwen-DashScope-FF6A00)](https://dashscope.aliyun.com/)
[![pnpm](https://img.shields.io/badge/pnpm-package_manager-F69220?logo=pnpm&logoColor=white)](https://pnpm.io/)

A learning lab that analyzes your **process**, not just your answers.

![A 3-minute Quadratic factoring session with a "got stuck here" marker at 0:17](docs/trace-hero.png)

Self-learners solve math/programming problems while behavior is silently
captured (focus, edits, idle, hints, tab-switches, paste, full screen
recording via rrweb). An LLM pipeline then classifies cognitive state,
diagnoses root causes, and produces a personalized feedback report plus
a Socratic tutor chat.

## Local setup

```bash
pnpm install
cp .env.example .env.local
# Optionally set GEMINI_API_KEY (or QWEN_API_KEY) and LLM_PROVIDER accordingly
pnpm dev
```

Open http://localhost:3000.

To populate `/history` with realistic demo data:

```bash
pnpm seed
```

## Demo script

After `pnpm seed`, the current rehearsed sessions are:

- `seed-7MkRNIuV` — Quadratic factoring
- `seed-EBlyU3ga` — Chain rule derivative
- `seed-cISVIj18` — Two Sum
- `seed-YXiQlW2g` — Integration by parts

Suggested live click path:

1. Open `/history` and point out the four seeded sessions.
2. Open `/report/seed-7MkRNIuV` to show the reading, by-step timeline, replay, tutor, recommendations, and share-trace actions.
3. Open `/inspect/seed-7MkRNIuV` to show the raw stored `sessions`, `events`, `reports`, and rrweb file metadata.
4. Open `/report/seed-cISVIj18` to show the programming flow and discuss that `Run local tests` executes in-browser, while `Submit & analyze` stores the code and behavior trace for analysis.
5. Hit `/api/sessions/seed-7MkRNIuV/trace.png` if you want a fast proof that export works end-to-end.

If you re-run `pnpm seed`, these ids will change; use `/history` as the source of truth.

### Live flow (no seed, ~2 min)

1. From `/`, open any problem (e.g. `/practice/quadratic-factoring`).
2. Work the steps. A per-question timer is shown; the cap is `max(estMinutes × 2, 3)` minutes and turns amber in the final 60s.
3. Either submit, or let the timer expire — on time-up the session auto-submits with `auto: true` in telemetry and a `time_expired` event is recorded.
4. You'll land on `/analysis/[sessionId]` then `/report/[sessionId]`. Walk through Reading → By step → Replay → Tutor.
5. Optional: hit `/api/sessions/<id>/trace.png` for the shareable PNG.

## Configuration

| Env | Values | Default | Notes |
|-----|--------|---------|-------|
| `LLM_PROVIDER` | `mock`, `gemini`, `qwen` | `mock` | |
| `GEMINI_API_KEY` | — | — | Required when provider = gemini |
| `GEMINI_MODEL` | e.g. `gemini-2.5-flash` | `gemini-2.5-flash` | Override at will |
| `QWEN_API_KEY` | — | — | Required when provider = qwen (DashScope key) |
| `QWEN_MODEL` | e.g. `qwen-plus` | `qwen-plus` | DashScope model id |
| `WORKSPACE_ID` | — | — | Only needed when `QWEN_BASE_URL` references it |
| `QWEN_BASE_URL` | — | DashScope compat URL | Override for a custom OpenAI-compat host. Supports `${WORKSPACE_ID}` expansion (via Next's `dotenv-expand`); replace any `<region>` placeholder before running. |

Without an API key the app falls back to deterministic mock analysis — useful
for offline development.

Product analytics is handled by **Novus.ai → Pendo**, installed via Novus's
web UI (which is wired to this GitHub repo). No env var or install snippet
lives in the codebase; the agent is injected at runtime. The app fires a
handful of typed custom events via `track()` in [src/lib/pendo.ts](src/lib/pendo.ts)
which no-op gracefully when the agent isn't present.

## Routes

- `/` — problem catalog with sample trace hero
- `/practice/[id]` — interactive practice with telemetry + screen recording
- `/analysis/[sessionId]` — analyzer status
- `/report/[sessionId]` — Reading / By step / Replay / Tutor tabs + Try-next recommendations + share-trace PNG
- `/history` — past sessions
- `/styleguide` — internal design system reference
- `/api/sessions/[id]/trace.png` — server-rendered PNG of the trace for sharing (`?format=svg` for SVG)

## Architecture

```
Practice surface ──► BehaviorRecorder (rrweb + custom emitter)
                  ──► /api/events            ──► SQLite
                  ──► /api/sessions/:id/rrweb ──► data/sessions/<id>.rrweb.jsonl

Submit ──► /api/sessions/:id/submit
       ──► /api/analyze ──► extractFeatures()
                        ──► LLM.completeJSON(behavior tagging)
                        ──► LLM.completeJSON(diagnosis)
                        ──► LLM.complete(feedback markdown)
                        ──► reports table

Report views   ◄── reports + events + rrweb file
Tutor chat     ──► /api/chat ──► streaming with full report context
Share trace    ──► /api/sessions/:id/trace.png (server-side SVG via resvg)
```

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind · better-sqlite3 · rrweb +
rrweb-player · Monaco · KaTeX · `@resvg/resvg-js` · Gemini SDK · Qwen
DashScope (OpenAI-compat) · sonner.

Full set of badges is at the [top of this README](#cogniscope).

## License

[MIT](LICENSE) © 2026 Jian Feng.

## Out of scope for v0.1

Authentication, multi-user, code-execution sandbox, real-time nudges, production deploy.
