import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Animated,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import {
  FileText,
  Download,
  Calendar,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Receipt,
  DollarSign,
  BarChart3,
  Clock,
  CheckCircle,
  RefreshCw,
  Wallet,
  Home,
  HandHeart,
  Filter,
} from 'lucide-react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { palette, tabularNums, type as typeScale, space, radius, elevation } from '@/constants/theme';
import { useApp } from '@/store/AppContext';
import {
  fetchMyInvoices,
  fetchMyPeriods,
  fetchInvoicesForPeriod,
  compilePeriod,
  buildInvoiceHTML,
  buildPeriodReportHTML,
  printOrSharePDF,
  fmt,
  fmtDate,
} from '@/lib/invoices';
import { TransactionInvoice, InvoicePeriod, InvoicePeriodType, InvoiceRole } from '@/types';
import { isEnabled } from '@/lib/featureFlags';

const showPorchPartners = isEnabled('PORCH_PARTNERS');

// ─── Period helpers ────────────────────────────────────────────────────────────

function getCurrentMonthRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

function getCurrentQuarterRange(): { start: string; end: string } {
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3);
  const start = new Date(now.getFullYear(), q * 3, 1);
  const end = new Date(now.getFullYear(), q * 3 + 3, 0);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

function getCurrentYearRange(): { start: string; end: string } {
  const now = new Date();
  return {
    start: `${now.getFullYear()}-01-01`,
    end: `${now.getFullYear()}-12-31`,
  };
}

function formatServiceDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

