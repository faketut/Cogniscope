# Cogniscope — 4-minute demo script

A tight, rehearsable walkthrough. Target: **3 min 45 s** spoken, **3 min 30 s** of actual clicking.
Total budget below adds to ~225 s; trim filler if you run long.

Run `pnpm seed` once before the demo so the four rehearsed sessions exist. Then
run `pnpm dev` and open `http://localhost:3000` in a fresh tab. Keep DevTools
closed — the screen recording is part of the demo.

---

## 0:00 — 0:20 · Hook (20 s)

**Action.** Stay on the landing page `/`. Don't click anything yet.

> "Most learning tools grade your **answer**. They never look at the 12 minutes
> of staring at the screen, the three rewrites, or the tab you flipped to
> halfway through. Cogniscope does. It's a local-first learning lab that
> records *how* you solve a problem and tells you what your process is hiding."

---

## 0:20 — 0:45 · Pick a problem (25 s)

**Action.** Click **Quadratic factoring** in the catalog.

> "I'll open quadratic factoring. Notice the timer in the top right — every
> question has a soft cap, twice the estimated time. When it hits zero we
> auto-submit, so a stuck learner doesn't sit there for 40 minutes producing
> noise in the recording."

Point at the `15s / 10m 00s` timer pill once it starts.

---

## 0:45 — 1:35 · Solve it on camera (50 s)

**Action.** Type into Step 1, *deliberately wrong*, then erase and retry.
Suggested keystrokes:

1. Step 1 textarea → type `2, 3` → pause 2 s → backspace → type `-3, 2`.
2. Click **Hint** on Step 2 — let the hint render.
3. Step 2 textarea → type `(x-3)(x+2)`.
4. Step 3 textarea → type `3, -2`.
5. Click **Submit & analyze**.

Narrate as you go:

> "I'm typing the wrong pair on purpose — Cogniscope is recording focus,
> edits, hints, idle gaps, every keystroke. I'll take the hint on step two,
> then finish. Submit kicks off the analyzer pipeline."

You will be redirected to `/analysis/<id>` and then `/report/<id>`. Don't fight
the redirect — keep talking.

---

## 1:35 — 2:25 · Read the report (50 s)

**Action.** You're on `/report/<id>`. Default tab is **Reading**.

> "This is the reading. The LLM tags each segment of behavior — confident,
> exploring, stuck, recovering — and writes a short, plain-English diagnosis.
> Notice it caught the rewrite on step one and flagged the hint reliance on
> step two. This isn't a rubric; it's grounded in what just happened."

Click the **By step** tab.

> "By step gives me a per-step timeline — time spent, edits made, hint used,
> outcome. This is the part I share with a tutor."

Click the **Replay** tab.

> "Replay is the actual rrweb recording, scrubbable. So 'you got stuck at 0:42'
> stops being abstract — I can watch it."

---

## 2:25 — 3:05 · Tutor chat (40 s)

**Action.** Click the **Tutor** tab. Type into the chat:

> `Why did I get step 1 wrong the first time?`

Press Enter. Let it stream the reply (~6–10 s).

> "The tutor is grounded in *my* report, not a generic textbook. It already
> knows I tried `2, 3` first, so it asks me a Socratic question about sign
> rules instead of dumping the answer. Switch providers in `.env.local` —
> Gemini, Qwen via DashScope, or a deterministic mock for offline."

---

## 3:05 — 3:30 · The receipts (25 s)

**Action.** Open a new tab to `/inspect/<id>` (replace `<id>` with the session
you just analyzed — copy from the URL).

> "Everything lives on disk in this repo. Sessions, events, the rrweb file,
> the report rows. No cloud, no account. The recording belongs to the
> learner."

Then open `/api/sessions/<id>/trace.png` in another tab.

> "And here's the shareable trace, server-rendered as a PNG so a screenshot
> in a Discord study group actually means something."

---

## 3:30 — 3:45 · Close (15 s)

**Action.** Back to `/history`.

> "Four rehearsed sessions are seeded so `/history` and `/report` work on first
> open — `pnpm seed`, then go. Cogniscope: it watches your process so you can
> stop guessing at your own learning. Thanks."

---

## Cheat sheet (keep open on a second monitor)

| Time | Page | Click target |
|------|------|--------------|
| 0:00 | `/` | — |
| 0:20 | `/practice/quadratic-factoring` | Quadratic factoring card |
| 0:45 | same | Step 1 textarea, Hint, Submit & analyze |
| 1:35 | `/report/<id>` | Reading tab (default) |
| 2:00 | same | By step tab |
| 2:15 | same | Replay tab |
| 2:25 | same | Tutor tab → ask question |
| 3:05 | `/inspect/<id>` | scan tables |
| 3:15 | `/api/sessions/<id>/trace.png` | — |
| 3:30 | `/history` | — |

## Fallback flow (if live solve goes sideways)

If the live submit errors or the network stalls, skip step 0:45 — 1:35 and go
straight to `/report/seed-7MkRNIuV` (the seeded quadratic-factoring session)
and adapt the narration to past tense: *"here's a session I ran earlier..."*.
The rest of the script works unchanged.

## Pre-flight checklist

- [ ] `pnpm dev` running on `localhost:3000`, no errors in terminal
- [ ] `pnpm seed` ran in the last 24 h (so analyzed timestamps read "1h ago")
- [ ] `.env.local` has `LLM_PROVIDER=gemini` (or `qwen`) with a real key
- [ ] Browser zoom at 110% so the timer pill is legible on the recording
- [ ] DevTools closed, notifications muted, only one Cogniscope tab open
- [ ] Seed ids match the README (`seed-7MkRNIuV`, `seed-EBlyU3ga`, `seed-cISVIj18`, `seed-YXiQlW2g`)
