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
import { Wrench, ChevronRight, Plus, Clock, CheckCircle, AlertCircle } from 'lucide-react-native';
import { useColors } from '@/constants/colors';
import { useOrganization } from '@/store/OrganizationContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

/**
 * Requests tab — Community Tier only.
 * Submit and track maintenance requests.
 */
export default function RequestsScreen() {
  const router = useRouter();
  const Colors = useColors();
  const { activeOrg, isOrgMember, isOrgStaff, refreshOrgContext } = useOrganization();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshOrgContext();
    setRefreshing(false);
  };

  // Fetch maintenance requests for this org
  const requestsQuery = useQuery({
    queryKey: ['org-maintenance-my', activeOrg?.id],
    queryFn: async () => {
      if (!activeOrg?.id) return [];
      const { data, error } = await supabase
        .from('maintenance_requests')
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

  const requests = requestsQuery.data ?? [];

  const statusIcon = (status: string) => {
    if (status === 'completed' || status === 'resolved') return <CheckCircle size={16} color={Colors.success} />;
    if (status === 'in_progress' || status === 'assigned') return <Clock size={16} color={Colors.gold} />;
    return <AlertCircle size={16} color={Colors.primary} />;
  };

  const statusLabel = (status: string): string => {
    switch (status) {
      case 'completed': return 'Completed';
      case 'resolved': return 'Resolved';
      case 'in_progress': return 'In Progress';
      case 'assigned': return 'Assigned';
      case 'pending': return 'Pending';
      default: return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <Stack.Screen
        options={{
          title: 'Requests',
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
        {/* New request button */}
        <TouchableOpacity
          style={[styles.newRequestBtn, { backgroundColor: Colors.primary }]}
          onPress={() => router.push('/submit-maintenance' as any)}
          activeOpacity={0.85}
        >
          <Plus size={20} color="#fff" />
          <Text style={styles.newRequestText}>Submit New Request</Text>
        </TouchableOpacity>

        {/* Staff: queue link */}
        {isOrgStaff && (
          <TouchableOpacity
            style={[styles.queueBtn, { backgroundColor: Colors.surface, borderColor: Colors.border }]}
            onPress={() => router.push('/maintenance-queue' as any)}
            activeOpacity={0.75}
          >
            <Wrench size={18} color={Colors.primary} />
            <Text style={[styles.queueBtnText, { color: Colors.slate }]}>Maintenance Queue (Staff)</Text>
            <ChevronRight size={16} color={Colors.slateLighter} />
          </TouchableOpacity>
        )}

        {/* Recent requests */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: Colors.slateLighter }]}>
            Recent Requests
          </Text>
          {requestsQuery.isLoading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginVertical: 16 }} />
          ) : requests.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
              <Wrench size={24} color={Colors.slateLighter} />
              <Text style={[styles.emptyText, { color: Colors.slateLight }]}>
                No maintenance requests yet. Submit a new request for plumbing, electrical, HVAC, or other issues.
              </Text>
            </View>
          ) : (
            requests.map((req: any) => (
              <TouchableOpacity
                key={req.id}
                style={[styles.requestRow, { backgroundColor: Colors.surface, borderColor: Colors.border }]}
                onPress={() => router.push('/submit-maintenance' as any)}
                activeOpacity={0.75}
              >
                <View style={[styles.requestIcon, { backgroundColor: Colors.primary + '18' }]}>
                  {statusIcon(req.status)}
                </View>
                <View style={styles.requestInfo}>
                  <Text style={[styles.requestTitle, { color: Colors.slate }]} numberOfLines={1}>
                    {req.title ?? 'Maintenance Request'}
                  </Text>
                  <Text style={[styles.requestMeta, { color: Colors.slateLighter }]}>
                    {statusLabel(req.status)} · {req.category ?? 'General'}
                  </Text>
                </View>
                <ChevronRight size={16} color={Colors.slateLighter} />
              </TouchableOpacity>
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
  newRequestBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    paddingVertical: 15,
    borderRadius: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  newRequestText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700' as const,
  },
  queueBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  queueBtnText: { flex: 1, fontSize: 15, fontWeight: '500' as const },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 10,
  },
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
  requestRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  requestIcon: {
    width: 36,
    height: 36,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestInfo: { flex: 1 },
  requestTitle: { fontSize: 14, fontWeight: '600' as const, marginBottom: 2 },
  requestMeta: { fontSize: 12 },
});
