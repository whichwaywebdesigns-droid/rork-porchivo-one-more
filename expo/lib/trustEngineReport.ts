/**
 * Trust Engine PDF Report Generator
 *
 * Exports the current compliance posture, control states, evidence vault,
 * remediation actions, and recent monitoring cycles as a formatted PDF.
 *
 * Uses expo-print to render HTML → PDF and expo-sharing to present the
 * system share sheet (or print dialog on platforms without sharing).
 */

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { log, error as logError } from '@/lib/logger';
import {
  CONTROL_REGISTRY,
  type CompliancePosture,
  type ControlState,
  type RemediationAction,
  type LoopCycleResult,
  type EvidenceArtifact,
  type Framework,
} from '@/lib/trustEngine';
import { TRUST_ENGINE } from '@/config/app';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Snapshot of the Trust Engine used to build a PDF report */
export interface TrustEngineReportInput {
  /** ISO timestamp when the report was generated */
  generatedAt: string;
  /** Overall compliance posture */
  posture: CompliancePosture;
  /** Live control states */
  controlStates: ControlState[];
  /** Open and acknowledged remediation actions */
  remediations: RemediationAction[];
  /** Recent agentic loop cycles */
  cycleHistory: LoopCycleResult[];
  /** Evidence artifacts collected by the vault */
  evidence: EvidenceArtifact[];
  /** Hash-chain integrity result */
  chainIntegrity: boolean;
  /** Last completed cycle, if any */
  lastCycle?: LoopCycleResult;
}

