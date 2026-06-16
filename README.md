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

## How it works

Three workflows, in the order a learner experiences them.

### 1 · Practice — silent capture

Every keystroke, focus change, hint, and full DOM frame streams out of the
browser while the timer counts down toward the per-question cap.

```mermaid
sequenceDiagram
  autonumber
  participant L as Learner
  participant UI as Practice surface
  participant REC as BehaviorRecorder<br/>(rrweb + emitter)
  participant API as Next.js API
  participant DB as SQLite
  participant FS as data/sessions/*.rrweb.jsonl

  L->>UI: open /practice/:id
  UI->>API: POST /api/sessions (start)
  API->>DB: insert session row
  UI->>REC: start(sessionId)
  loop while solving
    L->>UI: type / focus / hint
    REC-->>API: POST /api/events (batched)
    API->>DB: append event rows
    REC-->>API: POST /api/sessions/:id/rrweb
    API->>FS: append rrweb chunk
  end
  alt learner submits
    L->>UI: click Submit & analyze
  else timer expires
    UI-->>UI: onTimeUp → auto submit (auto:true)
  end
  UI->>API: POST /api/sessions/:id/submit
```

### 2 · Analyze — three LLM stages, one report row

Submit triggers a deterministic feature pass, then three grounded LLM calls.
Each call's JSON is validated; on failure the analyzer retries with a longer
context window, and finally falls back to a mock so the report always lands.

```mermaid
flowchart LR
  SUB["/api/sessions/:id/submit"] --> AN["/api/analyze"]
  AN --> FE[extractFeatures<br/>idle gaps · edits · hints · tab switches]
  FE --> TAG[completeJSON<br/>behavior tagging]
  TAG --> DIAG[completeJSON<br/>diagnosis]
  DIAG --> FB[complete<br/>feedback markdown]
  FB --> RPT[(reports row)]

  subgraph Provider["LLM_PROVIDER"]
    direction LR
    M[mock]
    G[Gemini]
    Q[Qwen DashScope]
  end

  TAG -. uses .-> Provider
  DIAG -. uses .-> Provider
  FB -. uses .-> Provider

  classDef llm fill:#eef,stroke:#669,color:#223;
  class TAG,DIAG,FB llm;
```

### 3 · Report — read, replay, ask

The report surface stitches the SQLite report row, the raw events, and the
rrweb file into four tabs. The Tutor tab streams a Socratic chat grounded in
*this* session's report, never a generic textbook.

```mermaid
flowchart LR
  DB[(SQLite<br/>sessions · events · reports)]
  FS[/rrweb file/]

  DB --> R["/report/:id"]
  FS --> R
  DB --> H["/history"]
  DB --> I["/inspect/:id"]

  R --> T1[Reading]
  R --> T2[By step]
  R --> T3[Replay<br/>rrweb-player]
  R --> T4[Tutor]

  T4 -->|stream| CHAT["/api/chat"]
  CHAT -->|grounded in report| LLM[(LLM provider)]
  R -->|share| PNG["/api/sessions/:id/trace.png<br/>resvg → PNG"]
```


## License

[MIT](LICENSE) © 2026 Jian Feng.

## Out of scope for v0.1

Authentication, multi-user, code-execution sandbox, real-time nudges, production deploy.
