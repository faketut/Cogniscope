import Link from "next/link";
import { PROBLEMS, problemsBySubject, type Problem } from "@/content/problems";
import { Trace, TraceLegend } from "@/components/trace/Trace";
import { SAMPLE_TRACE } from "@/components/trace/sample";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-6 pb-24 pt-10 sm:pt-14">
      {/* ───────────────────────────────────────────────────────────────────
          HERO — the trace IS the headline. The text is its caption.
          ─────────────────────────────────────────────────────────────────── */}
      <section aria-labelledby="hero-caption">
        <div className="flex items-baseline justify-between">
          <p className="eyebrow">
            session · sample · quadratic factoring
          </p>
          <p className="eyebrow tabular-nums">
            length 1:32 · 24 events · 1 marker
          </p>
        </div>

        <div className="mt-3 rounded-sm border border-rule bg-surface px-4 py-5 sm:px-7 sm:py-7">
          <Trace
            durationMs={SAMPLE_TRACE.durationMs}
            events={SAMPLE_TRACE.events}
            annotations={SAMPLE_TRACE.annotations}
            height={180}
          />
        </div>

        <div className="mt-4">
          <TraceLegend />
        </div>

        <div className="mt-12 grid grid-cols-1 gap-x-12 gap-y-6 sm:mt-14 sm:grid-cols-12">
          <h1
            id="hero-caption"
            className="font-display text-[2.5rem] leading-[1.05] sm:col-span-7 sm:text-[3.5rem]"
          >
            Above is{" "}
            <span className="marker-underline">someone thinking</span>{" "}
            through a quadratic.
          </h1>
          <div className="text-graphite sm:col-span-5">
            <p>
              Every tick is a real keystroke, pause, paste, or tab-switch.
              The yellow dot is the moment Cogniscope flagged for a closer
              read — when they abandoned their first approach.
            </p>
            <p className="mt-4">
              Solve a problem of your own. Get a trace back, plus a short
              written diagnosis of what your process actually says about
              your reasoning.
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
          <Link
            href={`/practice/${PROBLEMS[0].id}`}
            className="group inline-flex items-baseline gap-2 text-base font-medium text-ink"
          >
            <span className="marker-underline">Start a math session</span>
            <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </Link>
          <span className="text-chalk">·</span>
          <Link
            href={`/practice/two-sum`}
            className="group inline-flex items-baseline gap-2 text-base text-graphite hover:text-ink"
          >
            <span>Or try a programming one</span>
            <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </Link>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────────────
          PROBLEM LIST — bare rows, hairlines, no card chrome. The trace
          above is the only "object" on the page; this is a directory.
          ─────────────────────────────────────────────────────────────────── */}
      <section className="mt-24 sm:mt-32">
        <ProblemList subject="math" label="Math" />
        <ProblemList subject="programming" label="Programming" className="mt-16" />
      </section>
    </div>
  );
}

function ProblemList({
  subject,
  label,
  className,
}: {
  subject: "math" | "programming";
  label: string;
  className?: string;
}) {
  const items = problemsBySubject(subject);
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between border-b border-ink pb-2">
        <h2 className="font-display-tight text-2xl">{label}</h2>
        <span className="eyebrow">
          {items.length} {items.length === 1 ? "problem" : "problems"}
        </span>
      </div>
      <ul className="mt-1">
        {items.map((p) => (
          <ProblemRow key={p.id} problem={p} />
        ))}
      </ul>
    </div>
  );
}

function ProblemRow({ problem }: { problem: Problem }) {
  return (
    <li className="border-b border-rule">
      <Link
        href={`/practice/${problem.id}`}
        className="group grid grid-cols-12 items-baseline gap-4 py-5 transition-colors hover:bg-surface"
      >
        <span className="col-span-12 font-display-tight text-lg leading-tight text-ink sm:col-span-6 group-hover:[&>span]:bg-[length:100%_100%]">
          <span className="bg-gradient-to-r from-marker to-marker bg-no-repeat [background-position:0_88%] [background-size:0_22%] transition-[background-size] duration-300">
            {problem.title}
          </span>
        </span>
        <span className="col-span-6 text-sm text-graphite sm:col-span-3">
          {problem.topic}
        </span>
        <span className="col-span-3 font-mono text-xs uppercase tracking-wider text-chalk sm:col-span-2">
          {problem.difficulty}
        </span>
        <span className="col-span-3 text-right font-mono text-xs text-chalk sm:col-span-1">
          ~{problem.estMinutes}m
        </span>
      </Link>
    </li>
  );
}

