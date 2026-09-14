/**
 * Porchivo — locale-aware formatting helpers.
 *
 * Centralized Intl wrappers so every screen formats dates, times, numbers,
 * and currency against the SELECTED APP LOCALE instead of ad-hoc device
 * defaults. Timezone is intentionally NOT derived from the language: these
 * helpers never pass a timeZone option, so the device's existing timezone
 * behavior (and all business-timezone logic elsewhere in the app) is
 * untouched.
 *
 * Usage:
 *   import { formatDate, formatCurrency } from '@/i18n/format';
 *   formatDate(shipment.expectedDeliveryDate, 'medium');
 *   formatCurrency(invoice.totalUsd);            // USD default
 *
 * Hermes (React Native 0.81) ships full Intl on both platforms; the try/catch
 * fallbacks keep web/edge environments render-safe if a formatter is missing.
 */

import i18n from './index';
import { DEFAULT_LOCALE } from './localeRegistry';

/** The locale formatting should follow — the selected app language. */
export function getFormattingLocale(): string {
  const lng = i18n.language;
  return lng && lng.length > 0 ? lng : DEFAULT_LOCALE;
}

function safeFormat(format: () => string, fallback: () => string): string {
  try {
    return format();
  } catch {
    try {
      return fallback();
    } catch {
      return String('');
    }
  }
}

export type DateStyle = 'short' | 'medium' | 'long';

/** Locale-aware date (no timezone conversion). */
export function formatDate(
  value: Date | string | number,
  style: DateStyle = 'medium',
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return safeFormat(
    () =>
      new Intl.DateTimeFormat(getFormattingLocale(), {
        year: 'numeric',
        month: style === 'long' ? 'long' : 'short',
        day: 'numeric',
      }).format(date),
    () => date.toISOString().slice(0, 10),
  );
}

/** Locale-aware time (hours + minutes, locale-appropriate AM/PM or 24h). */
export function formatTime(value: Date | string | number): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return safeFormat(
    () =>
      new Intl.DateTimeFormat(getFormattingLocale(), {
        hour: 'numeric',
        minute: '2-digit',
      }).format(date),
    () => date.toISOString().slice(11, 16),
  );
}

/** Locale-aware number with optional Intl options (grouping, decimals…). */
export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return safeFormat(
    () => new Intl.NumberFormat(getFormattingLocale(), options).format(value),
    () => String(value),
  );
}

/**
 * Locale-aware currency. Defaults to USD (Porchivo's billing currency);
 * pass an explicit ISO code for other currencies — the locale controls
 * symbol placement/separator style, not the currency itself.
 */
export function formatCurrency(value: number, currency: string = 'USD'): string {
  return safeFormat(
    () =>
      new Intl.NumberFormat(getFormattingLocale(), {
        style: 'currency',
        currency,
      }).format(value),
    () => `$${value.toFixed(2)}`,
  );
}
