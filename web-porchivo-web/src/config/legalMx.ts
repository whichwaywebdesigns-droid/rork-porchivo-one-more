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
  effectiveDate: "5 de septiembre de 2026",
  /** Contractual jurisdiction for the Términos (CDMX is the standard national default). */
  jurisdiction: "Ciudad de México",
  /**
   * Registered office (domicilio) — the single pending legal fact for the
   * Mexican documents. Rendered in the identity sections only once set;
   * intentionally empty until the founder confirms it.
   */
  domicilio: "",
} as const;
