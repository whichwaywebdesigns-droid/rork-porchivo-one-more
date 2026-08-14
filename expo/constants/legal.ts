/**
 * Versioned legal agreement metadata.
 *
 * Bump LEGAL_VERSION whenever the Terms of Service or Privacy Policy change
 * materially. Changing this string forces every existing user to re-accept the
 * updated agreements before they can keep using the app, and records a new
 * timestamped consent row in Supabase (see lib/consent.ts + user_consents).
 *
 * Keep this in sync with the EFFECTIVE_DATE in app/terms-of-service.tsx.
 */
export const LEGAL_VERSION = '2026-08-14' as const;

/** Human-readable effective date shown to users at the re-accept prompt. */
export const LEGAL_EFFECTIVE_DATE = 'August 14, 2026' as const;

/** Documents covered by a single acceptance event. */
export const LEGAL_DOCUMENTS = ['terms_of_service', 'privacy_policy'] as const;