type TabKey = 'transactions' | 'monthly' | 'quarterly' | 'annual';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'transactions', label: 'Transactions' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'quarterly', label: 'Quarterly' },
  { key: 'annual', label: 'Annual' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function InvoicesScreen() {
  const router = useRouter();
  const { user } = useApp();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<TabKey>('transactions');
  const [activeRole, setActiveRole] = useState<InvoiceRole>('homeowner');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [compilingPeriod, setCompilingPeriod] = useState<InvoicePeriodType | null>(null);

  // ─── Queries ───────────────────────────────────────────────────────────────

  const {
    data: invoices = [],
    isLoading: loadingInvoices,
    refetch: refetchInvoices,
    isRefetching: refreshingInvoices,
  } = useQuery({
    queryKey: ['invoices', activeRole],
    queryFn: () => fetchMyInvoices(activeRole),
  });

  const {
    data: monthlyPeriods = [],
    isLoading: loadingMonthly,
    refetch: refetchMonthly,
    isRefetching: refreshingMonthly,
  } = useQuery({
    queryKey: ['invoice-periods', activeRole, 'monthly'],
    queryFn: () => fetchMyPeriods(activeRole, 'monthly'),
    enabled: activeTab === 'monthly',
  });

  const {
    data: quarterlyPeriods = [],
    isLoading: loadingQuarterly,
    refetch: refetchQuarterly,
    isRefetching: refreshingQuarterly,
  } = useQuery({
    queryKey: ['invoice-periods', activeRole, 'quarterly'],
    queryFn: () => fetchMyPeriods(activeRole, 'quarterly'),
    enabled: activeTab === 'quarterly',
  });

  const {
    data: annualPeriods = [],
    isLoading: loadingAnnual,
    refetch: refetchAnnual,
    isRefetching: refreshingAnnual,
  } = useQuery({
    queryKey: ['invoice-periods', activeRole, 'annual'],
    queryFn: () => fetchMyPeriods(activeRole, 'annual'),
    enabled: activeTab === 'annual',
  });

  // ─── Computed totals ───────────────────────────────────────────────────────

  const ytdTotal = useMemo(() => {
    const year = new Date().getFullYear().toString();
    const yearInvoices = invoices.filter((i) => i.serviceDate.startsWith(year));
    return activeRole === 'homeowner'
      ? yearInvoices.reduce((s, i) => s + i.grossAmountCents, 0)
      : yearInvoices.reduce((s, i) => s + i.partnerEarnCents, 0);
  }, [invoices, activeRole]);

  const mtdTotal = useMemo(() => {
    const now = new Date();
    const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const mtdInvoices = invoices.filter((i) => i.serviceDate.startsWith(prefix));
    return activeRole === 'homeowner'
      ? mtdInvoices.reduce((s, i) => s + i.grossAmountCents, 0)
      : mtdInvoices.reduce((s, i) => s + i.partnerEarnCents, 0);
  }, [invoices, activeRole]);

  // ─── Refresh ───────────────────────────────────────────────────────────────

  const onRefresh = useCallback(() => {
    refetchInvoices();
    if (activeTab === 'monthly') refetchMonthly();
    if (activeTab === 'quarterly') refetchQuarterly();
    if (activeTab === 'annual') refetchAnnual();
  }, [activeTab, refetchInvoices, refetchMonthly, refetchQuarterly, refetchAnnual]);

  const isRefreshing = refreshingInvoices || refreshingMonthly || refreshingQuarterly || refreshingAnnual;

  // ─── PDF Download: single invoice ─────────────────────────────────────────

  const handleDownloadInvoice = useCallback(async (invoice: TransactionInvoice) => {
    setDownloadingId(invoice.id);
    try {
      const html = buildInvoiceHTML(invoice, activeRole);
      await printOrSharePDF(html, invoice.invoiceNumber);
    } catch {
      Alert.alert('PDF Error', 'Could not generate the PDF. Please try again.');
    } finally {
      setDownloadingId(null);
    }
  }, [activeRole]);

  // ─── PDF Download: period report ──────────────────────────────────────────

  const handleDownloadPeriod = useCallback(async (period: InvoicePeriod) => {
    setDownloadingId(period.id);
    try {
      const periodInvoices = await fetchInvoicesForPeriod(activeRole, period.periodStart, period.periodEnd);
      const userName = user?.name ?? 'User';
      const html = buildPeriodReportHTML(period, periodInvoices, userName);
      await printOrSharePDF(html, `Porchivo-${period.periodLabel.replace(/\s/g, '-')}-${activeRole}`);
    } catch {
      Alert.alert('PDF Error', 'Could not generate the report. Please try again.');
    } finally {
      setDownloadingId(null);
    }
  }, [activeRole, user]);

  // ─── Compile current period ────────────────────────────────────────────────

  const handleCompilePeriod = useCallback(async (periodType: InvoicePeriodType) => {
    setCompilingPeriod(periodType);
    try {
      let range: { start: string; end: string };
      if (periodType === 'monthly') range = getCurrentMonthRange();
      else if (periodType === 'quarterly') range = getCurrentQuarterRange();
      else range = getCurrentYearRange();

      const result = await compilePeriod({
        role: activeRole,
        periodType,
        periodStart: range.start,
        periodEnd: range.end,
      });

      if (result) {
        await queryClient.invalidateQueries({ queryKey: ['invoice-periods', activeRole, periodType] });
        Alert.alert('Report Ready', `Your ${periodType} summary has been compiled.`);
      } else {
        Alert.alert('Compile Error', 'Could not compile the period. Try again later.');
      }
    } finally {
      setCompilingPeriod(null);
    }
  }, [activeRole, queryClient]);

  // ─── Loading state ─────────────────────────────────────────────────────────

  const isLoading =
    (activeTab === 'transactions' && loadingInvoices) ||
    (activeTab === 'monthly' && loadingMonthly) ||
    (activeTab === 'quarterly' && loadingQuarterly) ||
    (activeTab === 'annual' && loadingAnnual);

  const activePeriods =
    activeTab === 'monthly' ? monthlyPeriods :
    activeTab === 'quarterly' ? quarterlyPeriods :
    activeTab === 'annual' ? annualPeriods : [];

  const periodType: InvoicePeriodType | null =
    activeTab === 'monthly' ? 'monthly' :
    activeTab === 'quarterly' ? 'quarterly' :
    activeTab === 'annual' ? 'annual' : null;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Invoices & Tax Records',
          headerStyle: { backgroundColor: palette.railBg },
          headerTitleStyle: { color: palette.railText, fontWeight: '700' as const },
          headerTintColor: palette.railText,
          headerBackTitle: 'Back',
        }}
      />

      <View style={styles.root}>
        {/* Role Toggle */}
        {showPorchPartners && (
        <View style={styles.roleRow}>
          <TouchableOpacity
            style={[styles.roleBtn, activeRole === 'homeowner' && styles.roleBtnActive]}
            onPress={() => setActiveRole('homeowner')}
          >
            <Home size={14} color={activeRole === 'homeowner' ? palette.onAccent : palette.textSecondary} />
            <Text style={[styles.roleBtnText, activeRole === 'homeowner' && styles.roleBtnTextActive]}>
              Homeowner
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.roleBtn, activeRole === 'partner' && styles.roleBtnActive]}
            onPress={() => setActiveRole('partner')}
          >
            <HandHeart size={14} color={activeRole === 'partner' ? palette.onAccent : palette.textSecondary} />
            <Text style={[styles.roleBtnText, activeRole === 'partner' && styles.roleBtnTextActive]}>
              Porch Partner
            </Text>
          </TouchableOpacity>
        </View>
        )}

        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, styles.summaryCardAccent]}>
            <Text style={styles.summaryCardLabel}>
              {activeRole === 'homeowner' ? 'YTD Spent' : 'YTD Earned'}
            </Text>
            <Text style={[styles.summaryCardValue, tabularNums]}>
              {fmt(ytdTotal)}
            </Text>
            <Text style={styles.summaryCardSub}>Year to date</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryCardLabel}>
              {activeRole === 'homeowner' ? 'This Month' : 'This Month'}
            </Text>
            <Text style={[styles.summaryCardValue, styles.summaryCardValueDark, tabularNums]}>
              {fmt(mtdTotal)}
            </Text>
            <Text style={styles.summaryCardSub}>{invoices.filter((i) => {
              const now = new Date();
              return i.serviceDate.startsWith(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
            }).length} transactions</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryCardLabel}>Total Records</Text>
            <Text style={[styles.summaryCardValue, styles.summaryCardValueDark, tabularNums]}>
              {invoices.length}
            </Text>
            <Text style={styles.summaryCardSub}>All time</Text>
          </View>
        </View>

        {/* Tab Bar */}
        <View style={styles.tabBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBarInner}>
            {TABS.map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tabItem, activeTab === tab.key && styles.tabItemActive]}
                onPress={() => setActiveTab(tab.key)}
              >
                <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Content */}
        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={styles.scrollContentInner}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={palette.accent} />}
          showsVerticalScrollIndicator={false}
        >
          {isLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={palette.accent} />
              <Text style={styles.loadingText}>Loading records…</Text>
            </View>
          ) : activeTab === 'transactions' ? (
            <TransactionsList
              invoices={invoices}
              activeRole={activeRole}
              downloadingId={downloadingId}
              onDownload={handleDownloadInvoice}
            />
          ) : (
            <PeriodList
              periods={activePeriods}
              periodType={periodType!}
              activeRole={activeRole}
              downloadingId={downloadingId}
              compilingPeriod={compilingPeriod}
              onDownload={handleDownloadPeriod}
              onCompile={handleCompilePeriod}
            />
          )}
        </ScrollView>
      </View>
    </>
  );
}