/** Result of the PDF generation */
export interface TrustEngineReportResult {
  /** Local file URI of the generated PDF */
  uri: string;
  /** Report ID used in the filename and inside the document */
  reportId: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function statusColor(status: string): string {
  switch (status) {
    case 'pass': return '#1E9C6A';
    case 'warning': return '#D97706';
    case 'fail': return '#E5484D';
    default: return '#6B7F99';
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'pass': return 'PASS';
    case 'warning': return 'WARN';
    case 'fail': return 'FAIL';
    default: return 'UNKNOWN';
  }
}

function severityLabel(severity: string): string {
  switch (severity) {
    case 'critical': return 'Critical';
    case 'warning': return 'Warning';
    case 'healthy': return 'Healthy';
    case 'info': return 'Info';
    default: return severity;
  }
}

function postureColor(label: string): string {
  switch (label) {
    case 'healthy': return '#1E9C6A';
    case 'warning': return '#D97706';
    case 'critical': return '#E5484D';
    default: return '#6B7F99';
  }
}

// ─── HTML Report Builder ──────────────────────────────────────────────────────

function buildHtmlReport(input: TrustEngineReportInput): string {
  const {
    generatedAt,
    posture,
    controlStates,
    remediations,
    cycleHistory,
    evidence,
    chainIntegrity,
    lastCycle,
  } = input;

  const reportId = `TR-${Date.now().toString(36).toUpperCase()}`;
  const generatedDate = formatDateTime(generatedAt);

  const frameworkRows = Object.entries(posture.frameworkScores ?? {})
    .map(([framework, score]) => {
      const fw = framework as Framework;
      const fwControls = controlStates.filter((s) => {
        const def = CONTROL_REGISTRY.find((d) => d.id === s.controlId);
        return def?.framework === fw;
      });
      return `
        <tr>
          <td style="font-weight:600">${escapeHtml(framework)}</td>
          <td style="text-align:center">
            <span style="display:inline-block;min-width:44px;text-align:center;padding:3px 10px;border-radius:6px;background:${score && score >= 85 ? '#E8F9F0' : score && score >= 70 ? '#FFF8E6' : '#FDECEC'};color:${score ? postureColor(score >= 85 ? 'healthy' : score >= 70 ? 'warning' : 'critical') : '#6B7F99'};font-weight:800">${score ?? 0}%</span>
          </td>
          <td style="text-align:center">${fwControls.length}</td>
          <td style="text-align:center">${fwControls.filter((s) => s.status === 'pass').length}</td>
        </tr>
      `;
    })
    .join('');

  const controlRows = controlStates
    .map((state) => {
      const def = CONTROL_REGISTRY.find((d) => d.id === state.controlId);
      if (!def) return '';
      const color = statusColor(state.status);
      return `
        <tr>
          <td>
            <div style="font-weight:600">${escapeHtml(def.name)}</div>
            <div style="font-size:11px;color:#6B7F99;margin-top:2px">${escapeHtml(def.framework)} · ${escapeHtml(def.controlRef)}</div>
          </td>
          <td style="text-align:center">
            <span style="display:inline-block;min-width:52px;text-align:center;padding:3px 8px;border-radius:6px;background:${color}15;color:${color};font-weight:800;font-size:11px">${statusLabel(state.status)}</span>
          </td>
          <td style="text-align:center">${severityLabel(state.severity)}</td>
          <td style="font-size:12px;color:#374B6B">${escapeHtml(state.detail)}</td>
          <td style="font-size:11px;color:#6B7F99;white-space:nowrap">${formatDateTime(state.lastChecked)}</td>
        </tr>
      `;
    })
    .join('');

  const openRemediations = remediations.filter((r) => !r.acknowledged);
  const ackedRemediations = remediations.filter((r) => r.acknowledged);

  const remediationList = (list: RemediationAction[]) =>
    list
      .map((rem) => {
        const color = rem.severity === 'critical' ? '#E5484D' : rem.severity === 'warning' ? '#D97706' : '#6B7F99';
        const steps = rem.steps
          .map((step, i) => `<li style="margin-bottom:4px">${i + 1}. ${escapeHtml(step)}</li>`)
          .join('');
        return `
          <div style="border:1px solid ${color}30;border-radius:8px;padding:14px;margin-bottom:12px;background:${color}08">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
              <span style="font-size:11px;font-weight:800;color:${color};text-transform:uppercase;letter-spacing:0.6px">${rem.severity}</span>
              <span style="font-size:11px;color:#6B7F99">${formatDateTime(rem.generatedAt)}</span>
            </div>
            <div style="font-weight:700;margin-bottom:8px">${escapeHtml(rem.description)}</div>
            <ol style="margin:0;padding-left:18px;font-size:12px;color:#374B6B">${steps}</ol>
          </div>
        `;
      })
      .join('') || '<p style="color:#6B7F99">No remediation actions.</p>';

  const cycleRows = cycleHistory
    .slice(-10)
    .reverse()
    .map((cycle) => `
      <tr>
        <td style="font-weight:700">#${cycle.cycleNumber}</td>
        <td>${formatDateTime(cycle.completedAt)}</td>
        <td style="text-align:center">${cycle.controlsEvaluated}</td>
        <td style="text-align:center">${cycle.evidenceCollected}</td>
        <td style="text-align:center">${cycle.driftDetected}</td>
        <td style="text-align:center">
          <span style="font-weight:800;color:${postureColor(cycle.postureScore >= 85 ? 'healthy' : cycle.postureScore >= 70 ? 'warning' : 'critical')}">${cycle.postureScore}</span>
        </td>
        <td style="text-align:right">${formatDuration(cycle.durationMs)}</td>
      </tr>
    `)
    .join('') || '<tr><td colspan="7" style="color:#6B7F99">No cycles completed yet.</td></tr>';

  const evidenceRows = evidence
    .slice(0, 50)
    .map((artifact) => `
      <tr>
        <td style="font-size:11px;color:#6B7F99;font-family:monospace">${escapeHtml(artifact.id)}</td>
        <td>${escapeHtml(artifact.framework)}</td>
        <td>
          <div style="font-weight:600">${escapeHtml(CONTROL_REGISTRY.find((d) => d.id === artifact.controlId)?.name ?? artifact.controlId)}</div>
          <div style="font-size:11px;color:#6B7F99">${escapeHtml(artifact.type.replace(/_/g, ' '))}</div>
        </td>
        <td style="font-size:12px;color:#374B6B">${escapeHtml(artifact.summary)}</td>
        <td style="text-align:center;font-size:11px;color:#6B7F99">${formatDateTime(artifact.collectedAt)}</td>
        <td style="text-align:center;font-size:11px;font-family:monospace;color:#6B7F99">${escapeHtml(artifact.contentHash)}</td>
      </tr>
    `)
    .join('') || '<tr><td colspan="6" style="color:#6B7F99">No evidence artifacts collected.</td></tr>';

  const scoreColor = postureColor(posture.label);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Porchivo Trust Engine Report — ${reportId}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; background:#fff; color:#1A2B4A; font-size:13px; line-height:1.55; }
    .page { max-width: 860px; margin: 0 auto; padding: 40px; }
    .header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #3A7BD5; padding-bottom:20px; margin-bottom:30px; }
    .brand { font-size:20px; font-weight:900; color:#1A2B4A; letter-spacing:-0.5px; }
    .brand-tag { font-size:12px; color:#6B7F99; margin-top:2px; }
    .report-id { text-align:right; font-size:12px; color:#6B7F99; }
    .report-id strong { display:block; color:#1A2B4A; font-size:16px; font-weight:800; margin-bottom:2px; }
    h1 { font-size:22px; font-weight:800; color:#1A2B4A; margin-bottom:6px; }
    h2 { font-size:15px; font-weight:800; color:#1A2B4A; margin-top:28px; margin-bottom:12px; text-transform:uppercase; letter-spacing:0.6px; }
    .subtitle { font-size:13px; color:#6B7F99; margin-bottom:24px; }
    .score-card { display:flex; gap:24px; align-items:center; background:#F5F7FA; border-radius:12px; padding:24px; margin-bottom:24px; }
    .score-ring { width:110px; height:110px; border-radius:50%; border:4px solid ${scoreColor}30; display:flex; flex-direction:column; align-items:center; justify-content:center; }
    .score-value { font-size:36px; font-weight:900; color:${scoreColor}; font-variant-numeric:tabular-nums; }
    .score-label { font-size:10px; font-weight:800; color:#6B7F99; text-transform:uppercase; letter-spacing:1px; margin-top:2px; }
    .score-meta { flex:1; }
    .score-meta .row { display:flex; gap:24px; margin-bottom:8px; }
    .score-meta .item { flex:1; }
    .score-meta .val { font-size:18px; font-weight:800; color:#1A2B4A; font-variant-numeric:tabular-nums; }
    .score-meta .lbl { font-size:10px; color:#6B7F99; text-transform:uppercase; letter-spacing:0.7px; margin-top:2px; }
    .status-badge { display:inline-block; padding:4px 12px; border-radius:6px; font-size:12px; font-weight:800; color:#fff; background:${scoreColor}; }
    .summary-grid { display:grid; grid-template-columns:repeat(4, 1fr); gap:12px; margin-bottom:24px; }
    .summary-card { background:#F5F7FA; border-radius:10px; padding:14px 16px; }
    .summary-card .val { font-size:20px; font-weight:900; color:#1A2B4A; font-variant-numeric:tabular-nums; }
    .summary-card .lbl { font-size:10px; color:#6B7F99; text-transform:uppercase; letter-spacing:0.7px; margin-top:3px; }
    table { width:100%; border-collapse:collapse; margin-bottom:24px; }
    th { text-align:left; font-size:10px; font-weight:700; color:#6B7F99; text-transform:uppercase; letter-spacing:0.6px; padding:10px; background:#F5F7FA; border-bottom:1px solid #D8E4F0; }
    td { padding:10px; border-bottom:1px solid #EBF0F8; font-size:12px; vertical-align:top; }
    tr:last-child td { border-bottom:none; }
    .integrity-row { display:flex; gap:8px; align-items:center; padding:10px 14px; border-radius:8px; background:${chainIntegrity ? '#E8F9F0' : '#FDECEC'}; color:${chainIntegrity ? '#1E9C6A' : '#E5484D'}; font-size:12px; font-weight:700; margin-bottom:24px; }
    .note { font-size:11px; color:#6B7F99; line-height:1.6; margin-top:4px; }
    .footer { text-align:center; font-size:11px; color:#9CA8BB; border-top:1px solid #EBF0F8; padding-top:18px; margin-top:30px; }
    .section { page-break-inside: avoid; }
    .page-break { page-break-before: always; }
    @media print { .page { padding: 24px; } }
  </style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>
      <div class="brand">Porchivo</div>
      <div class="brand-tag">WhichWay Trust Engine</div>
    </div>
    <div class="report-id">
      <strong>${reportId}</strong>
      Generated ${generatedDate}<br />
      ${lastCycle ? `Cycle #${lastCycle.cycleNumber} · ${formatDateTime(lastCycle.completedAt)}` : 'Initial assessment'}
    </div>
  </div>

  <h1>Compliance Audit Report</h1>
  <p class="subtitle">This report captures the current compliance posture, evidence artifacts, control evaluations, and remediation actions produced by the WhichWay Trust Engine agentic monitoring loop.</p>

  <div class="score-card">
    <div class="score-ring">
      <div class="score-value">${posture.overallScore}</div>
      <div class="score-label">Score</div>
    </div>
    <div class="score-meta">
      <div style="margin-bottom:10px">
        <span class="status-badge">${posture.label.toUpperCase()}</span>
      </div>
      <div class="row">
        <div class="item"><div class="val">${posture.passingControls}</div><div class="lbl">Passing</div></div>
        <div class="item"><div class="val">${posture.warningControls}</div><div class="lbl">Warnings</div></div>
        <div class="item"><div class="val">${posture.failingControls}</div><div class="lbl">Failing</div></div>
        <div class="item"><div class="val">${posture.driftEvents}</div><div class="lbl">Drift</div></div>
      </div>
      <div class="row">
        <div class="item"><div class="val">${posture.totalControls}</div><div class="lbl">Total Controls</div></div>
        <div class="item"><div class="val">${posture.daysToAuditReady === 0 ? 'Ready' : `${posture.daysToAuditReady}d`}</div><div class="lbl">Audit Ready</div></div>
        <div class="item"><div class="val">${evidence.length}</div><div class="lbl">Evidence Artifacts</div></div>
        <div class="item"><div class="val">${Math.round(posture.avgEvidenceAgeHours)}h</div><div class="lbl">Avg Evidence Age</div></div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>Framework Scores</h2>
    <table>
      <thead>
        <tr><th>Framework</th><th style="text-align:center">Score</th><th style="text-align:center">Controls</th><th style="text-align:center">Passing</th></tr>
      </thead>
      <tbody>
        ${frameworkRows}
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>Evidence Vault Integrity</h2>
    <div class="integrity-row">
      ${chainIntegrity ? '✓ Hash chain integrity verified — evidence is tamper-evident.' : '✗ Hash chain integrity failure — evidence may have been altered.'}
    </div>
    <p class="note">Every artifact is content-hashed and linked to the previous artifact. The vault currently holds ${evidence.length} artifacts across ${TRUST_ENGINE.frameworks.length} frameworks.</p>
  </div>

  <div class="section page-break">
    <h2>Control Evaluations</h2>
    <table>
      <thead>
        <tr><th>Control</th><th style="text-align:center">Status</th><th style="text-align:center">Severity</th><th>Detail</th><th style="text-align:right">Last Checked</th></tr>
      </thead>
      <tbody>
        ${controlRows}
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>Open Remediation Actions</h2>
    ${remediationList(openRemediations)}
  </div>

  <div class="section">
    <h2>Acknowledged Remediation Actions</h2>
    ${remediationList(ackedRemediations)}
  </div>

  <div class="section page-break">
    <h2>Evidence Artifacts</h2>
    <table>
      <thead>
        <tr><th>ID</th><th>Framework</th><th>Control</th><th>Summary</th><th style="text-align:center">Collected</th><th style="text-align:center">Hash</th></tr>
      </thead>
      <tbody>
        ${evidenceRows}
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>Recent Monitoring Cycles</h2>
    <table>
      <thead>
        <tr><th>Cycle</th><th>Completed</th><th style="text-align:center">Controls</th><th style="text-align:center">Evidence</th><th style="text-align:center">Drift</th><th style="text-align:center">Score</th><th style="text-align:right">Duration</th></tr>
      </thead>
      <tbody>
        ${cycleRows}
      </tbody>
    </table>
  </div>

  <div class="footer">
    <strong>Porchivo Inc.</strong> · ${TRUST_ENGINE.frameworks.join(', ')} · Enterprise compliance report<br />
    Confidential — generated by the WhichWay Trust Engine · ${reportId}
  </div>
</div>
</body>
</html>`;
}

// ─── PDF Generation & Sharing ─────────────────────────────────────────────────

/**
 * Generates a formatted PDF report from the current Trust Engine snapshot and
 * presents the system share sheet (or print dialog on platforms without sharing).
 *
 * @param input - Snapshot of posture, controls, evidence, and cycles
 * @returns The local PDF URI and report ID
 */
export async function exportTrustEngineReport(
  input: TrustEngineReportInput,
): Promise<TrustEngineReportResult> {
  const reportId = `TR-${Date.now().toString(36).toUpperCase()}`;
  const html = buildHtmlReport(input);
  const filename = `porchivo-trust-engine-report-${reportId}.pdf`;

  try {
    log('[TrustEngineReport] Generating PDF', reportId);
    const { uri } = await Print.printToFileAsync({ html, base64: false });

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: filename,
        UTI: 'com.adobe.pdf',
      });
    } else if (Platform.OS === 'web') {
      // On web, printToFileAsync returns a local blob URL; open print dialog
      await Print.printAsync({ uri });
    }

    return { uri, reportId };
  } catch (e) {
    logError('[TrustEngineReport] PDF generation failed', e);
    throw e;
  }
}
