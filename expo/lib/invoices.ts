import { supabase } from '@/lib/supabase';
import { log, error as logError } from '@/lib/logger';
import { TransactionInvoice, InvoicePeriod, InvoicePeriodType, InvoiceRole } from '@/types';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

const FUNCTIONS_URL = process.env.EXPO_PUBLIC_RORK_FUNCTIONS_URL ?? '';

// ─── DB row shapes ─────────────────────────────────────────────────────────────

interface DbTransactionInvoice {
  id: string;
  invoice_number: string;
  assignment_id: string;
  homeowner_id: string;
  partner_id: string;
  service_date: string;
  gross_amount_cents: number;
  platform_fee_cents: number;
  partner_earn_cents: number;
  stripe_reference_id: string | null;
  status: string;
  homeowner_name: string | null;
  partner_name: string | null;
  homeowner_email: string | null;
  partner_email: string | null;
  homeowner_address: string | null;
  notes: string | null;
  created_at: string;
  issued_at: string | null;
}

interface DbInvoicePeriod {
  id: string;
  user_id: string;
  role: string;
  period_type: string;
  period_key: string;
  period_label: string;
  period_start: string;
  period_end: string;
  transaction_count: number;
  total_cents: number;
  platform_fee_total_cents: number;
  notification_sent_at: string | null;
  compiled_at: string;
  created_at: string;
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function mapInvoice(db: DbTransactionInvoice): TransactionInvoice {
  return {
    id: db.id,
    invoiceNumber: db.invoice_number,
    assignmentId: db.assignment_id,
    homeownerId: db.homeowner_id,
    partnerId: db.partner_id,
    serviceDate: db.service_date,
    grossAmountCents: db.gross_amount_cents,
    platformFeeCents: db.platform_fee_cents,
    partnerEarnCents: db.partner_earn_cents,
    stripeReferenceId: db.stripe_reference_id,
    status: db.status as TransactionInvoice['status'],
    homeownerName: db.homeowner_name,
    partnerName: db.partner_name,
    notes: db.notes,
    createdAt: db.created_at,
    issuedAt: db.issued_at,
  };
}

function mapPeriod(db: DbInvoicePeriod): InvoicePeriod {
  return {
    id: db.id,
    userId: db.user_id,
    role: db.role as InvoiceRole,
    periodType: db.period_type as InvoicePeriodType,
    periodKey: db.period_key,
    periodLabel: db.period_label.trim(),
    periodStart: db.period_start,
    periodEnd: db.period_end,
    transactionCount: db.transaction_count,
    totalCents: db.total_cents,
    platformFeeTotalCents: db.platform_fee_total_cents,
    notificationSentAt: db.notification_sent_at,
    compiledAt: db.compiled_at,
    createdAt: db.created_at,
  };
}

// ─── Auth helper ───────────────────────────────────────────────────────────────

async function getAuthHeader(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session ? `Bearer ${session.access_token}` : null;
}

// ─── Invoice fetch API ─────────────────────────────────────────────────────────

/** Fetch all transaction invoices for the current user in a given role. */
export async function fetchMyInvoices(role: InvoiceRole): Promise<TransactionInvoice[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const column = role === 'homeowner' ? 'homeowner_id' : 'partner_id';
  const { data, error } = await supabase
    .from('transaction_invoices')
    .select('*')
    .eq(column, user.id)
    .eq('status', 'issued')
    .order('service_date', { ascending: false });

  if (error) {
    logError('[invoices] fetchMyInvoices error');
    return [];
  }
  return (data as DbTransactionInvoice[]).map(mapInvoice);
}

/** Fetch invoices within a date range (for period drilling). */
export async function fetchInvoicesForPeriod(
  role: InvoiceRole,
  startDate: string,
  endDate: string,
): Promise<TransactionInvoice[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const column = role === 'homeowner' ? 'homeowner_id' : 'partner_id';
  const { data, error } = await supabase
    .from('transaction_invoices')
    .select('*')
    .eq(column, user.id)
    .eq('status', 'issued')
    .gte('service_date', startDate)
    .lte('service_date', endDate)
    .order('service_date', { ascending: false });

  if (error) {
    logError('[invoices] fetchInvoicesForPeriod error');
    return [];
  }
  return (data as DbTransactionInvoice[]).map(mapInvoice);
}

/** Fetch compiled period summaries. */
export async function fetchMyPeriods(
  role: InvoiceRole,
  periodType: InvoicePeriodType,
): Promise<InvoicePeriod[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('invoice_periods')
    .select('*')
    .eq('user_id', user.id)
    .eq('role', role)
    .eq('period_type', periodType)
    .order('period_start', { ascending: false });

  if (error) {
    logError('[invoices] fetchMyPeriods error');
    return [];
  }
  return (data as DbInvoicePeriod[]).map(mapPeriod);
}

/** Trigger period compilation via edge function. */
export async function compilePeriod(params: {
  role: InvoiceRole;
  periodType: InvoicePeriodType;
  periodStart: string;
  periodEnd: string;
}): Promise<InvoicePeriod | null> {
  const authHeader = await getAuthHeader();
  if (!authHeader) return null;

  try {
    const res = await fetch(`${FUNCTIONS_URL}/compile-invoice-period`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body: JSON.stringify(params),
    });
    const json = await res.json();
    if (!res.ok) {
      logError('[invoices] compilePeriod error: ' + (json?.error ?? res.status));
      return null;
    }
    return json.period ? mapPeriod(json.period as DbInvoicePeriod) : null;
  } catch {
    logError('[invoices] compilePeriod fetch error');
    return null;
  }
}

