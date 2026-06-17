"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

/**
 * Per-row delete button for a session in the History list.
 *
 * Two-step confirm (click once → button morphs into "Confirm? · Cancel") so
 * a stray tap doesn't nuke a session. Resets after 4s of inactivity.
 *
 * On success we call `router.refresh()` instead of mutating local state —
 * the server component then re-queries SQLite and re-renders the list,
 * which keeps a single source of truth.
 */
export function DeleteSessionButton({
  sessionId,
  title,
}: {
  sessionId: string;
  title: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onArm = (e: React.MouseEvent) => {
    // Sit inside an <Link> wrapper in the page — block the row-level
    // navigation when the user clicks our button.
    e.preventDefault();
    e.stopPropagation();
    setError(null);
    setArmed(true);
    window.setTimeout(() => setArmed(false), 4000);
  };

  const onCancel = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setArmed(false);
  };

  const onConfirm = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      try {
        const res = await fetch(`/api/sessions/${sessionId}`, {
          method: "DELETE",
        });
        if (!res.ok && res.status !== 204) {
          throw new Error(`HTTP ${res.status}`);
        }
        setArmed(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "delete failed");
      }
    });
  };

  if (error) {
    return (
      <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-danger">
        {error}
        <button
          type="button"
          onClick={onCancel}
          className="border border-danger px-1.5 py-0.5 text-danger hover:bg-danger hover:text-vellum"
        >
          Dismiss
        </button>
      </span>
    );
  }

  if (!armed) {
    return (
      <button
        type="button"
        onClick={onArm}
        title={`Delete this session (${title})`}
        aria-label={`Delete session: ${title}`}
        className="inline-flex items-center gap-1 border border-rule px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-chalk transition-colors hover:border-danger hover:text-danger"
      >
        <Trash2 size={11} aria-hidden /> Delete
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider">
      <span className="text-graphite">delete this?</span>
      <button
        type="button"
        onClick={onConfirm}
        disabled={pending}
        className="border border-danger bg-danger px-1.5 py-0.5 text-vellum hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "…" : "Confirm"}
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={pending}
        className="border border-rule px-1.5 py-0.5 text-chalk hover:border-ink hover:text-ink"
      >
        Cancel
      </button>
    </span>
  );
}

/**
 * Header "Clear all" action: nukes every session + recording. Same two-step
 * confirm as the per-row button, but with the additional friction of a
 * native dialog so the user actually reads the count.
 */
export function ClearAllSessionsButton({ count }: { count: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onArm = () => {
    setError(null);
    setArmed(true);
    window.setTimeout(() => setArmed(false), 5000);
  };

  const onConfirm = () => {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/sessions`, { method: "DELETE" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setArmed(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "clear failed");
      }
    });
  };

  if (count === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {error && (
        <span className="font-mono text-[10px] uppercase tracking-wider text-danger">
          {error}
        </span>
      )}
      {!armed ? (
        <button
          type="button"
          onClick={onArm}
          className="inline-flex items-center gap-1.5 border border-rule px-2 py-1 font-mono text-[11px] uppercase tracking-wider text-chalk transition-colors hover:border-danger hover:text-danger"
          title="Permanently delete every session and recording"
        >
          <Trash2 size={12} aria-hidden /> Clear all
        </button>
      ) : (
        <>
          <span className="font-mono text-[11px] uppercase tracking-wider text-graphite">
            delete all {count}?
          </span>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="border border-danger bg-danger px-2 py-1 font-mono text-[11px] uppercase tracking-wider text-vellum transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Clearing…" : "Confirm"}
          </button>
          <button
            type="button"
            onClick={() => setArmed(false)}
            disabled={pending}
            className="border border-rule px-2 py-1 font-mono text-[11px] uppercase tracking-wider text-chalk hover:border-ink hover:text-ink"
          >
            Cancel
          </button>
        </>
      )}
    </div>
  );
}
