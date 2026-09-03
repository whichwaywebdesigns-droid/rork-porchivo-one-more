/**
 * Payments Ledger — Community / Professional / Property Manager plans, staff only.
 * Lists every org payment (dues, assessments) with collected totals and a
 * one-tap CSV export (share sheet). Backed by `org_payments` + RLS; the
 * export is built client-side — no schema or edge function needed.
 */
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import {
  ChevronLeft,
  Receipt,
  Lock,
  Building2,
  Download,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useColors } from '@/constants/colors';
import { useOrganization } from '@/store/OrganizationContext';
import { supabase } from '@/lib/supabase';
import { warn } from '@/lib/logger';

interface OrgPayment {
  id: string;
  org_id: string;
  user_id: string | null;
  amount_cents: number;
  status: string;
  paid_at: string | null;
  created_at: string;
  member: { name: string | null } | null;
}

const STATUS_COLOR: Record<string, 'success' | 'gold' | 'danger'> = {
  paid: 'success',
  pending: 'gold',
  failed: 'danger',
  refunded: 'danger',
};

function fmtMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** CSV-escape a field: wrap in quotes, double any inner quotes. */
function csvField(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export default function OrgLedgerScreen() {
  const Colors = useColors();
  const insets = useSafeAreaInsets();
  const { activeOrg, isOrgStaff } = useOrganization();
  const [exporting, setExporting] = useState<boolean>(false);

  // Plan gate — dues collection + ledger exports start on the Community plan.
  const { data: planTier } = useQuery<string | null>({
    queryKey: ['org-plan-tier', activeOrg?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('organizations')
        .select('plan_tier')
        .eq('id', activeOrg!.id)
        .maybeSingle();
      return ((data as Record<string, unknown> | null)?.plan_tier as string) ?? null;
    },
    enabled: !!activeOrg?.id,
    staleTime: 1000 * 60 * 5,
  });
  const planAllowed = planTier === 'community' || planTier === 'professional' || planTier === 'enterprise';

  const ledgerQuery = useQuery<OrgPayment[]>({
    queryKey: ['org-ledger', activeOrg?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('org_payments')
        .select('*, member:profiles(name)')
        .eq('org_id', activeOrg!.id)
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) {
        warn('[OrgLedger] Fetch error:', error.code);
        return [];
      }
      return (data ?? []) as OrgPayment[];
    },
    enabled: !!activeOrg?.id && planAllowed && isOrgStaff,
  });

  const stats = useMemo(() => {
    const rows = ledgerQuery.data ?? [];
    const paid = rows.filter((r) => r.status === 'paid');
    const totalAll = paid.reduce((sum, r) => sum + r.amount_cents, 0);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const totalMonth = paid
      .filter((r) => (r.paid_at ? new Date(r.paid_at).getTime() : 0) >= monthStart)
      .reduce((sum, r) => sum + r.amount_cents, 0);
    return { totalAll, totalMonth, paidCount: paid.length };
  }, [ledgerQuery.data]);

  const exportCsv = async (): Promise<void> => {
    const rows = ledgerQuery.data ?? [];
    if (rows.length === 0) {
      Alert.alert('Nothing to export', 'The ledger is empty.');
      return;
    }
    try {
      setExporting(true);
      const lines = ['Date,Member,Amount,Status'];
      for (const r of rows) {
        lines.push(
          [
            csvField(r.paid_at ?? r.created_at),
            csvField(r.member?.name ?? 'Unknown'),
            csvField(fmtMoney(r.amount_cents)),
            csvField(r.status),
          ].join(','),
        );
      }
      const fileUri = `${FileSystem.cacheDirectory ?? ''}porchivo-ledger-${Date.now()}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, lines.join('\n'), {
        encoding: FileSystem.EncodingType.UTF8,
      });
      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        dialogTitle: 'Porchivo payments ledger',
      });
    } catch (e) {
      warn('[OrgLedger] Export failed:', e);
      Alert.alert('Export failed', 'Could not create the CSV file — try again.');
    } finally {
      setExporting(false);
    }
  };

  // ── Gate states ──────────────────────────────────────────────────────────
  if (!activeOrg) {
    return (
      <View style={[styles.root, { backgroundColor: Colors.background, paddingTop: insets.top + 8 }]}>
        <Header title="Payments Ledger" />
        <GateCard
          icon={<Receipt size={28} color={Colors.slateLighter} />}
          title="Join a community"
          body="The payments ledger tracks your HOA's dues and assessments. Ask your board for an invite to unlock it."
        />
      </View>
    );
  }

  if (!planAllowed) {
    return (
      <View style={[styles.root, { backgroundColor: Colors.background, paddingTop: insets.top + 8 }]}>
        <Header title="Payments Ledger" />
        <GateCard
          icon={<Receipt size={28} color={Colors.secondary} />}
          title="Community feature"
          body="The payments ledger is available on the Community plan and up. Upgrade your community's plan to unlock it."
        />
      </View>
    );
  }

  if (!isOrgStaff) {
    return (
      <View style={[styles.root, { backgroundColor: Colors.background, paddingTop: insets.top + 8 }]}>
        <Header title="Payments Ledger" />
        <GateCard
          icon={<Lock size={28} color={Colors.slateLighter} />}
          title="Staff only"
          body="The payments ledger is managed by your board and property staff. Your own payment history lives on the Payments tab."
        />
      </View>
    );
  }

  const rows = ledgerQuery.data ?? [];

  return (
    <View style={[styles.root, { backgroundColor: Colors.background, paddingTop: insets.top + 8 }]}>
      <Header title="Payments Ledger" />

      {/* Summary + export */}
      <View style={[styles.summary, { backgroundColor: Colors.primary + '10', borderColor: Colors.primary + '35' }]}>
        <View style={styles.statBlock}>
          <Text style={[styles.statValue, { color: Colors.slate }]}>{fmtMoney(stats.totalAll)}</Text>
          <Text style={[styles.statLabel, { color: Colors.slateLighter }]}>Collected all-time</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBlock}>
          <Text style={[styles.statValue, { color: Colors.slate }]}>{fmtMoney(stats.totalMonth)}</Text>
          <Text style={[styles.statLabel, { color: Colors.slateLighter }]}>This month</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBlock}>
          <Text style={[styles.statValue, { color: Colors.slate }]}>{stats.paidCount}</Text>
          <Text style={[styles.statLabel, { color: Colors.slateLighter }]}>Paid payments</Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.exportBtn, { backgroundColor: Colors.primary, opacity: exporting ? 0.6 : 1 }]}
        onPress={() => void exportCsv()}
        disabled={exporting || ledgerQuery.isLoading}
        activeOpacity={0.85}
      >
        {exporting ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <Download size={17} color="#fff" />
            <Text style={styles.exportBtnText}>Export CSV</Text>
          </>
        )}
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={ledgerQuery.isRefetching}
            onRefresh={() => void ledgerQuery.refetch()}
            tintColor={Colors.primary}
          />
        }
      >
        {ledgerQuery.isLoading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 24 }} />
        ) : rows.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
            <Receipt size={26} color={Colors.slateLighter} />
            <Text style={[styles.emptyTitle, { color: Colors.slate }]}>No payments yet</Text>
            <Text style={[styles.emptyBody, { color: Colors.slateLighter }]}>
              Dues and assessments will appear here as residents pay.
            </Text>
          </View>
        ) : (
          rows.map((r) => {
            const tone = STATUS_COLOR[r.status] ?? 'danger';
            const toneHex = tone === 'success' ? Colors.success : tone === 'gold' ? Colors.gold : Colors.danger;
            return (
              <View
                key={r.id}
                style={[styles.payCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}
              >
                <View style={styles.payBody}>
                  <Text style={[styles.payName, { color: Colors.slate }]} numberOfLines={1}>
                    {r.member?.name ?? 'Unknown resident'}
                  </Text>
                  <Text style={[styles.payMeta, { color: Colors.slateLighter }]}>
                    {fmtDate(r.paid_at ?? r.created_at)}
                  </Text>
                </View>
                <View style={styles.payRight}>
                  <Text style={[styles.payAmount, { color: Colors.slate }]}>{fmtMoney(r.amount_cents)}</Text>
                  <View style={[styles.statusPill, { backgroundColor: toneHex + '20' }]}>
                    <Text style={[styles.statusText, { color: toneHex }]}>{r.status}</Text>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

// ─── Shared bits ──────────────────────────────────────────────────────────────

function Header({ title }: { title: string }) {
  const Colors = useColors();
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <ChevronLeft size={26} color={Colors.slate} />
      </TouchableOpacity>
      <Text style={[styles.headerTitle, { color: Colors.slate }]}>{title}</Text>
    </View>
  );
}

function GateCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  const Colors = useColors();
  return (
    <View style={[styles.gateCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
      <View style={[styles.gateIcon, { backgroundColor: Colors.elevated }]}>{icon}</View>
      <Text style={[styles.gateTitle, { color: Colors.slate }]}>{title}</Text>
      <Text style={[styles.gateBody, { color: Colors.slateLighter }]}>{body}</Text>
      <TouchableOpacity
        style={[styles.gateBtn, { borderColor: Colors.border }]}
        onPress={() => router.back()}
        activeOpacity={0.8}
      >
        <Building2 size={16} color={Colors.slateLight} />
        <Text style={[styles.gateBtnText, { color: Colors.slateLight }]}>Back to Community</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.25)',
  },
  headerTitle: { fontSize: 19, fontWeight: '700' as const, letterSpacing: -0.3 },

  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 14,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  statBlock: { flex: 1, alignItems: 'center', gap: 2 },
  statDivider: { width: StyleSheet.hairlineWidth, height: 34, backgroundColor: 'rgba(128,128,128,0.3)' },
  statValue: { fontSize: 17, fontWeight: '800' as const },
  statLabel: { fontSize: 11 },

  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 13,
  },
  exportBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' as const },

  list: { padding: 16, paddingBottom: 40, gap: 10 },

  emptyCard: { alignItems: 'center', gap: 10, padding: 28, borderRadius: 16, borderWidth: 1, marginTop: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700' as const },
  emptyBody: { fontSize: 13, textAlign: 'center', lineHeight: 19 },

  payCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  payBody: { flex: 1, gap: 2 },
  payName: { fontSize: 15, fontWeight: '700' as const },
  payMeta: { fontSize: 12 },
  payRight: { alignItems: 'flex-end', gap: 4 },
  payAmount: { fontSize: 15, fontWeight: '800' as const },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusText: { fontSize: 11, fontWeight: '700' as const, textTransform: 'capitalize' },

  gateCard: { marginTop: 40, marginHorizontal: 24, borderRadius: 18, borderWidth: 1, padding: 28, alignItems: 'center' },
  gateIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  gateTitle: { fontSize: 18, fontWeight: '800' as const, marginBottom: 8 },
  gateBody: { fontSize: 13.5, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  gateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  gateBtnText: { fontSize: 13, fontWeight: '600' as const },
});
