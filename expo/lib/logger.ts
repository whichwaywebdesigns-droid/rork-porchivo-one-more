/**
 * Production-safe logger for Porchivo.
 *
 * - In development (__DEV__): logs pass through to console normally.
 * - In production: console output is suppressed; errors are captured by Sentry.
 *
 * This prevents PII (user IDs, emails, entitlement states, profile data)
 * from appearing in device logs while still surfacing errors in Sentry.
 *
 * Usage:
 *   import { log, warn, error } from '@/lib/logger';
 *   log('[Ship24] Got response', data);    // silent in production
 *   warn('[Supabase] Missing key');        // silent in production
 *   error('[Auth] Sign-in failed', err);   // captured by Sentry in production
 */

import * as Sentry from "@sentry/react-native";

const noop = () => {};

export const log: (...args: unknown[]) => void = __DEV__
  ? (...args) => console.log(...args)
  : noop;

export const warn: (...args: unknown[]) => void = __DEV__
  ? (...args) => console.warn(...args)
  : noop;

/**
 * In production, captures the first argument as a Sentry exception if it's
 * an Error, or as a Sentry message otherwise. Never logs to console in prod
 * to avoid leaking internal stack traces or schema details.
 */
export const error: (...args: unknown[]) => void = __DEV__
  ? (...args) => console.error(...args)
  : (message, ...rest) => {
      const err = rest[0] instanceof Error ? rest[0] : undefined;
      if (err) {
        Sentry.captureException(err);
      } else {
        Sentry.captureMessage(
          typeof message === "string" ? message : JSON.stringify(message),
          "error"
        );
      }
    };