// ─── Formatting helpers ────────────────────────────────────────────────────────

/** Format cents as "$X.XX" */
export function fmt(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** Format ISO date string as "May 15, 2026" */
export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

// ─── PDF Generation ───────────────────────────────────────────────────────────

function porchivoLogo(): string {
  return `<img class="logo-img" src="data:image/png;base64,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" alt="Porchivo" />`;
}

/** Build HTML for a single transaction invoice PDF. */
export function buildInvoiceHTML(invoice: TransactionInvoice, viewerRole: InvoiceRole): string {
  const isHomeowner = viewerRole === 'homeowner';
  const billedTo = isHomeowner ? invoice.homeownerName ?? 'Homeowner' : invoice.partnerName ?? 'Partner';
  const serviceBy = isHomeowner ? invoice.partnerName ?? 'Porch Partner' : invoice.homeownerName ?? 'Homeowner';
  const amount = isHomeowner ? fmt(invoice.grossAmountCents) : fmt(invoice.partnerEarnCents);
  const amountLabel = isHomeowner ? 'Amount Charged' : 'Amount Earned';
  const feeNote = isHomeowner
    ? `Includes ${fmt(invoice.platformFeeCents)} Porchivo platform fee`
    : `After ${fmt(invoice.platformFeeCents)} Porchivo platform fee`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Invoice ${invoice.invoiceNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; background: #fff; color: #1A2B4A; font-size: 14px; line-height: 1.6; }
    .page { max-width: 680px; margin: 0 auto; padding: 48px 40px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 2px solid #3A7BD5; padding-bottom: 24px; }
        .logo-img { height: 32px; width: auto; display: inline-block; vertical-align: middle; }
    .invoice-meta { text-align: right; }
    .invoice-number { font-size: 20px; font-weight: 800; color: #1A2B4A; }
    .invoice-date { font-size: 13px; color: #6B7F99; margin-top: 4px; }
    .status-badge { display: inline-block; background: #E8F9F0; color: #1E9C6A; border-radius: 4px; padding: 2px 10px; font-size: 12px; font-weight: 700; margin-top: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
    .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 36px; }
    .party-block h3 { font-size: 11px; font-weight: 700; color: #6B7F99; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
    .party-block p { font-size: 14px; font-weight: 600; color: #1A2B4A; }
    .party-block span { font-size: 12px; color: #6B7F99; }
    .service-table { width: 100%; border-collapse: collapse; margin-bottom: 28px; }
    .service-table th { text-align: left; font-size: 11px; font-weight: 700; color: #6B7F99; text-transform: uppercase; letter-spacing: 1px; padding: 10px 12px; background: #F5F7FA; border-bottom: 1px solid #D8E4F0; }
    .service-table td { padding: 14px 12px; border-bottom: 1px solid #EBF0F8; font-size: 14px; }
    .service-table td.amount { font-weight: 700; font-variant-numeric: tabular-nums; }
    .totals { background: #F5F7FA; border-radius: 12px; padding: 20px 24px; margin-bottom: 28px; }
    .total-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
    .total-row.main { font-size: 18px; font-weight: 800; color: #1A2B4A; border-top: 1px solid #D8E4F0; padding-top: 12px; margin-top: 4px; }
    .total-row .label { color: #6B7F99; }
    .total-row .value { font-weight: 600; font-variant-numeric: tabular-nums; }
    .fee-note { font-size: 12px; color: #6B7F99; margin-top: 6px; font-style: italic; }
    .stripe-ref { background: #EBF2FF; border-radius: 8px; padding: 12px 16px; font-size: 12px; color: #3A7BD5; margin-bottom: 24px; }
    .stripe-ref span { font-weight: 700; }
    .footer { text-align: center; font-size: 11px; color: #9CA8BB; border-top: 1px solid #EBF0F8; padding-top: 20px; }
    .footer strong { color: #6B7F99; }
    .tax-note { background: #FFF8E6; border: 1px solid #F5D98A; border-radius: 8px; padding: 12px 16px; font-size: 12px; color: #8A6800; margin-bottom: 24px; }
    .tax-note strong { display: block; margin-bottom: 4px; color: #6B4F00; }
  </style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>
      <img class="logo-img" src="data:image/png;base64,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" alt="Porchivo" />
      <div style="font-size:12px; color:#6B7F99; margin-top:4px;">Porch Partner Service Invoice</div>
    </div>
    <div class="invoice-meta">
      <div class="invoice-number">${invoice.invoiceNumber}</div>
      <div class="invoice-date">Issued: ${invoice.issuedAt ? fmtDate(invoice.issuedAt) : fmtDate(invoice.createdAt)}</div>
      <div class="status-badge">Paid</div>
    </div>
  </div>

  <div class="parties">
    <div class="party-block">
      <h3>Billed To</h3>
      <p>${billedTo}</p>
      <span>${isHomeowner ? 'Homeowner' : 'Porch Partner'}</span>
    </div>
    <div class="party-block">
      <h3>${isHomeowner ? 'Service Provided By' : 'Service Provided To'}</h3>
      <p>${serviceBy}</p>
      <span>${isHomeowner ? 'Porch Partner' : 'Homeowner'}</span>
    </div>
  </div>

  <table class="service-table">
    <thead>
      <tr>
        <th>Service</th>
        <th>Date</th>
        <th>Description</th>
        <th class="amount" style="text-align:right">Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Package Hold & Delivery</td>
        <td>${fmtDate(invoice.serviceDate)}</td>
        <td>${invoice.notes ?? 'Porch Partner hold service'}</td>
        <td class="amount" style="text-align:right">${fmt(invoice.grossAmountCents)}</td>
      </tr>
    </tbody>
  </table>

  <div class="totals">
    <div class="total-row">
      <span class="label">Subtotal</span>
      <span class="value">${fmt(invoice.grossAmountCents)}</span>
    </div>
    <div class="total-row">
      <span class="label">Porchivo Platform Fee (15%)</span>
      <span class="value">−${fmt(invoice.platformFeeCents)}</span>
    </div>
    <div class="total-row main">
      <span class="label">${amountLabel}</span>
      <span class="value">${amount}</span>
    </div>
    <div class="fee-note">${feeNote}</div>
  </div>

  ${invoice.stripeReferenceId ? `
  <div class="stripe-ref">
    <span>Stripe Reference:</span> ${invoice.stripeReferenceId}
  </div>` : ''}

  <div class="tax-note">
    <strong>📋 Tax Record Notice</strong>
    ${isHomeowner
      ? 'This invoice documents a deductible home service expense. Please retain for your personal tax records. Consult your tax advisor for eligibility.'
      : 'This invoice documents income earned as a Porch Partner. Income may be reportable on Schedule C or equivalent. Please retain for your tax records and consult a tax professional.'}
  </div>

  <div class="footer">
    <strong>Porchivo Inc.</strong> · porch-partner-service@porchivo.com<br />
    This is an official service record. Keep for your personal and tax records.
  </div>
</div>
</body>
</html>`;
}

/** Build HTML for a period summary report PDF. */
export function buildPeriodReportHTML(
  period: InvoicePeriod,
  invoices: TransactionInvoice[],
  userName: string,
): string {
  const isHomeowner = period.role === 'homeowner';
  const totalLabel = isHomeowner ? 'Total Spent' : 'Total Earned';
  const totalAmount = isHomeowner
    ? invoices.reduce((s, i) => s + i.grossAmountCents, 0)
    : invoices.reduce((s, i) => s + i.partnerEarnCents, 0);
  const totalFees = invoices.reduce((s, i) => s + i.platformFeeCents, 0);

  const rows = invoices
    .map(
      (inv) => `
    <tr>
      <td>${inv.invoiceNumber}</td>
      <td>${fmtDate(inv.serviceDate)}</td>
      <td>${isHomeowner ? inv.partnerName ?? '—' : inv.homeownerName ?? '—'}</td>
      <td style="text-align:right">${fmt(inv.grossAmountCents)}</td>
      <td style="text-align:right">${fmt(inv.platformFeeCents)}</td>
      <td style="text-align:right; font-weight:700; color:${isHomeowner ? '#E5484D' : '#1E9C6A'}">${fmt(isHomeowner ? inv.grossAmountCents : inv.partnerEarnCents)}</td>
    </tr>`,
    )
    .join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${period.periodLabel} Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; background:#fff; color:#1A2B4A; font-size:13px; line-height:1.6; }
    .page { max-width: 780px; margin: 0 auto; padding: 40px; }
    .header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #3A7BD5; padding-bottom:20px; margin-bottom:32px; }
        .logo-img { height: 28px; width: auto; display: inline-block; vertical-align: middle; }
    .report-title { font-size:22px; font-weight:800; color:#1A2B4A; margin-bottom:4px; }
    .report-sub { font-size:13px; color:#6B7F99; }
    .period-badge { background:#3A7BD5; color:#fff; border-radius:6px; padding:4px 14px; font-size:13px; font-weight:700; margin-top:8px; display:inline-block; }
    .summary-grid { display:grid; grid-template-columns:repeat(3, 1fr); gap:16px; margin-bottom:32px; }
    .summary-card { background:#F5F7FA; border-radius:10px; padding:16px 20px; }
    .summary-card .val { font-size:22px; font-weight:900; color:#1A2B4A; font-variant-numeric:tabular-nums; }
    .summary-card .lbl { font-size:11px; color:#6B7F99; text-transform:uppercase; letter-spacing:0.8px; margin-top:4px; }
    .summary-card.accent { background:#3A7BD5; }
    .summary-card.accent .val { color:#fff; }
    .summary-card.accent .lbl { color:rgba(255,255,255,0.7); }
    table { width:100%; border-collapse:collapse; margin-bottom:28px; }
    th { text-align:left; font-size:11px; font-weight:700; color:#6B7F99; text-transform:uppercase; letter-spacing:0.8px; padding:10px 10px; background:#F5F7FA; border-bottom:1px solid #D8E4F0; }
    td { padding:12px 10px; border-bottom:1px solid #EBF0F8; font-size:13px; }
    .total-row td { font-weight:800; background:#F5F7FA; }
    .tax-note { background:#FFF8E6; border:1px solid #F5D98A; border-radius:8px; padding:14px 18px; font-size:12px; color:#8A6800; margin-bottom:24px; }
    .tax-note strong { display:block; margin-bottom:4px; color:#6B4F00; font-size:13px; }
    .footer { text-align:center; font-size:11px; color:#9CA8BB; border-top:1px solid #EBF0F8; padding-top:18px; }
    .period-range { font-size:12px; color:#6B7F99; margin-top:6px; }
  </style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>
      <img class="logo-img" src="data:image/png;base64,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" alt="Porchivo" />
      <div style="font-size:12px;color:#6B7F99;margin-top:2px;">Porch Partner ${isHomeowner ? 'Expense' : 'Income'} Report</div>
    </div>
    <div style="text-align:right">
      <div class="report-title">${period.periodLabel}</div>
      <div class="report-sub">${isHomeowner ? 'Homeowner' : 'Porch Partner'} · ${userName}</div>
      <div class="period-range">${fmtDate(period.periodStart)} – ${fmtDate(period.periodEnd)}</div>
      <div class="period-badge">${period.periodType.charAt(0).toUpperCase() + period.periodType.slice(1)} Summary</div>
    </div>
  </div>

  <div class="summary-grid">
    <div class="summary-card accent">
      <div class="val">${fmt(totalAmount)}</div>
      <div class="lbl">${totalLabel}</div>
    </div>
    <div class="summary-card">
      <div class="val">${period.transactionCount}</div>
      <div class="lbl">Transactions</div>
    </div>
    <div class="summary-card">
      <div class="val">${fmt(totalFees)}</div>
      <div class="lbl">Platform Fees</div>
    </div>
  </div>

  ${invoices.length > 0 ? `
  <table>
    <thead>
      <tr>
        <th>Invoice #</th>
        <th>Date</th>
        <th>${isHomeowner ? 'Partner' : 'Homeowner'}</th>
        <th style="text-align:right">Gross</th>
        <th style="text-align:right">Fee</th>
        <th style="text-align:right">${isHomeowner ? 'Charged' : 'Earned'}</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
    <tfoot>
      <tr class="total-row">
        <td colspan="3">TOTALS</td>
        <td style="text-align:right">${fmt(invoices.reduce((s, i) => s + i.grossAmountCents, 0))}</td>
        <td style="text-align:right">${fmt(totalFees)}</td>
        <td style="text-align:right">${fmt(totalAmount)}</td>
      </tr>
    </tfoot>
  </table>` : '<p style="color:#6B7F99; padding: 20px 0">No transactions in this period.</p>'}

  <div class="tax-note">
    <strong>📋 Tax Record — ${period.periodLabel}</strong>
    ${isHomeowner
      ? `This report summarises your Porch Partner service expenses for ${period.periodLabel}. Total of ${fmt(totalAmount)} may be deductible as a home service expense. Please retain for your tax records and consult a qualified tax advisor.`
      : `This report summarises your Porch Partner income for ${period.periodLabel}. Total earnings of ${fmt(totalAmount)} (after ${fmt(totalFees)} in platform fees) may be reportable as self-employment income. Please retain for Schedule C or your country's equivalent and consult a tax professional.`}
  </div>

  <div class="footer">
    <strong>Porchivo Inc.</strong> · porch-partner-service@porchivo.com<br />
    Report generated ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} · Keep for personal and tax records
  </div>
</div>
</body>
</html>`;
}

// ─── Print / Share helpers ─────────────────────────────────────────────────────

/** Generate a PDF from HTML and share it, or open print dialog on iOS. */
export async function printOrSharePDF(html: string, filename: string): Promise<void> {
  try {
    const { uri } = await Print.printToFileAsync({ html, base64: false });

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Share ${filename}`,
        UTI: 'com.adobe.pdf',
      });
    } else {
      // Fallback: open print dialog
      await Print.printAsync({ uri });
    }
  } catch (e) {
    logError('[invoices] PDF generation error');
    throw e;
  }
}
