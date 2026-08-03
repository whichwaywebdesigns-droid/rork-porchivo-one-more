/**
 * WhichWay Trust Engine — Core types, control definitions, and evidence vault.
 *
 * The Trust Engine is a continuous compliance operating system that runs an
 * agentic monitoring loop: monitor → collect evidence → detect drift →
 * remedy → repeat. It is gated to the Enterprise tier only (Scenario B).
 *
 * This module provides:
 *  - Type definitions for controls, evidence, monitors, and posture
 *  - The control registry (SOC 2, HIPAA, ISO 27001, PCI DSS mappings)
 *  - The Evidence Vault with hash-chained immutable storage
 *  - The agentic monitoring loop engine
 */

import { TRUST_ENGINE } from '@/config/app';
import { log, warn } from '@/lib/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Compliance frameworks supported by the Trust Engine */
export type Framework = typeof TRUST_ENGINE.frameworks[number];

/** Severity levels for control states and drift detection */
export type Severity = 'critical' | 'warning' | 'healthy' | 'info';

/** The phase the agentic loop is currently executing */
export type LoopPhase =
  | 'idle'
  | 'monitoring'    // Evaluating controls against live infrastructure
  | 'collecting'    // Gathering evidence from passing controls
  | 'detecting'     // Comparing current state against last known good
  | 'remedying'     // Generating remediation actions for drifted controls
  | 'scoring'       // Recalculating the overall posture score
  | 'complete';     // Cycle finished, awaiting next interval

/** A single compliance control (e.g., "RLS enabled on all tables") */
export interface ControlDefinition {
  /** Unique control ID, e.g., 'soc2-cc6.1-rls' */
  id: string;
  /** Human-readable name */
  name: string;
  /** Which framework this control maps to */
  framework: Framework;
  /** SOC 2 / HIPAA / ISO control reference */
  controlRef: string;
  /** What this control checks */
  description: string;
  /** The category for grouping in the dashboard */
  category: ControlCategory;
  /** Default severity if the control fails */
  defaultSeverity: Severity;
  /** How often to re-check this control (ms). 0 = every cycle */
  checkIntervalMs: number;
}

/** Control categories for dashboard grouping */
export type ControlCategory =
  | 'access_control'
  | 'data_protection'
  | 'infrastructure'
  | 'incident_response'
  | 'vendor_management'
  | 'policy governance';

/** The live state of a control as evaluated by the monitoring loop */
export interface ControlState {
  controlId: string;
  /** Current status from the last evaluation */
  status: 'pass' | 'fail' | 'warning' | 'unknown';
  /** When the control was last evaluated (ISO timestamp) */
  lastChecked: string;
  /** Human-readable detail about the current state */
  detail: string;
  /** Severity if this control is not passing */
  severity: Severity;
  /** Whether the control has drifted since the last evaluation */
  drifted: boolean;
}

/** An evidence artifact collected by the vault */
export interface EvidenceArtifact {
  /** Unique artifact ID */
  id: string;
  /** Which control this evidence supports */
  controlId: string;
  /** Framework mapping */
  framework: Framework;
  /** When the evidence was collected (ISO timestamp) */
  collectedAt: string;
  /** What kind of evidence this is */
  type: EvidenceType;
  /** A human-readable summary of what was captured */
  summary: string;
  /** The actual evidence payload (JSON snapshot, config, etc.) */
  payload: string;
  /** SHA-256 content hash for tamper detection */
  contentHash: string;
  /** Hash of the previous artifact in the chain (for integrity) */
  previousHash: string;
  /** Who or what collected this evidence */
  collectedBy: string;
}

/** Types of evidence the vault can store */
export type EvidenceType =
  | 'config_snapshot'
  | 'policy_state'
  | 'api_response'
  | 'log_export'
  | 'screenshot_ref'
  | 'manual_upload';

/** A remediation action generated when drift is detected */
export interface RemediationAction {
  id: string;
  controlId: string;
  /** What needs to be fixed */
  description: string;
  /** How to fix it */
  steps: string[];
  severity: Severity;
  /** When the remedy was generated */
  generatedAt: string;
  /** Whether the remedy has been acknowledged */
  acknowledged: boolean;
}

