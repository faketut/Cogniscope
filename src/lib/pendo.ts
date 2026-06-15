/**
 * Pendo (Novus.ai) custom-event helper.
 *
 * The Pendo agent is injected at runtime by Novus (installed from its web UI,
 * which is wired to this repo). We only ship a typed wrapper around
 * `window.pendo.track` so the rest of the app can fire custom events without
 * caring whether the agent is present.
 */

declare global {
  interface Window {
    pendo?: {
      track: (event: string, props?: Record<string, unknown>) => void;
    };
  }
}

/** Fire a Pendo custom event. No-op when Pendo isn't loaded. */
export function track(event: string, props?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  try {
    window.pendo?.track(event, props);
  } catch {
    // never let analytics break the app
  }
}
