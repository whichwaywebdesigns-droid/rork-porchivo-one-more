/**
 * Single source of truth for the es-MX legal pages (Aviso de Privacidad +
 * Términos y Condiciones). Mirrors the finalized markdown masters in
 * `metadata/es-MX/legal/` — keep both in sync when any value changes.
 */
export const MX_LEGAL = {
  /** Legal entity (razón social) operating Porchivo — matches the EN legal pages. */
  companyName: "WhichWay Web Labs LLC",
  /** Entity descriptor used in the identity sections. */
  entityDescriptor:
    "sociedad de responsabilidad limitada constituida conforme a las leyes de los Estados Unidos de América",
  /** Data-protection contact (LFPDPPP responsable de protección de datos). */
  privacyEmail: "privacidad@porchivo.com",
  /** General support contact referenced by the Términos. */
  supportEmail: "soporte@porchivo.com",
  /** Effective / last-updated date shown on both es-MX documents. */
  effectiveDate: "6 de septiembre de 2026",
  /** Contractual jurisdiction for the Términos (CDMX is the standard national default). */
  jurisdiction: "Ciudad de México",
  /** Registered office (domicilio) — confirmed by the founder 2026-09-06. */
  domicilio: "Indianapolis, Indiana, Estados Unidos de América",
} as const;
