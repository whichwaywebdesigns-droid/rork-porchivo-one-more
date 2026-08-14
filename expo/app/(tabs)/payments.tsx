import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { CreditCard, Receipt, ArrowRight, CheckCircle, Clock } from 'lucide-react-native';
import { useColors } from '@/constants/colors';
import { useOrganization } from '@/store/OrganizationContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

/**
 * Payments tab — Community Tier only.
 * Shows HOA dues, assessments, payment history, and receipts.
 */
export default function PaymentsScreen() {
  const router = useRouter();
  const Colors = useColors();
  const { activeOrg, isOrgMember, isOrgStaff, refreshOrgContext } = useOrganization();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshOrgContext();
    setRefreshing(false);
  };

  // Fetch payment/assessment records for this org
  const paymentsQuery = useQuery({
    queryKey: ['org-payments', activeOrg?.id],
    queryFn: async () => {
      if (!activeOrg?.id) return [];
      const { data, error } = await supabase
        .from('org_payments')
        .select('*')
        .eq('org_id', activeOrg.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) return [];
      return data ?? [];
    },
    enabled: !!activeOrg?.id && isOrgMember,
    staleTime: 1000 * 60 * 2,
  });

  const payments = paymentsQuery.data ?? [];

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <Stack.Screen
        options={{
          title: 'Payments',
          headerStyle: { backgroundColor: Colors.surface },
          headerTintColor: Colors.slate,
          headerShadowVisible: false,
        }}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        {/* Balance card */}
        <View style={[styles.balanceCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
          <View style={styles.balanceHeader}>
            <View style={[styles.balanceIcon, { backgroundColor: Colors.primary + '18' }]}>
              <CreditCard size={22} color={Colors.primary} />
            </View>
            <View style={styles.balanceInfo}>
              <Text style={[styles.balanceLabel, { color: Colors.slateLighter }]}>
                {activeOrg?.name ?? 'Community'}
              </Text>
              <Text style={[styles.balanceAmount, { color: Colors.slate }]}>
                HOA Dues & Assessments
              </Text>
            </View>
          </View>
          <Text style={[styles.balanceHint, { color: Colors.slateLight }]}>
            Pay your HOA dues, special assessments, and view payment history.
          </Text>
        </View>

        {/* Quick actions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: Colors.slateLighter }]}>
            Quick Actions
          </Text>
          <TouchableOpacity
            style={[styles.actionRow, { backgroundColor: Colors.surface, borderColor: Colors.border }]}
            onPress={() => router.push('/invoices' as any)}
            activeOpacity={0.75}
          >
            <View style={[styles.actionIcon, { backgroundColor: Colors.success + '18' }]}>
              <Receipt size={18} color={Colors.success} />
            </View>
            <View style={styles.actionTextWrap}>
              <Text style={[styles.actionText, { color: Colors.slate }]}>View Invoices</Text>
              <Text style={[styles.actionSub, { color: Colors.slateLighter }]}>Payment history & receipts</Text>
            </View>
            <ArrowRight size={16} color={Colors.slateLighter} />
          </TouchableOpacity>
        </View>

        {/* Payment history */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: Colors.slateLighter }]}>
            Recent Payments
          </Text>
          {paymentsQuery.isLoading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginVertical: 16 }} />
          ) : payments.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
              <CheckCircle size={24} color={Colors.slateLighter} />
              <Text style={[styles.emptyText, { color: Colors.slateLight }]}>
                No payment history yet. Your HOA dues and payments will appear here.
              </Text>
            </View>
          ) : (
            payments.map((payment: any) => (
              <View
                key={payment.id}
                style={[styles.paymentRow, { backgroundColor: Colors.surface, borderColor: Colors.border }]}
              >
                <View style={[styles.paymentIcon, { backgroundColor: Colors.primary + '18' }]}>
                  <CreditCard size={16} color={Colors.primary} />
                </View>
                <View style={styles.paymentInfo}>
                  <Text style={[styles.paymentTitle, { color: Colors.slate }]} numberOfLines={1}>
                    {payment.description ?? 'HOA Dues'}
                  </Text>
                  <Text style={[styles.paymentDate, { color: Colors.slateLighter }]}>
                    {new Date(payment.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </Text>
                </View>
                <View style={styles.paymentRight}>
                  <Text style={[styles.paymentAmount, { color: Colors.slate }]}>
                    ${((payment.amount_cents ?? 0) / 100).toFixed(2)}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: (payment.status === 'paid' ? Colors.success : Colors.gold) + '22' }]}>
                    <Text style={[styles.statusText, { color: payment.status === 'paid' ? Colors.success : Colors.gold }]}>
                      {payment.status === 'paid' ? 'Paid' : 'Pending'}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  balanceCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginBottom: 20,
  },
  balanceHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    marginBottom: 12,
  },
  balanceIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceInfo: { flex: 1 },
  balanceLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    marginBottom: 2,
  },
  balanceAmount: {
    fontSize: 18,
    fontWeight: '700' as const,
  },
  balanceHint: {
    fontSize: 14,
    lineHeight: 20,
  },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  actionRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTextWrap: { flex: 1 },
  actionText: { fontSize: 15, fontWeight: '600' as const, marginBottom: 2 },
  actionSub: { fontSize: 13 },
  emptyCard: {
    alignItems: 'center',
    gap: 10,
    padding: 24,
    borderRadius: 14,
    borderWidth: 1,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  paymentRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  paymentIcon: {
    width: 36,
    height: 36,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentInfo: { flex: 1 },
  paymentTitle: { fontSize: 14, fontWeight: '600' as const, marginBottom: 2 },
  paymentDate: { fontSize: 12 },
  paymentRight: { alignItems: 'flex-end' as const },
  paymentAmount: { fontSize: 15, fontWeight: '700' as const, marginBottom: 4 },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700' as const,
  },
});
