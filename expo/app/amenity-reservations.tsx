/**
 * Amenity Reservations — Community / Professional / Property Manager plans.
 * Members book hourly time slots for community amenities (pool, clubhouse,
 * tennis court…); staff/board manage the amenity list and can cancel any
 * booking. Double-booking is impossible: a DB-level GiST exclusion constraint
 * (org_amenity_reservations_no_overlap) rejects overlapping confirmed slots.
 * Backed by `org_amenities` + `org_amenity_reservations` + RLS.
 */
import React, { useState, useCallback, useMemo } from 'react';
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
  CalendarClock,
  Plus,
  Trash2,
  Lock,
  Building2,
  X,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useColors } from '@/constants/colors';
import { useOrganization } from '@/store/OrganizationContext';
import { useApp } from '@/store/AppContext';
import { supabase } from '@/lib/supabase';
import { warn } from '@/lib/logger';

interface OrgAmenity {
  id: string;
  org_id: string;
  name: string;
}

interface OrgReservation {
  id: string;
  org_id: string;
  amenity_id: string;
  reserved_by: string;
  starts_at: string;
  ends_at: string;
  status: string;
  created_at: string;
  member: { name: string | null } | null;
}

/** First slot of the bookable day (8 AM), last start hour (7 PM → ends 8 PM). */
const FIRST_HOUR = 8;
const LAST_HOUR = 19;
const HOUR_MS = 3600_000;
const DAY_MS = 86_400_000;

function amenityEmoji(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('pool')) return '🏊';
  if (n.includes('gym') || n.includes('fitness')) return '💪';
  if (n.includes('club')) return '🏛️';
  if (n.includes('tennis') || n.includes('court') || n.includes('pickle')) return '🎾';
  if (n.includes('bbq') || n.includes('grill')) return '🔥';
  if (n.includes('park') || n.includes('garden')) return '🌳';
  if (n.includes('lounge') || n.includes('library')) return '🛋️';
  if (n.includes('dog') || n.includes('pet')) return '🐕';
  return '🏷️';
}

