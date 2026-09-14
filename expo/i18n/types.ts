/**
 * Porchivo — i18n type contracts.
 *
 * Importing this module (config.ts does it first) augments i18next's
 * CustomTypeOptions with the shape of en-US.json. From then on `t()` is
 * fully typed: known keys autocomplete, unknown keys are compile errors,
 * and interpolation variables are checked against the placeholder names in
 * the English source strings.
 *
 * es-US.json is structurally checked against en-US.json in config.ts
 * (`const esUSChecked: typeof enUS = esUS`), so a missing Spanish key is a
 * compile error — dictionaries cannot silently diverge.
 *
 * ── Future translation-memory metadata (NOT built in this task) ────────────
 * When AI/professional translation tooling is introduced, per-key provenance
 * should be tracked outside the runtime dictionaries, e.g. a
 * `translation_meta` table or sidecar keyed by (source_key, target_locale):
 *   { sourceText, sourceLocale: 'en-US', targetLocale, status:
 *     'draft' | 'machine' | 'human_reviewed' | 'approved', provider,
 *     providerVersion, translatedAt }
 * The dictionaries stay pure key → string so nothing in the app depends on
 * that future service.
 */

import type enUS from './locales/en-US.json';

export type TranslationSchema = typeof enUS;

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: {
      translation: TranslationSchema;
    };
  }
}

/** All valid top-level namespace keys (e.g. 'settings', 'common'). */
export type TranslationNamespace = keyof TranslationSchema;
