/**
 * BackgroundErrorContext — collects non-fatal background process errors
 * (Ship24 polling, Supabase fetch failures, etc.) and surfaces them via a
 * non-intrusive banner so users aren't confused by silent failures.
 *
 * Usage in background contexts:
 *   const { reportError, resolveError } = useBackgroundError();
 *   try { await poll(); resolveError('packages_poll'); }
 *   catch (e) { reportError('packages_poll', 'Tracking update unavailable'); }
 *
 * Key behaviours:
 * - Deduplicates by `source` — repeated polling failures update the existing
 *   error rather than stacking duplicates.
 * - Auto-resolves when `resolveError(source)` is called (e.g. next poll succeeds).
 * - Auto-dismisses the banner after `ttlMs` (default 8s) so transient blips
 *   don't linger. Pass `ttlMs: 0` for persistent errors that require manual
 *   dismissal.
 * - Multiple distinct sources can coexist; the banner shows the most recent.
 */

import { useCallback, useRef, useState } from 'react';
import createContextHook from '@nkzw/create-context-hook';

export type BackgroundErrorSource =
  | 'packages_poll'
  | 'shipments_poll'
  | 'shipments_fetch'
  | 'notifications'
  | 'supabase_sync';

export interface BackgroundError {
  source: BackgroundErrorSource;
  message: string;
  /** Epoch ms when first reported. */
  timestamp: number;
  /** Retry callback (optional — some errors aren't retryable). */
  onRetry?: () => void;
  /** Auto-dismiss delay in ms. 0 = persistent. */
  ttlMs: number;
}

interface ReportOptions {
  onRetry?: () => void;
  ttlMs?: number;
}

export interface BackgroundErrorContextValue {
  /** Report a background error. Deduplicates by source. */
  reportError: (source: BackgroundErrorSource, message: string, opts?: ReportOptions) => void;
  /** Clear a specific source's error (e.g. next poll succeeded). */
  resolveError: (source: BackgroundErrorSource) => void;
  /** Manually dismiss the current visible error. */
  dismiss: () => void;
  /** The current error to display (most recent), or null. */
  currentError: BackgroundError | null;
}

const DEFAULT_TTL_MS = 8000;

export const [BackgroundErrorProvider, useBackgroundError] =
  createContextHook((): BackgroundErrorContextValue => {
    const [errors, setErrors] = useState<Map<BackgroundErrorSource, BackgroundError>>(new Map());
    const timers = useRef<Map<BackgroundErrorSource, ReturnType<typeof setTimeout>>>(new Map());

    const clearTimer = useCallback((source: BackgroundErrorSource) => {
      const t = timers.current.get(source);
      if (t) {
        clearTimeout(t);
        timers.current.delete(source);
      }
    }, []);

    const reportError = useCallback(
      (source: BackgroundErrorSource, message: string, opts?: ReportOptions) => {
        clearTimer(source);

        const entry: BackgroundError = {
          source,
          message,
          timestamp: Date.now(),
          onRetry: opts?.onRetry,
          ttlMs: opts?.ttlMs ?? DEFAULT_TTL_MS,
        };

        setErrors((prev) => {
          const next = new Map(prev);
          next.set(source, entry);
          return next;
        });

        if (entry.ttlMs > 0) {
          const timer = setTimeout(() => {
            setErrors((prev) => {
              const next = new Map(prev);
              next.delete(source);
              return next;
            });
            timers.current.delete(source);
          }, entry.ttlMs);
          timers.current.set(source, timer);
        }
      },
      [clearTimer],
    );

    const resolveError = useCallback(
      (source: BackgroundErrorSource) => {
        clearTimer(source);
        setErrors((prev) => {
          if (!prev.has(source)) return prev;
          const next = new Map(prev);
          next.delete(source);
          return next;
        });
      },
      [clearTimer],
    );

    const dismiss = useCallback(() => {
      // Clear all — the banner shows the most recent, so dismiss clears everything visible.
      timers.current.forEach((t) => clearTimeout(t));
      timers.current.clear();
      setErrors(new Map());
    }, []);

    // Expose the most recent error for the banner to render.
    const currentError = (() => {
      if (errors.size === 0) return null;
      let latest: BackgroundError | null = null;
      for (const entry of errors.values()) {
        if (!latest || entry.timestamp > latest.timestamp) {
          latest = entry;
        }
      }
      return latest;
    })();

    return { reportError, resolveError, dismiss, currentError };
  });