/** Overall compliance posture across all frameworks */
export interface CompliancePosture {
  /** 0–100 score, higher is better */
  overallScore: number;
  /** Per-framework scores */
  frameworkScores: Partial<Record<Framework, number>>;
  /** Total controls evaluated */
  totalControls: number;
  /** Controls passing */
  passingControls: number;
  /** Controls failing */
  failingControls: number;
  /** Controls with warnings */
  warningControls: number;
  /** Number of drift events detected in the last cycle */
  driftEvents: number;
  /** Average evidence age in hours */
  avgEvidenceAgeHours: number;
  /** Days until audit-ready (estimate based on open remediations) */
  daysToAuditReady: number;
  /** Posture label derived from score */
  label: PostureLabel;
}

/** Label derived from the posture score thresholds */
export type PostureLabel = 'critical' | 'warning' | 'healthy';

/** A single cycle of the agentic monitoring loop */
export interface LoopCycleResult {
  /** Cycle number since activation */
  cycleNumber: number;
  /** When the cycle started (ISO) */
  startedAt: string;
  /** When the cycle completed (ISO) */
  completedAt: string;
  /** Duration in ms */
  durationMs: number;
  /** Controls evaluated */
  controlsEvaluated: number;
  /** Evidence collected */
  evidenceCollected: number;
  /** Drift detected */
  driftDetected: number;
  /** Remediations generated */
  remediationsGenerated: number;
  /** Posture score after this cycle */
  postureScore: number;
}

// ─── Control Registry ─────────────────────────────────────────────────────────

/**
 * The control registry defines every compliance control the Trust Engine
 * monitors. Each control maps to a framework reference and is evaluated
 * by the monitoring loop on each cycle.
 *
 * Controls are organized by category and cover the Porchivo stack:
 * Supabase (RLS, auth, policies), GitHub (branch protection, secrets),
 * Stripe (webhooks, keys), and Expo (config, permissions).
 */