// ─── Transactions List ────────────────────────────────────────────────────────

function TransactionsList({
  invoices,
  activeRole,
  downloadingId,
  onDownload,
}: {
  invoices: TransactionInvoice[];
  activeRole: InvoiceRole;
  downloadingId: string | null;
  onDownload: (inv: TransactionInvoice) => void;
}) {
  if (invoices.length === 0) {
    return <EmptyState icon={Receipt} message="No invoices yet" sub="Completed Porch Partner assignments will appear here automatically." />;
  }

  return (
    <>
      <View style={styles.sectionHeader}>
        <Receipt size={14} color={palette.textMuted} />
        <Text style={styles.sectionTitle}>{invoices.length} TRANSACTION{invoices.length !== 1 ? 'S' : ''}</Text>
      </View>
      <View style={styles.taxBanner}>
        <Text style={styles.taxBannerTitle}>📋 Tax Record</Text>
        <Text style={styles.taxBannerText}>
          {activeRole === 'homeowner'
            ? 'Download individual invoices for your home service expense records. Consult your tax advisor for deductibility.'
            : 'Download invoices documenting your Porch Partner income. May be reportable as self-employment income.'}
        </Text>
      </View>
      {invoices.map((inv) => (
        <InvoiceRow
          key={inv.id}
          invoice={inv}
          activeRole={activeRole}
          isDownloading={downloadingId === inv.id}
          onDownload={() => onDownload(inv)}
        />
      ))}
    </>
  );
}