function fmtRange(startsAt: string, endsAt: string): string {
  const s = new Date(startsAt);
  const e = new Date(endsAt);
  const day = s.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const time = (d: Date): string => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${day} · ${time(s)} – ${time(e)}`;
}

export default function AmenityReservationsScreen() {
  const Colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { activeOrg, isOrgStaff } = useOrganization();
  const { session } = useApp();
  const userId = session?.user?.id ?? null;

  const [reserveOpen, setReserveOpen] = useState<boolean>(false);
  const [addAmenityOpen, setAddAmenityOpen] = useState<boolean>(false);
  const [amenityName, setAmenityName] = useState<string>('');
  const [pickedAmenity, setPickedAmenity] = useState<string | null>(null);
  const [pickedDay, setPickedDay] = useState<number>(0);

  // Plan gate — amenity reservations start on the Community plan.
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

  const amenitiesQuery = useQuery<OrgAmenity[]>({
    queryKey: ['org-amenities', activeOrg?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('org_amenities')
        .select('*')
        .eq('org_id', activeOrg!.id)
        .order('name', { ascending: true });
      if (error) {
        warn('[Amenities] Fetch error:', error.code);
        return [];
      }
      return (data ?? []) as OrgAmenity[];
    },
    enabled: !!activeOrg?.id && planAllowed,
  });

  const reservationsQuery = useQuery<OrgReservation[]>({
    queryKey: ['org-amenity-reservations', activeOrg?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('org_amenity_reservations')
        .select('*, member:profiles(name)')
        .eq('org_id', activeOrg!.id)
        .eq('status', 'confirmed')
        .gte('starts_at', new Date().toISOString())
        .order('starts_at', { ascending: true })
        .limit(200);
      if (error) {
        warn('[Amenities] Reservation fetch error:', error.code);
        return [];
      }
      return (data ?? []) as OrgReservation[];
    },
    enabled: !!activeOrg?.id && planAllowed,
  });

  const days = useMemo<{ date: Date; label: string; sub: string }[]>(() => {
    const out: { date: Date; label: string; sub: string }[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(Date.now() + i * DAY_MS);
      out.push({
        date: d,
        label: d.toLocaleDateString('en-US', { weekday: 'short' }),
        sub: d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }),
      });
    }
    return out;
  }, []);

  const amenities = amenitiesQuery.data ?? [];
  const reservations = reservationsQuery.data ?? [];
  const amenityNameById = useMemo(
    () => new Map(amenities.map((a) => [a.id, a.name])),
    [amenities],
  );

  const addAmenity = useMutation({
    mutationFn: async () => {
      if (!activeOrg?.id || !userId) throw new Error('Not ready');
      const { error } = await supabase.from('org_amenities').insert({
        org_id: activeOrg.id,
        name: amenityName.trim(),
        created_by: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['org-amenities', activeOrg?.id] });
      setAddAmenityOpen(false);
      setAmenityName('');
    },
    onError: (e: Error) => {
      Alert.alert('Could not add amenity', e.message);
    },
  });

  const removeAmenity = useMutation({
    mutationFn: async (amenityId: string) => {
      const { error } = await supabase.from('org_amenities').delete().eq('id', amenityId);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['org-amenities', activeOrg?.id] });
      void queryClient.invalidateQueries({ queryKey: ['org-amenity-reservations', activeOrg?.id] });
    },
    onError: (e: Error) => {
      Alert.alert('Could not remove amenity', e.message);
    },
  });

  const reserve = useMutation({
    mutationFn: async (slot: { start: Date; end: Date }) => {
      if (!activeOrg?.id || !userId || !pickedAmenity) throw new Error('Not ready');
      const { error } = await supabase.from('org_amenity_reservations').insert({
        org_id: activeOrg.id,
        amenity_id: pickedAmenity,
        reserved_by: userId,
        starts_at: slot.start.toISOString(),
        ends_at: slot.end.toISOString(),
        status: 'confirmed',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['org-amenity-reservations', activeOrg?.id] });
      setReserveOpen(false);
      setPickedAmenity(null);
      setPickedDay(0);
    },
    onError: (e: Error) => {
      const code = (e as Error & { code?: string }).code;
      if (code === '23P01') {
        Alert.alert('Just booked', 'Someone grabbed that slot first. Pick another time.');
      } else {
        Alert.alert('Could not reserve', e.message);
      }
    },
  });

  const cancelReservation = useMutation({
    mutationFn: async (reservationId: string) => {
      const { error } = await supabase
        .from('org_amenity_reservations')
        .update({ status: 'cancelled' })
        .eq('id', reservationId);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['org-amenity-reservations', activeOrg?.id] });
    },
    onError: (e: Error) => {
      Alert.alert('Could not cancel', e.message);
    },
  });

  const confirmRemoveAmenity = useCallback(
    (amenity: OrgAmenity) => {
      Alert.alert('Remove amenity', `Remove ${amenity.name} and its reservations?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => removeAmenity.mutate(amenity.id) },
      ]);
    },
    [removeAmenity],
  );

  // ── Gate states ──────────────────────────────────────────────────────────
  if (!activeOrg) {
    return (
      <View style={[styles.root, { backgroundColor: Colors.background, paddingTop: insets.top + 8 }]}>
        <Header title="Amenity Reservations" />
        <GateCard
          icon={<CalendarClock size={28} color={Colors.slateLighter} />}
          title="Join a community"
          body="Reserve the pool, clubhouse, and more once your HOA or property joins Porchivo."
        />
      </View>
    );
  }

  if (!planAllowed) {
    return (
      <View style={[styles.root, { backgroundColor: Colors.background, paddingTop: insets.top + 8 }]}>
        <Header title="Amenity Reservations" />
        <GateCard
          icon={<CalendarClock size={28} color={Colors.secondary} />}
          title="Community feature"
          body="Amenity reservations are available on the Community plan and up. Ask your board to upgrade your community's plan."
        />
      </View>
    );
  }

  const bookedByMe = reservations.filter((r) => r.reserved_by === userId);
  const upcoming = reservations;

  return (
    <View style={[styles.root, { backgroundColor: Colors.background, paddingTop: insets.top + 8 }]}>
      <Header title="Amenity Reservations" />

      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={reservationsQuery.isRefetching}
            onRefresh={() => {
              void reservationsQuery.refetch();
              void amenitiesQuery.refetch();
            }}
            tintColor={Colors.primary}
          />
        }
      >
        {reservationsQuery.isLoading || amenitiesQuery.isLoading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 32 }} />
        ) : (
          <>
            {/* Amenity chips */}
            <View style={styles.chipSection}>
              <Text style={[styles.chipSectionTitle, { color: Colors.slate }]}>Amenities</Text>
              {amenities.length === 0 ? (
                <Text style={[styles.emptyBody, { color: Colors.slateLighter }]}>
                  {isOrgStaff
                    ? 'Add the amenities residents can book — pool, clubhouse, tennis court…'
                    : 'No amenities have been added yet.'}
                </Text>
              ) : (
                <View style={styles.chipWrap}>
                  {amenities.map((a) => (
                    <View
                      key={a.id}
                      style={[styles.amenityChip, { backgroundColor: Colors.surface, borderColor: Colors.border }]}
                    >
                      <Text style={{ fontSize: 13 }}>{amenityEmoji(a.name)}</Text>
                      <Text style={[styles.amenityChipText, { color: Colors.slate }]}>{a.name}</Text>
                      {isOrgStaff ? (
                        <TouchableOpacity
                          onPress={() => confirmRemoveAmenity(a)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <X size={13} color={Colors.slateLighter} />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  ))}
                  {isOrgStaff ? (
                    <TouchableOpacity
                      style={[styles.amenityChip, { borderColor: Colors.primary + '60', backgroundColor: Colors.primary + '14' }]}
                      onPress={() => setAddAmenityOpen(true)}
                      activeOpacity={0.8}
                    >
                      <Plus size={13} color={Colors.primary} />
                      <Text style={[styles.amenityChipText, { color: Colors.primary }]}>Add</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              )}
            </View>

            {/* Upcoming reservations */}
            <Text style={[styles.chipSectionTitle, { color: Colors.slate }]}>Upcoming</Text>
            {upcoming.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
                <CalendarClock size={26} color={Colors.slateLighter} />
                <Text style={[styles.emptyTitle, { color: Colors.slate }]}>No reservations yet</Text>
                <Text style={[styles.emptyBody, { color: Colors.slateLighter }]}>
                  Book your first time slot below.
                </Text>
              </View>
            ) : (
              upcoming.map((r) => {
                const mine = r.reserved_by === userId;
                const canCancel = mine || isOrgStaff;
                return (
                  <View
                    key={r.id}
                    style={[styles.resCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}
                  >
                    <View style={[styles.resIcon, { backgroundColor: Colors.secondary + '18' }]}>
                      <Text style={{ fontSize: 18 }}>
                        {amenityEmoji(amenityNameById.get(r.amenity_id) ?? '')}
                      </Text>
                    </View>
                    <View style={styles.resBody}>
                      <Text style={[styles.resTitle, { color: Colors.slate }]}>
                        {amenityNameById.get(r.amenity_id) ?? 'Amenity'}
                        {mine ? ' · You' : ''}
                      </Text>
                      <Text style={[styles.resMeta, { color: Colors.slateLighter }]}>
                        {fmtRange(r.starts_at, r.ends_at)}
                      </Text>
                      {!mine && r.member?.name ? (
                        <Text style={[styles.resMeta, { color: Colors.slateLighter }]} numberOfLines={1}>
                          Reserved by {r.member.name}
                        </Text>
                      ) : null}
                    </View>
                    {canCancel ? (
                      <TouchableOpacity
                        onPress={() => cancelReservation.mutate(r.id)}
                        disabled={cancelReservation.isPending}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <X size={18} color={Colors.danger} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                );
              })
            )}
            {bookedByMe.length > 0 ? (
              <Text style={[styles.mineNote, { color: Colors.slateLighter }]}>
                You have {bookedByMe.length} upcoming {bookedByMe.length === 1 ? 'booking' : 'bookings'}.
              </Text>
            ) : null}
          </>
        )}
      </ScrollView>

      {/* Reserve FAB */}
      {amenities.length > 0 ? (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: Colors.primary, bottom: insets.bottom + 20 }]}
          onPress={() => setReserveOpen(true)}
          activeOpacity={0.85}
        >
          <Plus size={24} color="#fff" />
        </TouchableOpacity>
      ) : null}

      {/* Reserve sheet */}
      <Modal visible={reserveOpen} animationType="slide" transparent onRequestClose={() => setReserveOpen(false)}>
        <View style={styles.sheetOverlay}>
          <View style={[styles.sheet, { backgroundColor: Colors.background, paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.sheetGrab}>
              <View style={[styles.grabHandle, { backgroundColor: Colors.border }]} />
            </View>
            <Text style={[styles.sheetTitle, { color: Colors.slate }]}>Reserve an Amenity</Text>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={[styles.sheetLabel, { color: Colors.slateLight }]}>AMENITY</Text>
              <View style={styles.chipWrap}>
                {amenities.map((a) => {
                  const active = a.id === pickedAmenity;
                  return (
                    <TouchableOpacity
                      key={a.id}
                      style={[
                        styles.pickChip,
                        {
                          backgroundColor: active ? Colors.primary + '20' : Colors.surface,
                          borderColor: active ? Colors.primary + '70' : Colors.border,
                        },
                      ]}
                      onPress={() => setPickedAmenity(a.id)}
                    >
                      <Text style={{ fontSize: 12 }}>{amenityEmoji(a.name)}</Text>
                      <Text style={[styles.pickChipText, { color: active ? Colors.primary : Colors.slateLight }]}>
                        {a.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.sheetLabel, { color: Colors.slateLight }]}>DAY</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayRow}>
                {days.map((d, i) => {
                  const active = i === pickedDay;
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[
                        styles.dayChip,
                        {
                          backgroundColor: active ? Colors.primary : Colors.surface,
                          borderColor: active ? Colors.primary : Colors.border,
                        },
                      ]}
                      onPress={() => setPickedDay(i)}
                    >
                      <Text style={[styles.dayChipLabel, { color: active ? '#fff' : Colors.slateLight }]}>
                        {d.label}
                      </Text>
                      <Text style={[styles.dayChipSub, { color: active ? '#fff' : Colors.slate }]}>
                        {d.sub}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={[styles.sheetLabel, { color: Colors.slateLight }]}>TIME (1 HOUR)</Text>
              <View style={styles.slotGrid}>
                {Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, i) => FIRST_HOUR + i).map((hour) => {
                  const slotStart = new Date(days[pickedDay].date);
                  slotStart.setHours(hour, 0, 0, 0);
                  const slotEnd = new Date(slotStart.getTime() + HOUR_MS);
                  const past = slotStart.getTime() < Date.now();
                  const label = `${hour % 12 === 0 ? 12 : hour % 12}:00 ${hour < 12 ? 'AM' : 'PM'}`;
                  return (
                    <TouchableOpacity
                      key={hour}
                      style={[styles.slotChip, { backgroundColor: Colors.surface, borderColor: Colors.border, opacity: past ? 0.35 : 1 }]}
                      disabled={past || !pickedAmenity}
                      onPress={() => reserve.mutate({ start: slotStart, end: slotEnd })}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.slotText, { color: Colors.slate }]}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {!pickedAmenity ? (
                <Text style={[styles.mineNote, { color: Colors.slateLighter }]}>Pick an amenity first.</Text>
              ) : null}
            </ScrollView>
            <TouchableOpacity
              style={[styles.sheetBtn, styles.sheetBtnSecondary, { borderColor: Colors.border }]}
              onPress={() => {
                setReserveOpen(false);
                setPickedAmenity(null);
                setPickedDay(0);
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.sheetBtnSecondaryText, { color: Colors.slateLight }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add amenity sheet */}
      <Modal visible={addAmenityOpen} animationType="slide" transparent onRequestClose={() => setAddAmenityOpen(false)}>
        <View style={styles.sheetOverlay}>
          <View style={[styles.sheet, { backgroundColor: Colors.background, paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.sheetGrab}>
              <View style={[styles.grabHandle, { backgroundColor: Colors.border }]} />
            </View>
            <Text style={[styles.sheetTitle, { color: Colors.slate }]}>Add Amenity</Text>
            <TextInput
              style={[styles.input, { backgroundColor: Colors.surface, borderColor: Colors.border, color: Colors.slate }]}
              placeholder="Pool, clubhouse, tennis court…"
              placeholderTextColor={Colors.slateLighter}
              value={amenityName}
              onChangeText={setAmenityName}
              maxLength={60}
              autoFocus
            />
            <View style={styles.sheetActions}>
              <TouchableOpacity
                style={[styles.sheetBtn, styles.sheetBtnSecondary, { borderColor: Colors.border }]}
                onPress={() => {
                  setAddAmenityOpen(false);
                  setAmenityName('');
                }}
                activeOpacity={0.8}
              >
                <Text style={[styles.sheetBtnSecondaryText, { color: Colors.slateLight }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sheetBtn, { backgroundColor: Colors.primary, opacity: amenityName.trim() && !addAmenity.isPending ? 1 : 0.5 }]}
                disabled={!amenityName.trim() || addAmenity.isPending}
                onPress={() => addAmenity.mutate()}
                activeOpacity={0.8}
              >
                {addAmenity.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.sheetBtnText}>Add Amenity</Text>
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

  chipSection: { marginBottom: 6 },
  chipSectionTitle: { fontSize: 15, fontWeight: '700' as const, marginBottom: 8, marginTop: 4 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  amenityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  amenityChipText: { fontSize: 13, fontWeight: '600' as const },

  emptyCard: { alignItems: 'center', gap: 10, padding: 28, borderRadius: 16, borderWidth: 1, marginTop: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700' as const },
  emptyBody: { fontSize: 13, textAlign: 'center', lineHeight: 19 },

  resCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  resIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  resBody: { flex: 1, gap: 2 },
  resTitle: { fontSize: 15, fontWeight: '700' as const },
  resMeta: { fontSize: 12 },
  mineNote: { fontSize: 12, textAlign: 'center', marginTop: 4 },

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
  sheetLabel: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 15,
    marginBottom: 10,
  },
  pickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  pickChipText: { fontSize: 12, fontWeight: '600' as const },
  dayRow: { marginBottom: 14 },
  dayChip: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    width: 58,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 8,
  },
  dayChipLabel: { fontSize: 11, fontWeight: '600' as const },
  dayChipSub: { fontSize: 13, fontWeight: '700' as const },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  slotChip: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 11,
    borderWidth: 1,
  },
  slotText: { fontSize: 13, fontWeight: '600' as const },

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
