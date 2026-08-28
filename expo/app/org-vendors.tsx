/**
 * Vendor Directory — org-scoped vendor list (Professional / Property Manager).
 * Staff can add vendors (trade, contact, phone, email, notes); the creator or
 * a full admin can remove them. Backed by `org_vendors` + RLS.
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Platform,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import {
  ChevronLeft,
  Truck,
  Plus,
  Trash2,
  Phone,
  Mail,
  Building2,
  Lock,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useColors } from '@/constants/colors';
import { useOrganization } from '@/store/OrganizationContext';
import { useApp } from '@/store/AppContext';
import { supabase } from '@/lib/supabase';
import { warn } from '@/lib/logger';

const CATEGORIES = [
  { key: 'general', label: 'General', emoji: '🔧' },
  { key: 'plumbing', label: 'Plumbing', emoji: '🚰' },
  { key: 'electrical', label: 'Electrical', emoji: '⚡' },
  { key: 'hvac', label: 'HVAC', emoji: '❄️' },
  { key: 'landscaping', label: 'Landscaping', emoji: '🌿' },
  { key: 'cleaning', label: 'Cleaning', emoji: '🧹' },
  { key: 'security', label: 'Security', emoji: '🛡️' },
  { key: 'pool', label: 'Pool', emoji: '🏊' },
  { key: 'pest', label: 'Pest', emoji: '🐜' },
  { key: 'roofing', label: 'Roofing', emoji: '🏠' },
  { key: 'other', label: 'Other', emoji: '📦' },
] as const;

const CATEGORY_EMOJI: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c.emoji]),
);

interface OrgVendor {
  id: string;
  org_id: string;
  name: string;
  category: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  is_active: boolean;
}

export default function OrgVendorsScreen() {
  const Colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { activeOrg, isOrgStaff } = useOrganization();
  const { session } = useApp();
  const userId = session?.user?.id ?? null;

  const [addOpen, setAddOpen] = useState<boolean>(false);
  const [name, setName] = useState<string>('');
  const [category, setCategory] = useState<string>('general');
  const [contactName, setContactName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Plan gate — vendor directory is a multi-community plan feature.
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
  const planAllowed = planTier === 'professional' || planTier === 'enterprise';

  const vendorsQuery = useQuery<OrgVendor[]>({
    queryKey: ['org-vendors', activeOrg?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('org_vendors')
        .select('*')
        .eq('org_id', activeOrg!.id)
        .order('is_active', { ascending: false })
        .order('name', { ascending: true });
      if (error) {
        warn('[OrgVendors] Fetch error:', error.code);
        return [];
      }
      return (data ?? []) as OrgVendor[];
    },
    enabled: !!activeOrg?.id && planAllowed && isOrgStaff,
  });

  const resetForm = useCallback(() => {
    setName('');
    setCategory('general');
    setContactName('');
    setPhone('');
    setEmail('');
    setNotes('');
  }, []);

  const addVendor = useMutation({
    mutationFn: async () => {
      if (!activeOrg?.id || !userId) throw new Error('Not ready');
      const { error } = await supabase.from('org_vendors').insert({
        org_id: activeOrg.id,
        name: name.trim(),
        category,
        contact_name: contactName.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        notes: notes.trim() || null,
        created_by: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['org-vendors', activeOrg?.id] });
      setAddOpen(false);
      resetForm();
    },
    onError: (e: Error) => {
      Alert.alert('Could not add vendor', e.message);
    },
  });

  const removeVendor = useMutation({
    mutationFn: async (vendorId: string) => {
      const { error } = await supabase.from('org_vendors').delete().eq('id', vendorId);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['org-vendors', activeOrg?.id] });
    },
    onError: (e: Error) => {
      Alert.alert('Could not remove vendor', e.message);
    },
  });

  const confirmRemove = useCallback(
    (vendor: OrgVendor) => {
      Alert.alert('Remove vendor', `Remove ${vendor.name} from the directory?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => removeVendor.mutate(vendor.id) },
      ]);
    },
    [removeVendor],
  );

  // ── Gate states ──────────────────────────────────────────────────────────
  if (!isOrgStaff) {
    return (
      <View style={[styles.root, { backgroundColor: Colors.background, paddingTop: insets.top + 8 }]}>
        <Header title="Vendor Directory" />
        <GateCard
          icon={<Lock size={28} color={Colors.slateLighter} />}
          title="Staff only"
          body="The vendor directory is managed by your board and property staff."
        />
      </View>
    );
  }

  if (!planAllowed) {
    return (
      <View style={[styles.root, { backgroundColor: Colors.background, paddingTop: insets.top + 8 }]}>
        <Header title="Vendor Directory" />
        <GateCard
          icon={<Truck size={28} color={Colors.secondary} />}
          title="Professional feature"
          body="Vendor management is available on the Professional and Property Manager plans. Upgrade your community's plan to unlock it."
        />
      </View>
    );
  }

  const vendors = vendorsQuery.data ?? [];

  return (
    <View style={[styles.root, { backgroundColor: Colors.background, paddingTop: insets.top + 8 }]}>
      <Header title="Vendor Directory" />

      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={vendorsQuery.isRefetching}
            onRefresh={() => void vendorsQuery.refetch()}
            tintColor={Colors.primary}
          />
        }
      >
        {vendorsQuery.isLoading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 32 }} />
        ) : vendors.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
            <Truck size={26} color={Colors.slateLighter} />
            <Text style={[styles.emptyTitle, { color: Colors.slate }]}>No vendors yet</Text>
            <Text style={[styles.emptyBody, { color: Colors.slateLighter }]}>
              Add the plumbers, landscapers, and contractors your community relies on.
            </Text>
          </View>
        ) : (
          vendors.map((v) => (
            <View key={v.id} style={[styles.vendorCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
              <View style={[styles.vendorIcon, { backgroundColor: Colors.secondary + '18' }]}>
                <Text style={{ fontSize: 20 }}>{CATEGORY_EMOJI[v.category] ?? '🔧'}</Text>
              </View>
              <View style={styles.vendorBody}>
                <Text style={[styles.vendorName, { color: Colors.slate }]}>{v.name}</Text>
                {v.contact_name ? (
                  <Text style={[styles.vendorMeta, { color: Colors.slateLighter }]}>{v.contact_name}</Text>
                ) : null}
                {v.phone ? (
                  <View style={styles.metaRow}>
                    <Phone size={11} color={Colors.slateLighter} />
                    <Text style={[styles.vendorMeta, { color: Colors.slateLighter }]}>{v.phone}</Text>
                  </View>
                ) : null}
                {v.email ? (
                  <View style={styles.metaRow}>
                    <Mail size={11} color={Colors.slateLighter} />
                    <Text style={[styles.vendorMeta, { color: Colors.slateLighter }]} numberOfLines={1}>
                      {v.email}
                    </Text>
                  </View>
                ) : null}
              </View>
              <TouchableOpacity
                onPress={() => confirmRemove(v)}
                style={styles.trashBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                disabled={removeVendor.isPending}
              >
                <Trash2 size={17} color={Colors.danger} />
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      {/* Add vendor FAB */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: Colors.primary, bottom: insets.bottom + 20 }]}
        onPress={() => setAddOpen(true)}
        activeOpacity={0.85}
      >
        <Plus size={24} color="#fff" />
      </TouchableOpacity>

      {/* Add vendor sheet */}
      <Modal visible={addOpen} animationType="slide" transparent onRequestClose={() => setAddOpen(false)}>
        <View style={styles.sheetOverlay}>
          <View style={[styles.sheet, { backgroundColor: Colors.background, paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.sheetGrab}>
              <View style={[styles.grabHandle, { backgroundColor: Colors.border }]} />
            </View>
            <Text style={[styles.sheetTitle, { color: Colors.slate }]}>Add Vendor</Text>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <TextInput
                style={[styles.input, { backgroundColor: Colors.surface, borderColor: Colors.border, color: Colors.slate }]}
                placeholder="Company name *"
                placeholderTextColor={Colors.slateLighter}
                value={name}
                onChangeText={setName}
                maxLength={80}
              />
              <View style={styles.chipWrap}>
                {CATEGORIES.map((c) => {
                  const active = c.key === category;
                  return (
                    <TouchableOpacity
                      key={c.key}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: active ? Colors.primary + '20' : Colors.surface,
                          borderColor: active ? Colors.primary + '70' : Colors.border,
                        },
                      ]}
                      onPress={() => setCategory(c.key)}
                    >
                      <Text style={{ fontSize: 12 }}>{c.emoji}</Text>
                      <Text style={[styles.chipText, { color: active ? Colors.primary : Colors.slateLight }]}>
                        {c.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TextInput
                style={[styles.input, { backgroundColor: Colors.surface, borderColor: Colors.border, color: Colors.slate }]}
                placeholder="Contact name"
                placeholderTextColor={Colors.slateLighter}
                value={contactName}
                onChangeText={setContactName}
                maxLength={80}
              />
              <TextInput
                style={[styles.input, { backgroundColor: Colors.surface, borderColor: Colors.border, color: Colors.slate }]}
                placeholder="Phone"
                placeholderTextColor={Colors.slateLighter}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                maxLength={24}
              />
              <TextInput
                style={[styles.input, { backgroundColor: Colors.surface, borderColor: Colors.border, color: Colors.slate }]}
                placeholder="Email"
                placeholderTextColor={Colors.slateLighter}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                maxLength={120}
              />
              <TextInput
                style={[
                  styles.input,
                  styles.notesInput,
                  { backgroundColor: Colors.surface, borderColor: Colors.border, color: Colors.slate },
                ]}
                placeholder="Notes (contract terms, gate codes, hours…)"
                placeholderTextColor={Colors.slateLighter}
                value={notes}
                onChangeText={setNotes}
                multiline
                maxLength={400}
              />
            </ScrollView>
            <View style={styles.sheetActions}>
              <TouchableOpacity
                style={[styles.sheetBtn, styles.sheetBtnSecondary, { borderColor: Colors.border }]}
                onPress={() => {
                  setAddOpen(false);
                  resetForm();
                }}
                activeOpacity={0.8}
              >
                <Text style={[styles.sheetBtnSecondaryText, { color: Colors.slateLight }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sheetBtn, { backgroundColor: Colors.primary, opacity: name.trim() && !addVendor.isPending ? 1 : 0.5 }]}
                disabled={!name.trim() || addVendor.isPending}
                onPress={() => addVendor.mutate()}
                activeOpacity={0.8}
              >
                {addVendor.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.sheetBtnText}>Add Vendor</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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

  list: { padding: 16, paddingBottom: 120, gap: 10 },

  emptyCard: { alignItems: 'center', gap: 10, padding: 28, borderRadius: 16, borderWidth: 1, marginTop: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '700' as const },
  emptyBody: { fontSize: 13, textAlign: 'center', lineHeight: 19 },

  vendorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  vendorIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  vendorBody: { flex: 1, gap: 2 },
  vendorName: { fontSize: 15, fontWeight: '700' as const },
  vendorMeta: { fontSize: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  trashBtn: { padding: 6 },

  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },

  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: '88%',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  sheetGrab: { alignItems: 'center', marginBottom: 8 },
  grabHandle: { width: 40, height: 4, borderRadius: 2 },
  sheetTitle: { fontSize: 18, fontWeight: '800' as const, marginBottom: 14 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 15,
    marginBottom: 10,
  },
  notesInput: { minHeight: 80, textAlignVertical: 'top' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: { fontSize: 12, fontWeight: '600' as const },

  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  sheetBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBtnSecondary: { backgroundColor: 'transparent', borderWidth: 1 },
  sheetBtnSecondaryText: { fontSize: 15, fontWeight: '600' as const },
  sheetBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' as const },

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
