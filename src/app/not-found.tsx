import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-6 py-32 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-text-3">
        404
      </p>
      <h1 className="mt-3 font-serif text-3xl tracking-tight">Not found</h1>
      <p className="mt-3 text-sm text-text-2">
        That session or problem doesn&apos;t exist.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex h-9 items-center rounded-md border border-border bg-surface px-4 text-sm hover:bg-surface-2"
      >
        Go home
      </Link>
    </div>
  );
}