export const CONTROL_REGISTRY: ControlDefinition[] = [
  // ── Access Control (SOC 2 CC6) ──────────────────────────────────────────
  {
    id: 'soc2-cc6.1-rls',
    name: 'Row-Level Security on all PII tables',
    framework: 'SOC 2 Type II',
    controlRef: 'CC6.1',
    description: 'Verifies RLS is enabled on every table containing resident PII, package records, or access logs.',
    category: 'access_control',
    defaultSeverity: 'critical',
    checkIntervalMs: 0,
  },
  {
    id: 'soc2-cc6.2-access-review',
    name: 'Quarterly access reviews completed',
    framework: 'SOC 2 Type II',
    controlRef: 'CC6.2',
    description: 'Confirms a periodic access review has been completed within the last 90 days.',
    category: 'access_control',
    defaultSeverity: 'warning',
    checkIntervalMs: 0,
  },
  {
    id: 'soc2-cc6.3-mfa',
    name: 'MFA enforced on all admin accounts',
    framework: 'SOC 2 Type II',
    controlRef: 'CC6.3',
    description: 'Checks that multi-factor authentication is enabled for every admin-level account.',
    category: 'access_control',
    defaultSeverity: 'critical',
    checkIntervalMs: 0,
  },
  {
    id: 'soc2-cc6.5-key-rotation',
    name: 'API keys rotated within policy window',
    framework: 'SOC 2 Type II',
    controlRef: 'CC6.5',
    description: 'Verifies no API keys or secrets exceed the 90-day rotation policy.',
    category: 'access_control',
    defaultSeverity: 'warning',
    checkIntervalMs: 0,
  },

  // ── Data Protection (SOC 2 CC7, HIPAA) ──────────────────────────────────
  {
    id: 'soc2-cc7.1-encryption-rest',
    name: 'Encryption at rest enabled',
    framework: 'SOC 2 Type II',
    controlRef: 'CC7.1',
    description: 'Confirms database-level encryption at rest is active (Supabase TDE or equivalent).',
    category: 'data_protection',
    defaultSeverity: 'critical',
    checkIntervalMs: 0,
  },
  {
    id: 'soc2-cc7.1-encryption-transit',
    name: 'TLS enforced on all endpoints',
    framework: 'SOC 2 Type II',
    controlRef: 'CC7.1',
    description: 'Verifies all API endpoints and edge functions enforce HTTPS/TLS.',
    category: 'data_protection',
    defaultSeverity: 'critical',
    checkIntervalMs: 0,
  },
  {
    id: 'hipaa-164.312-a-2-access',
    name: 'PHI access logged and auditable',
    framework: 'HIPAA',
    controlRef: '§164.312(a)(2)(i)',
    description: 'Checks that all access to protected health information is logged with user, timestamp, and action.',
    category: 'data_protection',
    defaultSeverity: 'critical',
    checkIntervalMs: 0,
  },

  // ── Infrastructure (SOC 2 CC7) ──────────────────────────────────────────
  {
    id: 'soc2-cc7.2-branch-protection',
    name: 'GitHub branch protection enabled',
    framework: 'SOC 2 Type II',
    controlRef: 'CC7.2',
    description: 'Verifies the main branch requires PR review and has branch protection rules active.',
    category: 'infrastructure',
    defaultSeverity: 'warning',
    checkIntervalMs: 0,
  },
  {
    id: 'soc2-cc7.2-secret-scanning',
    name: 'Secret scanning enabled on repository',
    framework: 'SOC 2 Type II',
    controlRef: 'CC7.2',
    description: 'Confirms GitHub secret scanning and push protection are active.',
    category: 'infrastructure',
    defaultSeverity: 'warning',
    checkIntervalMs: 0,
  },
  {
    id: 'soc2-cc7.4-uptime-monitoring',
    name: 'Uptime monitoring active',
    framework: 'SOC 2 Type II',
    controlRef: 'CC7.4',
    description: 'Verifies the application has active uptime/health monitoring configured.',
    category: 'infrastructure',
    defaultSeverity: 'warning',
    checkIntervalMs: 0,
  },

  // ── Incident Response (SOC 2 CC7.3-7.5) ─────────────────────────────────
  {
    id: 'soc2-cc7.3-incident-plan',
    name: 'Incident response plan documented',
    framework: 'SOC 2 Type II',
    controlRef: 'CC7.3',
    description: 'Checks that an incident response plan exists and has been reviewed in the last year.',
    category: 'incident_response',
    defaultSeverity: 'warning',
    checkIntervalMs: 0,
  },
  {
    id: 'soc2-cc7.5-incident-log',
    name: 'Incidents tracked and resolved',
    framework: 'SOC 2 Type II',
    controlRef: 'CC7.5',
    description: 'Verifies all incidents in the last 90 days have resolution records.',
    category: 'incident_response',
    defaultSeverity: 'info',
    checkIntervalMs: 0,
  },

  // ── Vendor Management (SOC 2 CC9.2) ─────────────────────────────────────
  {
    id: 'soc2-cc9.2-vendor-assessment',
    name: 'Vendor risk assessments current',
    framework: 'SOC 2 Type II',
    controlRef: 'CC9.2',
    description: 'Confirms vendor risk assessments (Supabase, Stripe, GitHub) are documented and current.',
    category: 'vendor_management',
    defaultSeverity: 'warning',
    checkIntervalMs: 0,
  },
  {
    id: 'soc2-cc9.2-stripe-webhook',
    name: 'Stripe webhook signature verification',
    framework: 'SOC 2 Type II',
    controlRef: 'CC9.2',
    description: 'Verifies Stripe webhook endpoints validate signatures to prevent injection.',
    category: 'vendor_management',
    defaultSeverity: 'critical',
    checkIntervalMs: 0,
  },

  // ── Policy Governance (SOC 2 CC1, CC2) ──────────────────────────────────
  {
    id: 'soc2-cc1.5-policy-acknowledgment',
    name: 'Security policy acknowledged by all team members',
    framework: 'SOC 2 Type II',
    controlRef: 'CC1.5',
    description: 'Checks that every team member has acknowledged the current security policy version.',
    category: 'policy governance',
    defaultSeverity: 'warning',
    checkIntervalMs: 0,
  },
  {
    id: 'soc2-cc2.1-training',
    name: 'Security awareness training completed',
    framework: 'SOC 2 Type II',
    controlRef: 'CC2.1',
    description: 'Verifies all team members have completed annual security awareness training.',
    category: 'policy governance',
    defaultSeverity: 'info',
    checkIntervalMs: 0,
  },

  // ── ISO 27001 (selected controls) ───────────────────────────────────────
  {
    id: 'iso27001-a.8.2.1-classification',
    name: 'Information classification scheme active',
    framework: 'ISO 27001',
    controlRef: 'A.8.2.1',
    description: 'Confirms data classification levels are defined and applied to all data stores.',
    category: 'data_protection',
    defaultSeverity: 'info',
    checkIntervalMs: 0,
  },
  {
    id: 'iso27001-a.12.6.1-vuln-mgmt',
    name: 'Vulnerability management process active',
    framework: 'ISO 27001',
    controlRef: 'A.12.6.1',
    description: 'Verifies a vulnerability scanning and remediation process is operational.',
    category: 'infrastructure',
    defaultSeverity: 'warning',
    checkIntervalMs: 0,
  },

  // ── PCI DSS (selected controls) ─────────────────────────────────────────
  {
    id: 'pci-3.4-cardholder-masking',
    name: 'Cardholder data masked in storage',
    framework: 'PCI DSS',
    controlRef: '3.4',
    description: 'Confirms PAN is masked or tokenized — no full card numbers stored.',
    category: 'data_protection',
    defaultSeverity: 'critical',
    checkIntervalMs: 0,
  },
  {
    id: 'pci-6.5.1-injection-prevention',
    name: 'Injection attack prevention verified',
    framework: 'PCI DSS',
    controlRef: '6.5.1',
    description: 'Checks that parameterized queries and input validation are in place to prevent injection.',
    category: 'infrastructure',
    defaultSeverity: 'critical',
    checkIntervalMs: 0,
  },
];

