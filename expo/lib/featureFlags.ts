/**
 * Porchivo Feature Flags
 *
 * Phase 1 — static flags. Future phases can pull these from Supabase
 * remote config or LaunchDarkly without changing any call sites.
 *
 * Rules:
 *  - Never gate safety / billing / RLS enforcement on a flag
 *  - Flags only control UI surface visibility, not server-side truth
 *  - New features ship behind flags; remove the flag when stable
 */

export const FeatureFlags = {
  /**
   * Community / HOA / Condo / Multifamily mode.
   * When true, the Community tab is visible to all users.
   * Non-members see the join CTA; members see the dashboard.
   */
  COMMUNITY_MODE: true,

  /**
   * Porch Partners — the neighbor-holds-your-package marketplace.
   * HIDDEN until neighborhood density is high enough to make the two-sided
   * marketplace work. When false, all Porch Partner entry points (onboarding
   * role/teaser, profile role + payout, home upsell, invite, partner-only
   * shipment flows, safety-score partner stats, and partner routes) are hidden.
   * The underlying code and data are kept intact — flip to true to re-enable.
   */
  PORCH_PARTNERS: false,

  /**
   * Org admin can log packages on behalf of residents via
   * the staff package board.
   */
  ORG_PACKAGE_LOGGING: true,

  /**
   * Board/staff announcements feed in the community dashboard.
   */
  ORG_ANNOUNCEMENTS: true,

  /**
   * Full announcements screen with filters, ticker, scheduled posts,
   * compose sheet, and template library. Phase 3 feature.
   */
  ORG_ANNOUNCEMENTS_FULL: true,

  /**
   * Resident directory — searchable, role-aware member list.
   * Phase 2 feature — shipped and enabled.
   */
  ORG_RESIDENT_DIRECTORY: true,

  /**
   * Bulk package ops: mark multiple packages picked up at once.
   * Phase 2 feature.
   */
  ORG_BULK_PACKAGE_OPS: false,

  /**
   * Property manager multi-building selector.
   * Phase 2 feature.
   */
  ORG_MULTI_PROPERTY: false,

  /**
   * Admin dashboard — role-aware ops home for hoa_admin, property_manager,
   * property_staff, super_admin. Phase 5 feature.
   */
  ORG_ADMIN_DASHBOARD: true,

  /**
   * Full Package Operations Board — staff-facing package queue with filter
   * tabs, status transitions, carrier badges, and the Log Package wizard.
   * Phase 6 feature.
   */
  ORG_PACKAGE_OPS_BOARD: true,

  /**
   * Incident Review Queue — role-aware operational module for flagging,
   * triaging, investigating, escalating, and resolving package incidents.
   * HOA admins and staff see the full queue; residents can file and track
   * their own incidents. Phase 7 feature.
   */
  ORG_INCIDENT_QUEUE: true,

  /**
   * Property / Building Management — add properties, manage units,
   * track occupancy, and assign managers. Phase 8 feature.
   */
  ORG_PROPERTY_MANAGEMENT: true,

  /**
   * Role Management — invite members by email, assign roles, suspend,
   * reinstate, and remove members. Regenerate community invite codes.
   * Phase 9 feature.
   */
  ORG_ROLE_MANAGEMENT: true,

  /**
   * Activity / Audit History — timestamped community action log for
   * staff and admins. Populated by DB triggers on memberships, packages,
   * announcements, incidents, and properties. Phase 10 feature.
   */
  ORG_ACTIVITY_HISTORY: true,

  /**
   * Community Analytics & Insights — aggregated package trends, incident
   * metrics, SLA compliance, community health score, carrier performance,
   * member growth, and operational KPIs. Phase 11 feature.
   */
  ORG_ANALYTICS: true,

  /**
   * Community Calendar — HOA meetings, maintenance windows, amenity
   * scheduling, social events, deadlines, and inspections. Role-aware:
   * residents view & RSVP; staff/board create and manage events. Phase 12.
   */
  ORG_CALENDAR: true,

  /**
   * Maintenance Requests — residents submit work orders; staff/admin manage
   * the queue with categories, priorities, status workflow, assignment,
   * scheduling, comments, and resolution tracking. Phase 13.
   */
  ORG_MAINTENANCE: true,

  /**
   * Portfolio view — multi-community switcher for admins/managers whose plan
   * allows several communities (Professional: 3, Property Manager: unlimited).
   * Renders the horizontal community switcher on the Community tab.
   */
  ORG_PORTFOLIO: true,

  /**
   * Vendor Directory — org-scoped vendor list (name, trade, contact) with
   * staff CRUD. Gated in-app to Professional / Property Manager plans.
   * Backed by the org_vendors table.
   */
  ORG_VENDOR_DIRECTORY: true,

  /**
   * Custom Branding — admin picks the community's accent color (stored on
   * organizations.brand_color) and it tints the Community surfaces.
   * Gated in-app to Professional / Property Manager plans.
   */
  ORG_BRANDING: true,
} as const;

export type FeatureFlagKey = keyof typeof FeatureFlags;

/** Type-safe flag check. Prefer this over direct property access in components. */
export function isEnabled(flag: FeatureFlagKey): boolean {
  return FeatureFlags[flag];
}
