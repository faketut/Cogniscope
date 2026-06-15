/**
 * Picks 1–3 next problems given a just-finished problem + diagnosis.
 *
 * Heuristic:
 *   1. Prefer the SAME topic but a different problem (deepest variation).
 *   2. Fill remaining slots from the SAME subject (cross-topic).
 *   3. Prefer one step DOWN in difficulty if the learner got it wrong,
 *      one step UP if they nailed it; otherwise same level.
 *
 * Returns at most 2 recommendations and a short human reason for each.
 */

import { PROBLEMS, type Problem, type Difficulty } from "@/content/problems";

const DIFF_ORDER: Difficulty[] = ["easy", "medium", "hard"];

function difficultyTarget(current: Difficulty, didWell: boolean | null): Difficulty {
  const i = DIFF_ORDER.indexOf(current);
  if (didWell === true) return DIFF_ORDER[Math.min(i + 1, DIFF_ORDER.length - 1)];
  if (didWell === false) return DIFF_ORDER[Math.max(i - 1, 0)];
  return current;
}

function distance(a: Difficulty, b: Difficulty): number {
  return Math.abs(DIFF_ORDER.indexOf(a) - DIFF_ORDER.indexOf(b));
}

export interface Recommendation {
  problem: Problem;
  reason: string;
}

export function recommendNext(
  current: Problem,
  didWell: boolean | null,
  limit = 2
): Recommendation[] {
  const want = difficultyTarget(current.difficulty, didWell);

  const sameTopic = PROBLEMS.filter(
    (p) => p.id !== current.id && p.topic === current.topic
  );
  const sameSubject = PROBLEMS.filter(
    (p) =>
      p.id !== current.id &&
      p.subject === current.subject &&
      p.topic !== current.topic
  );

  // Closer difficulty first within each group.
  const byDifficulty = (a: Problem, b: Problem) =>
    distance(a.difficulty, want) - distance(b.difficulty, want);
  sameTopic.sort(byDifficulty);
  sameSubject.sort(byDifficulty);

  const out: Recommendation[] = [];
  for (const p of sameTopic) {
    if (out.length >= limit) break;
    out.push({
      problem: p,
      reason: `Same topic (${p.topic}) — practice the same idea on different numbers.`,
    });
  }
  for (const p of sameSubject) {
    if (out.length >= limit) break;
    out.push({
      problem: p,
      reason:
        didWell === true
          ? `New territory in ${current.subject} — stretch what you just demonstrated.`
          : `Different angle in ${current.subject} — reset on a fresh problem.`,
    });
  }
  return out;
}
