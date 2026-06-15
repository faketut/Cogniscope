import Link from "next/link";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-vellum/85 backdrop-blur">
      <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          className="group inline-flex items-baseline gap-2 text-ink"
          aria-label="Cogniscope home"
        >
          <span className="font-display-tight text-lg leading-none">
            Cogniscope
          </span>
          <span className="eyebrow hidden sm:inline">a learning lab</span>
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          <Link
            href="/"
            className="text-graphite transition-colors hover:text-ink"
          >
            Practice
          </Link>
          <Link
            href="/history"
            className="text-graphite transition-colors hover:text-ink"
          >
            History
          </Link>
          <span className="h-3 w-px bg-rule" aria-hidden />
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