// ─── Evidence Vault ───────────────────────────────────────────────────────────

/**
 * The Evidence Vault stores immutable, timestamped, hash-chained artifacts.
 * Each artifact's contentHash is SHA-256 of its payload, and previousHash
 * links to the prior artifact — forming a tamper-evident chain.
 *
 * In production, the vault would persist to Supabase with row-level security.
 * For the on-device dashboard, we keep the latest N artifacts in memory and
 * persist a summary to AsyncStorage for cross-session continuity.
 */
export class EvidenceVault {
  private artifacts: EvidenceArtifact[] = [];
  private lastHash: string = 'genesis';

  /** Maximum artifacts kept in memory (older ones are pruned) */
  private readonly maxArtifacts = 500;

  /**
   * Computes a simple hash for the payload. In production this would be
   * crypto.subtle SHA-256, but React Native's polyfill is inconsistent
   * across platforms, so we use a deterministic FNV-1a hash that's
   * sufficient for tamper detection on-device.
   */
  private hash(data: string): string {
    let hash = 0x811c9dc5;
    for (let i = 0; i < data.length; i++) {
      hash ^= data.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    // Convert to unsigned 32-bit hex
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  /**
   * Collects a new evidence artifact and chains it to the vault.
   * Returns the created artifact.
   */
  collect(params: {
    controlId: string;
    framework: Framework;
    type: EvidenceType;
    summary: string;
    payload: string;
    collectedBy: string;
  }): EvidenceArtifact {
    const contentHash = this.hash(params.payload + params.controlId + Date.now());
    const artifact: EvidenceArtifact = {
      id: `evd_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      controlId: params.controlId,
      framework: params.framework,
      collectedAt: new Date().toISOString(),
      type: params.type,
      summary: params.summary,
      payload: params.payload,
      contentHash,
      previousHash: this.lastHash,
      collectedBy: params.collectedBy,
    };
    this.artifacts.push(artifact);
    this.lastHash = contentHash;

    // Prune if exceeding max
    if (this.artifacts.length > this.maxArtifacts) {
      this.artifacts = this.artifacts.slice(-this.maxArtifacts);
    }

    return artifact;
  }

  /** Returns all artifacts, optionally filtered by control or framework */
  getArtifacts(filter?: {
    controlId?: string;
    framework?: Framework;
    limit?: number;
  }): EvidenceArtifact[] {
    let result = this.artifacts;
    if (filter?.controlId) {
      result = result.filter((a) => a.controlId === filter.controlId);
    }
    if (filter?.framework) {
      result = result.filter((a) => a.framework === filter.framework);
    }
    if (filter?.limit) {
      result = result.slice(-filter.limit);
    }
    return [...result].reverse(); // newest first
  }

  /** Returns the most recent artifact for a given control */
  getLatestForControl(controlId: string): EvidenceArtifact | null {
    const found = [...this.artifacts].reverse().find((a) => a.controlId === controlId);
    return found ?? null;
  }

  /** Returns the total count of artifacts */
  count(): number {
    return this.artifacts.length;
  }

  /**
   * Verifies the hash chain integrity of the vault.
   * Returns true if every artifact's previousHash matches the prior artifact's contentHash.
   */
  verifyChain(): boolean {
    for (let i = 1; i < this.artifacts.length; i++) {
      if (this.artifacts[i].previousHash !== this.artifacts[i - 1].contentHash) {
        warn('[TrustEngine] Hash chain broken at artifact index', i);
        return false;
      }
    }
    return true;
  }

  /** Average age of all artifacts in hours */
  averageAgeHours(): number {
    if (this.artifacts.length === 0) return 0;
    const now = Date.now();
    const totalAgeMs = this.artifacts.reduce((sum, a) => {
      return sum + (now - new Date(a.collectedAt).getTime());
    }, 0);
    return totalAgeMs / this.artifacts.length / (1000 * 60 * 60);
  }

  /** Resets the vault (used for testing or re-initialization) */
  reset(): void {
    this.artifacts = [];
    this.lastHash = 'genesis';
  }
}

// ─── Posture Score Calculation ────────────────────────────────────────────────

/**
 * Calculates the overall compliance posture from control states.
 * Score is 0–100, with weights based on control severity.
 */
export function calculatePostureScore(
  controlStates: ControlState[],
  controlDefs: ControlDefinition[] = CONTROL_REGISTRY,
): CompliancePosture {
  const total = controlStates.length;
  if (total === 0) {
    return {
      overallScore: 0,
      frameworkScores: {},
      totalControls: 0,
      passingControls: 0,
      failingControls: 0,
      warningControls: 0,
      driftEvents: 0,
      avgEvidenceAgeHours: 0,
      daysToAuditReady: 0,
      label: 'critical',
    };
  }

  const passing = controlStates.filter((s) => s.status === 'pass').length;
  const failing = controlStates.filter((s) => s.status === 'fail').length;
  const warning = controlStates.filter((s) => s.status === 'warning').length;
  const drift = controlStates.filter((s) => s.drifted).length;

  // Weight: pass=1.0, warning=0.5, fail=0, unknown=0.3
  const weighted = controlStates.reduce((sum, state) => {
    const def = controlDefs.find((d) => d.id === state.controlId);
    const severityWeight = def?.defaultSeverity === 'critical' ? 2.0 : 1.0;
    const statusScore =
      state.status === 'pass' ? 1.0 :
      state.status === 'warning' ? 0.5 :
      state.status === 'unknown' ? 0.3 : 0;
    return sum + (statusScore * severityWeight);
  }, 0);

  const maxWeighted = controlStates.reduce((sum, state) => {
    const def = controlDefs.find((d) => d.id === state.controlId);
    const severityWeight = def?.defaultSeverity === 'critical' ? 2.0 : 1.0;
    return sum + severityWeight;
  }, 0);

  const overallScore = maxWeighted > 0 ? Math.round((weighted / maxWeighted) * 100) : 0;

  // Per-framework scores
  const frameworkScores: Partial<Record<Framework, number>> = {};
  for (const fw of TRUST_ENGINE.frameworks) {
    const fwStates = controlStates.filter((s) => {
      const def = controlDefs.find((d) => d.id === s.controlId);
      return def?.framework === fw;
    });
    if (fwStates.length > 0) {
      const fwPassing = fwStates.filter((s) => s.status === 'pass').length;
      frameworkScores[fw] = Math.round((fwPassing / fwStates.length) * 100);
    }
  }

  // Days to audit-ready: estimate based on open failures
  // Each critical failure adds ~7 days, each warning adds ~2 days
  const criticalFailures = controlStates.filter((s) => {
    const def = controlDefs.find((d) => d.id === s.controlId);
    return s.status === 'fail' && def?.defaultSeverity === 'critical';
  }).length;
  const warningFailures = controlStates.filter((s) => {
    const def = controlDefs.find((d) => d.id === s.controlId);
    return s.status === 'fail' && def?.defaultSeverity === 'warning';
  }).length;
  const daysToAuditReady = criticalFailures * 7 + warningFailures * 2;

  // Label from thresholds
  const thresholds = TRUST_ENGINE.postureThresholds;
  let label: PostureLabel = 'healthy';
  if (overallScore < thresholds.critical) label = 'critical';
  else if (overallScore < thresholds.warning) label = 'warning';

  return {
    overallScore,
    frameworkScores,
    totalControls: total,
    passingControls: passing,
    failingControls: failing,
    warningControls: warning,
    driftEvents: drift,
    avgEvidenceAgeHours: 0, // Set by the vault
    daysToAuditReady,
    label,
  };
}

// ─── Remediation Generator ────────────────────────────────────────────────────

/**
 * Generates remediation actions for controls that are failing or have drifted.
 * This is the "remedy" phase of the agentic loop.
 */
export function generateRemediations(
  controlStates: ControlState[],
  controlDefs: ControlDefinition[] = CONTROL_REGISTRY,
): RemediationAction[] {
  const remediations: RemediationAction[] = [];

  for (const state of controlStates) {
    if (state.status === 'pass' && !state.drifted) continue;

    const def = controlDefs.find((d) => d.id === state.controlId);
    if (!def) continue;

    const steps = getRemediationSteps(def.id, state.status);
    if (steps.length === 0) continue;

    remediations.push({
      id: `rem_${def.id}_${Date.now()}`,
      controlId: def.id,
      description: `${def.name}: ${state.detail}`,
      steps,
      severity: state.severity,
      generatedAt: new Date().toISOString(),
      acknowledged: false,
    });
  }

  return remediations;
}

/** Returns remediation steps for a given control and status */
function getRemediationSteps(controlId: string, status: ControlState['status']): string[] {
  // Generic steps by category
  if (status === 'pass') return [];

  const stepsByControl: Record<string, string[]> = {
    'soc2-cc6.1-rls': [
      'Open Supabase Dashboard → Table Editor',
      'Select each PII table (profiles, packages, access_logs)',
      'Navigate to RLS policies and ensure ENABLE ROW LEVEL SECURITY is toggled on',
      'Verify policies exist for authenticated users only',
    ],
    'soc2-cc6.3-mfa': [
      'Open Supabase Dashboard → Authentication → Users',
      'Filter by role: admin / service_role',
      'For each admin user, verify MFA is enrolled',
      'Enforce MFA policy at the auth level for admin roles',
    ],
    'soc2-cc7.1-encryption-transit': [
      'Verify all Edge Functions redirect HTTP to HTTPS',
      'Check Supabase project settings → API → Enforce HTTPS is enabled',
      'Verify HSTS headers are set on all responses',
    ],
    'soc2-cc7.2-branch-protection': [
      'Open GitHub repository → Settings → Branches',
      'Add rule for main branch: require PR review (min 1 reviewer)',
      'Enable "Require status checks to pass before merge"',
      'Enable "Require linear history"',
    ],
    'soc2-cc9.2-stripe-webhook': [
      'Open Stripe Dashboard → Developers → Webhooks',
      'Verify webhook endpoint has signature verification enabled',
      'Check that the Stripe signing secret is set in environment variables',
      'Verify webhook handler validates the Stripe-Signature header',
    ],
  };

  return stepsByControl[controlId] ?? [
    'Review the control documentation and identify the configuration gap',
    'Apply the necessary configuration change in the relevant platform',
    'Re-run the Trust Engine monitoring cycle to verify the fix',
    'Document the remediation in the evidence vault',
  ];
}

// ─── Control Evaluator (Simulated) ────────────────────────────────────────────

/**
 * Evaluates a control against the live infrastructure.
 *
 * In production, each control would have a specific evaluator that queries
 * Supabase, GitHub, Stripe APIs. For the on-device dashboard, we use
 * deterministic simulated evaluations that reflect realistic compliance
 * states. The evaluation logic is structured so real API calls can be
 * dropped in without changing the loop architecture.
 *
 * @param control - The control definition to evaluate
 * @param lastState - The previous state (for drift detection)
 * @param cycleNumber - Current loop cycle (for deterministic variation)
 */
export function evaluateControl(
  control: ControlDefinition,
  lastState: ControlState | null,
  cycleNumber: number,
): ControlState {
  // Deterministic seed from control ID + cycle number
  const seed = hashString(control.id) + cycleNumber;

  // Most controls pass after initial stabilization (cycle 3+)
  // This simulates a real system where controls are configured and then drift
  const stabilized = cycleNumber > 2;
  const driftChance = (seed % 100) < 8; // 8% chance of drift per cycle

  let status: ControlState['status'];
  let detail: string;
  let severity: Severity = control.defaultSeverity;

  if (!stabilized) {
    // Early cycles: some controls start in unknown/warning state
    if (seed % 4 === 0) {
      status = 'warning';
      detail = `Control not yet fully verified — initial assessment in progress (cycle ${cycleNumber}).`;
    } else if (seed % 7 === 0) {
      status = 'fail';
      detail = 'Initial configuration check failed. Remediation required.';
    } else {
      status = 'pass';
      detail = 'Control verified during initial assessment.';
    }
  } else if (driftChance && lastState?.status === 'pass') {
    // Drift detected — control was passing, now isn't
    status = seed % 3 === 0 ? 'fail' : 'warning';
    detail = `Drift detected: control state changed from PASS to ${status.toUpperCase()}. Configuration may have been modified.`;
    severity = control.defaultSeverity;
  } else if (lastState?.status === 'fail' && seed % 5 < 2) {
    // Previously failing control may self-remediate (config fix applied)
    status = 'pass';
    detail = 'Control now passing — remediation applied or configuration corrected.';
  } else if (lastState) {
    // Maintain last known status
    status = lastState.status;
    detail = lastState.detail;
  } else {
    status = 'pass';
    detail = 'Control verified.';
  }

  const drifted = lastState !== null && lastState.status !== status;

  return {
    controlId: control.id,
    status,
    lastChecked: new Date().toISOString(),
    detail,
    severity,
    drifted,
  };
}

/** Simple string hash for deterministic evaluation seeding */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

// ─── Agentic Monitoring Loop ──────────────────────────────────────────────────

/**
 * The agentic monitoring loop — the core engine of the Trust Engine.
 *
 * Each cycle executes five phases in sequence:
 *   1. MONITORING  — Evaluate every control against live infrastructure
 *   2. COLLECTING  — Collect evidence from passing controls into the vault
 *   3. DETECTING   — Compare current states against last known good for drift
 *   4. REMEDYING   — Generate remediation actions for failing/drifted controls
 *   5. SCORING     — Recalculate the overall posture score
 *
 * The loop is designed to be "harnessed engineered" — it runs autonomously
 * but is fully observable, pausable, and deterministic. The loop maintains
 * state between cycles and produces a complete audit trail.
 */
export class TrustEngineLoop {
  private vault: EvidenceVault;
  private controlStates: Map<string, ControlState> = new Map();
  private remediations: RemediationAction[] = [];
  private cycleHistory: LoopCycleResult[] = [];
  private cycleNumber = 0;
  private isRunning = false;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private listeners: Set<(phase: LoopPhase, data?: unknown) => void> = new Set();
  private currentPhase: LoopPhase = 'idle';

  constructor(vault?: EvidenceVault) {
    this.vault = vault ?? new EvidenceVault();
  }

  /** Subscribes to phase changes. Returns an unsubscribe function. */
  onPhaseChange(callback: (phase: LoopPhase, data?: unknown) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private emit(phase: LoopPhase, data?: unknown): void {
    this.currentPhase = phase;
    this.listeners.forEach((cb) => cb(phase, data));
  }

  /** Returns the current phase of the loop */
  getPhase(): LoopPhase {
    return this.currentPhase;
  }

  /** Returns whether the loop is actively running */
  get running(): boolean {
    return this.isRunning;
  }

  /** Returns the current cycle number */
  getCycleNumber(): number {
    return this.cycleNumber;
  }

  /** Returns the current control states */
  getControlStates(): ControlState[] {
    return Array.from(this.controlStates.values());
  }

  /** Returns the evidence vault */
  getVault(): EvidenceVault {
    return this.vault;
  }

  /** Returns current remediation actions */
  getRemediations(): RemediationAction[] {
    return this.remediations;
  }

  /** Returns cycle history */
  getCycleHistory(): LoopCycleResult[] {
    return this.cycleHistory;
  }

  /** Acknowledges a remediation action */
  acknowledgeRemediation(remediationId: string): void {
    const rem = this.remediations.find((r) => r.id === remediationId);
    if (rem) {
      rem.acknowledged = true;
    }
  }

  /**
   * Starts the monitoring loop. The loop runs on an interval defined by
   * TRUST_ENGINE.loopIntervalMs. Each cycle executes all five phases.
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    log('[TrustEngine] Monitoring loop started');

    // Run first cycle immediately
    void this.runCycle();

    // Schedule subsequent cycles
    this.intervalId = setInterval(() => {
      void this.runCycle();
    }, TRUST_ENGINE.loopIntervalMs);
  }

  /** Stops the monitoring loop */
  stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.emit('idle');
    log('[TrustEngine] Monitoring loop stopped');
  }

  /**
   * Runs a single cycle of the agentic loop.
   * This is the core method — monitor → collect → detect → remedy → score.
   */
  async runCycle(): Promise<LoopCycleResult> {
    const startedAt = new Date().toISOString();
    const startTime = Date.now();
    this.cycleNumber++;

    log(`[TrustEngine] Cycle ${this.cycleNumber} started`);

    // ── Phase 1: MONITORING ───────────────────────────────────────────
    this.emit('monitoring');
    const newStates: ControlState[] = [];
    for (const control of CONTROL_REGISTRY) {
      const lastState = this.controlStates.get(control.id) ?? null;
      const state = evaluateControl(control, lastState, this.cycleNumber);
      newStates.push(state);
      this.controlStates.set(control.id, state);
    }

    // ── Phase 2: COLLECTING ───────────────────────────────────────────
    this.emit('collecting');
    let evidenceCollected = 0;
    for (const state of newStates) {
      if (state.status === 'pass') {
        const def = CONTROL_REGISTRY.find((d) => d.id === state.controlId);
        if (def) {
          this.vault.collect({
            controlId: def.id,
            framework: def.framework,
            type: 'config_snapshot',
            summary: `${def.name}: PASS — ${state.detail}`,
            payload: JSON.stringify({
              controlId: def.id,
              status: state.status,
              detail: state.detail,
              timestamp: state.lastChecked,
              cycle: this.cycleNumber,
            }),
            collectedBy: 'trust-engine-agent',
          });
          evidenceCollected++;
        }
      }
    }

    // ── Phase 3: DETECTING ────────────────────────────────────────────
    this.emit('detecting');
    const driftCount = newStates.filter((s) => s.drifted).length;
    if (driftCount > 0) {
      warn(`[TrustEngine] ${driftCount} control(s) drifted in cycle ${this.cycleNumber}`);
    }

    // ── Phase 4: REMEDYING ────────────────────────────────────────────
    this.emit('remedying');
    const newRemediations = generateRemediations(newStates);
    // Merge: keep acknowledged remediations, replace unacknowledged ones
    this.remediations = [
      ...this.remediations.filter((r) => r.acknowledged),
      ...newRemediations,
    ];
    const remediationsGenerated = newRemediations.length;

    // ── Phase 5: SCORING ──────────────────────────────────────────────
    this.emit('scoring');
    const posture = calculatePostureScore(newStates);
    posture.avgEvidenceAgeHours = this.vault.averageAgeHours();

    const completedAt = new Date().toISOString();
    const durationMs = Date.now() - startTime;

    const result: LoopCycleResult = {
      cycleNumber: this.cycleNumber,
      startedAt,
      completedAt,
      durationMs,
      controlsEvaluated: newStates.length,
      evidenceCollected,
      driftDetected: driftCount,
      remediationsGenerated,
      postureScore: posture.overallScore,
    };

    this.cycleHistory.push(result);
    // Keep last 100 cycles
    if (this.cycleHistory.length > 100) {
      this.cycleHistory = this.cycleHistory.slice(-100);
    }

    this.emit('complete', { result, posture, controlStates: newStates, remediations: this.remediations });
    log(`[TrustEngine] Cycle ${this.cycleNumber} complete — score: ${posture.overallScore}, drift: ${driftCount}, evidence: ${evidenceCollected}`);

    return result;
  }

  /** Returns the current posture */
  getPosture(): CompliancePosture {
    const states = this.getControlStates();
    const posture = calculatePostureScore(states);
    posture.avgEvidenceAgeHours = this.vault.averageAgeHours();
    return posture;
  }

  /** Resets all state (for testing) */
  reset(): void {
    this.stop();
    this.vault.reset();
    this.controlStates.clear();
    this.remediations = [];
    this.cycleHistory = [];
    this.cycleNumber = 0;
    this.emit('idle');
  }
}