// ─── Invoice Row ──────────────────────────────────────────────────────────────

function InvoiceRow({
  invoice,
  activeRole,
  isDownloading,
  onDownload,
}: {
  invoice: TransactionInvoice;
  activeRole: InvoiceRole;
  isDownloading: boolean;
  onDownload: () => void;
}) {
  const amount = activeRole === 'homeowner' ? invoice.grossAmountCents : invoice.partnerEarnCents;
  const isHomeowner = activeRole === 'homeowner';

  return (
    <View style={styles.invoiceRow}>
      <View style={[styles.invoiceIconBox, isHomeowner ? styles.iconBoxRed : styles.iconBoxGreen]}>
        {isHomeowner ? (
          <TrendingDown size={16} color={palette.danger} />
        ) : (
          <TrendingUp size={16} color={palette.successGreen} />
        )}
      </View>
      <View style={styles.invoiceInfo}>
        <Text style={styles.invoiceNumber}>{invoice.invoiceNumber}</Text>
        <Text style={styles.invoiceMeta}>
          {isHomeowner ? invoice.partnerName ?? 'Porch Partner' : invoice.homeownerName ?? 'Homeowner'}
        </Text>
        <Text style={styles.invoiceDate}>{formatServiceDate(invoice.serviceDate)}</Text>
      </View>
      <View style={styles.invoiceRight}>
        <Text style={[styles.invoiceAmount, tabularNums, isHomeowner ? styles.amountRed : styles.amountGreen]}>
          {isHomeowner ? '−' : '+'}{fmt(amount)}
        </Text>
        <Text style={styles.invoiceFee}>Fee: {fmt(invoice.platformFeeCents)}</Text>
        <TouchableOpacity
          style={[styles.downloadBtn, isDownloading && styles.downloadBtnDisabled]}
          onPress={onDownload}
          disabled={isDownloading}
        >
          {isDownloading ? (
            <ActivityIndicator size="small" color={palette.accent} />
          ) : (
            <>
              <Download size={12} color={palette.accent} />
              <Text style={styles.downloadBtnText}>PDF</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Period List ──────────────────────────────────────────────────────────────

function PeriodList({
  periods,
  periodType,
  activeRole,
  downloadingId,
  compilingPeriod,
  onDownload,
  onCompile,
}: {
  periods: InvoicePeriod[];
  periodType: InvoicePeriodType;
  activeRole: InvoiceRole;
  downloadingId: string | null;
  compilingPeriod: InvoicePeriodType | null;
  onDownload: (p: InvoicePeriod) => void;
  onCompile: (type: InvoicePeriodType) => void;
}) {
  const typeLabel = periodType === 'monthly' ? 'Monthly' : periodType === 'quarterly' ? 'Quarterly' : 'Annual';
  const isCompiling = compilingPeriod === periodType;

  return (
    <>
      {/* Compile current period button */}
      <View style={styles.compileCard}>
        <View style={styles.compileCardLeft}>
          <BarChart3 size={20} color={palette.accent} />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={styles.compileCardTitle}>Compile Current {typeLabel}</Text>
            <Text style={styles.compileCardSub}>
              Aggregate transactions and generate a{' '}
              {activeRole === 'homeowner' ? 'tax expense' : 'income'} summary
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.compileBtn, isCompiling && styles.compileBtnDisabled]}
          onPress={() => onCompile(periodType)}
          disabled={isCompiling}
        >
          {isCompiling ? (
            <ActivityIndicator size="small" color={palette.onAccent} />
          ) : (
            <Text style={styles.compileBtnText}>Compile</Text>
          )}
        </TouchableOpacity>
      </View>

      {periods.length === 0 ? (
        <EmptyState
          icon={Calendar}
          message={`No ${typeLabel.toLowerCase()} reports yet`}
          sub={`Tap "Compile" above to generate your first ${typeLabel.toLowerCase()} summary.`}
        />
      ) : (
        <>
          <View style={styles.sectionHeader}>
            <FileText size={14} color={palette.textMuted} />
            <Text style={styles.sectionTitle}>{periods.length} {typeLabel.toUpperCase()} REPORT{periods.length !== 1 ? 'S' : ''}</Text>
          </View>
          {periods.map((period) => (
            <PeriodRow
              key={period.id}
              period={period}
              activeRole={activeRole}
              isDownloading={downloadingId === period.id}
              onDownload={() => onDownload(period)}
            />
          ))}
        </>
      )}
    </>
  );
}

// ─── Period Row ───────────────────────────────────────────────────────────────

function PeriodRow({
  period,
  activeRole,
  isDownloading,
  onDownload,
}: {
  period: InvoicePeriod;
  activeRole: InvoiceRole;
  isDownloading: boolean;
  onDownload: () => void;
}) {
  const isHomeowner = activeRole === 'homeowner';
  const typeColors: Record<InvoicePeriodType, string> = {
    monthly: palette.accent,
    quarterly: palette.warmOrange,
    annual: palette.gold,
  };
  const badgeColor = typeColors[period.periodType];

  return (
    <View style={styles.periodRow}>
      <View style={styles.periodLeft}>
        <View style={[styles.periodBadge, { backgroundColor: badgeColor + '20' }]}>
          <Text style={[styles.periodBadgeText, { color: badgeColor }]}>
            {period.periodType === 'monthly' ? 'MO' : period.periodType === 'quarterly' ? 'QTR' : 'YR'}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.periodLabel}>{period.periodLabel}</Text>
          <Text style={styles.periodRange}>
            {formatServiceDate(period.periodStart)} – {formatServiceDate(period.periodEnd)}
          </Text>
          <View style={styles.periodStats}>
            <Text style={styles.periodStatText}>
              {period.transactionCount} txn{period.transactionCount !== 1 ? 's' : ''}
            </Text>
            <Text style={styles.periodStatDot}>·</Text>
            <Text style={styles.periodStatText}>
              Fee: {fmt(period.platformFeeTotalCents)}
            </Text>
            {period.notificationSentAt && (
              <>
                <Text style={styles.periodStatDot}>·</Text>
                <CheckCircle size={11} color={palette.successGreen} />
                <Text style={[styles.periodStatText, { color: palette.successGreen }]}> Notified</Text>
              </>
            )}
          </View>
        </View>
      </View>
      <View style={styles.periodRight}>
        <Text style={[styles.periodTotal, tabularNums, isHomeowner ? styles.amountRed : styles.amountGreen]}>
          {fmt(period.totalCents)}
        </Text>
        <Text style={styles.periodTotalLabel}>{isHomeowner ? 'spent' : 'earned'}</Text>
        <TouchableOpacity
          style={[styles.downloadBtn, isDownloading && styles.downloadBtnDisabled]}
          onPress={onDownload}
          disabled={isDownloading}
        >
          {isDownloading ? (
            <ActivityIndicator size="small" color={palette.accent} />
          ) : (
            <>
              <Download size={12} color={palette.accent} />
              <Text style={styles.downloadBtnText}>PDF</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({
  icon: Icon,
  message,
  sub,
}: {
  icon: React.ComponentType<{ size: number; color: string }>;
  message: string;
  sub: string;
}) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconBox}>
        <Icon size={32} color={palette.textMuted} />
      </View>
      <Text style={styles.emptyTitle}>{message}</Text>
      <Text style={styles.emptySub}>{sub}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.bg,
  },

  // Role toggle
  roleRow: {
    flexDirection: 'row',
    margin: space.lg,
    marginBottom: 0,
    backgroundColor: palette.bgElevated,
    borderRadius: radius.pill,
    padding: 4,
  },
  roleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  roleBtnActive: {
    backgroundColor: palette.accent,
    ...elevation.glow,
  },
  roleBtnText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: palette.textSecondary,
  },
  roleBtnTextActive: {
    color: palette.onAccent,
  },

  // Summary cards
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: palette.bgSurface,
    borderRadius: radius.lg,
    padding: 12,
    ...elevation.low,
    borderWidth: 1,
    borderColor: palette.borderDark,
  },
  summaryCardAccent: {
    backgroundColor: palette.accent,
    borderColor: palette.accentDim,
  },
  summaryCardLabel: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: 'rgba(255,255,255,0.75)',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  summaryCardValue: {
    fontSize: 18,
    fontWeight: '900' as const,
    color: palette.onAccent,
    letterSpacing: -0.5,
  },
  summaryCardValueDark: {
    color: palette.textPrimary,
  },
  summaryCardSub: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },

  // Tab bar
  tabBar: {
    borderBottomWidth: 1,
    borderBottomColor: palette.borderDark,
    backgroundColor: palette.bgSurface,
  },
  tabBarInner: {
    paddingHorizontal: space.lg,
    gap: 4,
  },
  tabItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: palette.accent,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: palette.textMuted,
  },
  tabTextActive: {
    fontWeight: '700' as const,
    color: palette.accent,
  },

  // Scroll area
  scrollContent: {
    flex: 1,
  },
  scrollContentInner: {
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: 40,
    gap: 10,
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: palette.textMuted,
    letterSpacing: 1,
  },

  // Tax banner
  taxBanner: {
    backgroundColor: '#FFF8E6',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#F5D98A',
    padding: 12,
    marginBottom: 4,
  },
  taxBannerTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#6B4F00',
    marginBottom: 4,
  },
  taxBannerText: {
    fontSize: 12,
    color: '#8A6800',
    lineHeight: 18,
  },

  // Invoice row
  invoiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.bgSurface,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: palette.borderDark,
    gap: 12,
    ...elevation.low,
  },
  invoiceIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxRed: {
    backgroundColor: palette.roseSoft,
  },
  iconBoxGreen: {
    backgroundColor: palette.sageSoft,
  },
  invoiceInfo: {
    flex: 1,
  },
  invoiceNumber: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: palette.textPrimary,
    letterSpacing: -0.2,
  },
  invoiceMeta: {
    fontSize: 12,
    color: palette.textSecondary,
    marginTop: 1,
  },
  invoiceDate: {
    fontSize: 11,
    color: palette.textMuted,
    marginTop: 1,
  },
  invoiceRight: {
    alignItems: 'flex-end',
    gap: 3,
  },
  invoiceAmount: {
    fontSize: 15,
    fontWeight: '800' as const,
    letterSpacing: -0.4,
  },
  invoiceFee: {
    fontSize: 10,
    color: palette.textMuted,
  },
  amountRed: {
    color: palette.danger,
  },
  amountGreen: {
    color: palette.successGreen,
  },

  // Download button
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: palette.accentGlow,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 2,
    minWidth: 52,
    justifyContent: 'center',
  },
  downloadBtnDisabled: {
    opacity: 0.5,
  },
  downloadBtnText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: palette.accent,
  },

  // Compile card
  compileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.bgSurface,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.accentGlow,
    gap: 12,
    ...elevation.low,
  },
  compileCardLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  compileCardTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: palette.textPrimary,
  },
  compileCardSub: {
    fontSize: 12,
    color: palette.textMuted,
    marginTop: 2,
    lineHeight: 16,
  },
  compileBtn: {
    backgroundColor: palette.accent,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minWidth: 80,
    alignItems: 'center',
  },
  compileBtnDisabled: {
    opacity: 0.6,
  },
  compileBtnText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: palette.onAccent,
  },

  // Period row
  periodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.bgSurface,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: palette.borderDark,
    gap: 12,
    ...elevation.low,
  },
  periodLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  periodBadge: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodBadgeText: {
    fontSize: 11,
    fontWeight: '900' as const,
    letterSpacing: 0.5,
  },
  periodLabel: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: palette.textPrimary,
  },
  periodRange: {
    fontSize: 11,
    color: palette.textMuted,
    marginTop: 2,
  },
  periodStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    flexWrap: 'wrap' as const,
  },
  periodStatText: {
    fontSize: 11,
    color: palette.textMuted,
  },
  periodStatDot: {
    fontSize: 11,
    color: palette.textMuted,
  },
  periodRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  periodTotal: {
    fontSize: 17,
    fontWeight: '900' as const,
    letterSpacing: -0.5,
  },
  periodTotalLabel: {
    fontSize: 10,
    color: palette.textMuted,
    textTransform: 'lowercase' as const,
  },

  // Loading
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: palette.textMuted,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyIconBox: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: palette.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: palette.textPrimary,
    textAlign: 'center' as const,
  },
  emptySub: {
    fontSize: 14,
    color: palette.textMuted,
    textAlign: 'center' as const,
    lineHeight: 20,
  },
});
