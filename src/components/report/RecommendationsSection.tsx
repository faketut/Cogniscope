import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Recommendation } from "@/lib/recommend";

interface Props {
  items: Recommendation[];
}

/**
 * Two-row "what to try next" block. Bare hairline rows, same vocab as the
 * home directory so the report doesn't grow card chrome.
 */
export function RecommendationsSection({ items }: Props) {
  if (items.length === 0) return null;
  return (
    <section className="mt-16">
      <div className="flex items-baseline justify-between border-b border-ink pb-2">
        <h2 className="font-display-tight text-2xl">Try next</h2>
        <span className="eyebrow">
          {items.length} {items.length === 1 ? "problem" : "problems"}
        </span>
      </div>
      <ul className="mt-1">
        {items.map(({ problem, reason }) => (
          <li key={problem.id} className="border-b border-rule">
            <Link
              href={`/practice/${problem.id}`}
              className="group grid grid-cols-12 items-baseline gap-x-4 gap-y-1 py-5 transition-colors hover:bg-surface"
            >
              <span className="col-span-12 font-display-tight text-lg leading-tight text-ink sm:col-span-5">
                <span className="bg-gradient-to-r from-marker to-marker bg-no-repeat [background-position:0_88%] [background-size:0_22%] transition-[background-size] duration-300 group-hover:[background-size:100%_22%]">
                  {problem.title}
                </span>
              </span>
              <span className="col-span-12 text-sm text-graphite sm:col-span-5">
                {reason}
              </span>
              <span className="col-span-6 font-mono text-xs uppercase tracking-wider text-chalk sm:col-span-1">
                {problem.difficulty}
              </span>
              <span className="col-span-6 flex items-center justify-end gap-2 font-mono text-xs text-chalk sm:col-span-1">
                ~{problem.estMinutes}m
                <ArrowRight
                  size={14}
                  className="transition-transform group-hover:translate-x-0.5 group-hover:text-ink"
                />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
