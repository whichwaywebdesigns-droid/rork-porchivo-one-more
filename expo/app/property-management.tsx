import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Alert,
  Platform,
  TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  Building2,
  Home,
  Plus,
  ChevronDown,
  ChevronRight,
  Users,
  Package,
  Search,
  MapPin,
  MoreHorizontal,
  Trash2,
  Check,
  X,
} from 'lucide-react-native';
import { useColors } from '@/constants/colors';
import { useOrganization } from '@/store/OrganizationContext';
import { useSubscriptionGate } from '@/hooks/useSubscriptionGate';
import { ReadOnlyNotice } from '@/components/BillingGraceBanner';
import { supabase } from '@/lib/supabase';
import {
  PropertyRow,
  UnitRow,
  PropertySummaryStats,
  propertyRowFromRpc,
  unitRowFromRpc,
  ORG_TYPE_LABELS,
} from '@/types/organization';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function occupancyColor(occupied: number, total: number, colors: ReturnType<typeof useColors>): string {
  if (total === 0) return colors.slateLighter;
  const pct = occupied / total;
  if (pct >= 0.9) return colors.success;
  if (pct >= 0.6) return colors.secondary;
  return colors.slateLighter;
}

// ─── Summary pill strip ────────────────────────────────────────────────────────

function SummaryStrip({ stats }: { stats: PropertySummaryStats | null }) {
  const Colors = useColors();
  if (!stats) return null;
  const items = [
    { label: 'Properties', value: stats.total_properties, color: Colors.primary },
    { label: 'Units', value: stats.total_units, color: Colors.slate },
    { label: 'Occupied', value: stats.occupied_units, color: Colors.success },
    { label: 'Vacant', value: stats.vacant_units, color: Colors.secondary },
  ];
  return (
    <View style={[styles.summaryStrip, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
      {items.map((item, i) => (
        <React.Fragment key={item.label}>
          {i > 0 && <View style={[styles.summaryDivider, { backgroundColor: Colors.border }]} />}
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: item.color }]}>{item.value}</Text>
            <Text style={[styles.summaryLabel, { color: Colors.slateLighter }]}>{item.label}</Text>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}

// ─── Unit row ──────────────────────────────────────────────────────────────────

function UnitItem({
  unit,
  onRemove,
  isRemoving,
}: {
  unit: UnitRow;
  onRemove: () => void;
  isRemoving: boolean;
}) {
  const Colors = useColors();
  return (
    <View style={[styles.unitRow, { backgroundColor: Colors.background, borderColor: Colors.border }]}>
      <View style={[styles.unitNumberBox, { backgroundColor: Colors.primary + '12' }]}>
        <Text style={[styles.unitNumber, { color: Colors.primary }]}>{unit.unitNumber}</Text>
      </View>
      <View style={styles.unitInfo}>
        {unit.residentName ? (
          <Text style={[styles.unitResident, { color: Colors.slate }]} numberOfLines={1}>
            {unit.residentName}
          </Text>
        ) : (
          <Text style={[styles.unitVacant, { color: Colors.slateLighter }]}>Vacant</Text>
        )}
        {unit.floor != null && (
          <Text style={[styles.unitFloor, { color: Colors.slateLighter }]}>Floor {unit.floor}</Text>
        )}
      </View>
      {unit.residentId ? (
        <View style={[styles.occupiedChip, { backgroundColor: Colors.success + '14', borderColor: Colors.success + '30' }]}>
          <Check size={10} color={Colors.success} strokeWidth={3} />
          <Text style={[styles.occupiedChipText, { color: Colors.success }]}>Occupied</Text>
        </View>
      ) : null}
      <TouchableOpacity
        onPress={onRemove}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={styles.unitRemoveBtn}
        disabled={isRemoving}
      >
        {isRemoving ? (
          <ActivityIndicator size="small" color={Colors.danger} />
        ) : (
          <Trash2 size={14} color={Colors.danger + 'AA'} />
        )}
      </TouchableOpacity>
    </View>
  );
}

// ─── Add unit inline input ─────────────────────────────────────────────────────

function AddUnitInput({
  propertyId,
  onDone,
}: {
  propertyId: string;
  onDone: () => void;
}) {
  const Colors = useColors();
  const { createUnit, isCreatingUnit } = useOrganization();
  const [value, setValue] = useState<string>('');
  // Billing grace stage 2 (day 14+): property edits are read-only for managers
  const { isManagerAdminReadOnly } = useSubscriptionGate();

  const handleAdd = async () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (isManagerAdminReadOnly) return;
    try {
      await createUnit({ propertyId, unitNumber: trimmed });
      setValue('');
      onDone();
    } catch {
      Alert.alert('Error', 'Could not add unit. Please try again.');
    }
  };

  return (
    <View style={[styles.addUnitRow, { backgroundColor: Colors.background, borderColor: Colors.border }]}>
      <TextInput
        style={[styles.addUnitInput, { color: Colors.slate, borderColor: Colors.border }]}
        placeholder="Unit number (e.g. 101)"
        placeholderTextColor={Colors.slateLighter}
        value={value}
        onChangeText={setValue}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={handleAdd}
      />
      <TouchableOpacity
        style={[styles.addUnitConfirm, { backgroundColor: Colors.primary }]}
        onPress={handleAdd}
        disabled={isCreatingUnit || !value.trim() || isManagerAdminReadOnly}
      >
        {isCreatingUnit ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Check size={14} color="#fff" strokeWidth={2.5} />
        )}
      </TouchableOpacity>
      <TouchableOpacity onPress={onDone} style={styles.addUnitCancel}>
        <X size={14} color={Colors.slateLighter} />
      </TouchableOpacity>
    </View>
  );
}

// ─── Property Card ─────────────────────────────────────────────────────────────

function PropertyCard({
  property,
  orgId,
}: {
  property: PropertyRow;
  orgId: string;
}) {
  const Colors = useColors();
  const queryClient = useQueryClient();
  const { removeUnit, isRemovingUnit } = useOrganization();
  // Billing grace stage 2 (day 14+): property edits are read-only for managers
  const { isManagerAdminReadOnly } = useSubscriptionGate();
  const [expanded, setExpanded] = useState<boolean>(false);
  const [addingUnit, setAddingUnit] = useState<boolean>(false);
  const [removingUnitId, setRemovingUnitId] = useState<string | null>(null);
  const expandAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const toggleExpand = () => {
    const toVal = expanded ? 0 : 1;
    Animated.parallel([
      Animated.spring(expandAnim, { toValue: toVal, useNativeDriver: false, damping: 15, stiffness: 120 }),
      Animated.timing(rotateAnim, { toValue: toVal, duration: 200, useNativeDriver: true }),
    ]).start();
    setExpanded(!expanded);
  };

  const rotation = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });

  // Units query — only fetched when expanded
  const { data: units = [], isLoading: unitsLoading } = useQuery<UnitRow[]>({
    queryKey: ['org-property-units', property.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_property_units', {
        p_property_id: property.id,
        p_org_id: orgId,
      });
      if (error) return [];
      return ((data ?? []) as Record<string, unknown>[]).map(unitRowFromRpc);
    },
    enabled: expanded,
    staleTime: 1000 * 60 * 2,
  });

  const handleRemoveUnit = (unit: UnitRow) => {
    // Billing grace stage 2: unit removal is a property edit — read-only
    if (isManagerAdminReadOnly) return;
    Alert.alert(
      'Remove Unit',
      `Remove Unit ${unit.unitNumber}? This will unlink any assigned residents.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setRemovingUnitId(unit.id);
            try {
              await removeUnit({ unitId: unit.id, propertyId: property.id });
            } catch {
              Alert.alert('Error', 'Could not remove unit.');
            } finally {
              setRemovingUnitId(null);
            }
          },
        },
      ]
    );
  };

  const occupancy = property.unitCount > 0
    ? Math.round((property.occupiedCount / property.unitCount) * 100)
    : 0;
  const occColor = occupancyColor(property.occupiedCount, property.unitCount, Colors);

  return (
    <View style={[styles.propertyCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
      {/* Card header */}
      <TouchableOpacity
        style={styles.propertyCardHeader}
        onPress={toggleExpand}
        activeOpacity={0.75}
      >
        <View style={[styles.propertyIconWrap, { backgroundColor: Colors.primary + '14' }]}>
          <Building2 size={18} color={Colors.primary} />
        </View>

        <View style={styles.propertyInfo}>
          <Text style={[styles.propertyName, { color: Colors.slate }]} numberOfLines={1}>
            {property.name}
          </Text>
          <Text style={[styles.propertyAddress, { color: Colors.slateLighter }]} numberOfLines={1}>
            <MapPin size={10} color={Colors.slateLighter} /> {property.address}
          </Text>
        </View>

        <View style={styles.propertyMeta}>
          <View style={styles.propertyBadges}>
            <View style={[styles.unitsBadge, { backgroundColor: Colors.background, borderColor: Colors.border }]}>
              <Home size={11} color={Colors.slateLight} />
              <Text style={[styles.unitsBadgeText, { color: Colors.slateLight }]}>{property.unitCount}</Text>
            </View>
            {property.unitCount > 0 && (
              <View style={[styles.occupancyBadge, { backgroundColor: occColor + '14', borderColor: occColor + '30' }]}>
                <Users size={11} color={occColor} />
                <Text style={[styles.occupancyText, { color: occColor }]}>{occupancy}%</Text>
              </View>
            )}
          </View>
          <Animated.View style={{ transform: [{ rotate: rotation }] }}>
            <ChevronDown size={16} color={Colors.slateLighter} />
          </Animated.View>
        </View>
      </TouchableOpacity>

      {/* Occupancy bar */}
      {property.unitCount > 0 && (
        <View style={[styles.occupancyBarWrap, { backgroundColor: Colors.background }]}>
          <View
            style={[
              styles.occupancyBarFill,
              { width: `${occupancy}%` as `${number}%`, backgroundColor: occColor },
            ]}
          />
        </View>
      )}

      {/* Expanded units list */}
      {expanded && (
        <View style={styles.unitsSection}>
          <View style={styles.unitsSectionHeader}>
            <Text style={[styles.unitsSectionTitle, { color: Colors.slateLight }]}>
              Units · {units.length}
            </Text>
            <TouchableOpacity
              style={[styles.addUnitBtn, { backgroundColor: Colors.primary + '14', borderColor: Colors.primary + '30' }]}
              onPress={() => setAddingUnit(true)}
            >
              <Plus size={12} color={Colors.primary} />
              <Text style={[styles.addUnitBtnText, { color: Colors.primary }]}>Add</Text>
            </TouchableOpacity>
          </View>

          {unitsLoading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginVertical: 12 }} />
          ) : (
            <>
              {units.map((unit) => (
                <UnitItem
                  key={unit.id}
                  unit={unit}
                  onRemove={() => handleRemoveUnit(unit)}
                  isRemoving={removingUnitId === unit.id && isRemovingUnit}
                />
              ))}
              {units.length === 0 && !addingUnit && (
                <View style={styles.noUnitsHint}>
                  <Text style={[styles.noUnitsText, { color: Colors.slateLighter }]}>
                    No units yet — add the first one
                  </Text>
                </View>
              )}
              {addingUnit && (
                <AddUnitInput
                  propertyId={property.id}
                  onDone={() => {
                    setAddingUnit(false);
                    void queryClient.invalidateQueries({ queryKey: ['org-property-units', property.id] });
                  }}
                />
              )}
            </>
          )}

          {/* Manager strip */}
          {property.managerName && (
            <View style={[styles.managerStrip, { borderColor: Colors.border }]}>
              <Users size={12} color={Colors.slateLighter} />
              <Text style={[styles.managerText, { color: Colors.slateLighter }]}>
                Manager: {property.managerName}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function PropertyManagementScreen() {
  const Colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { activeOrg, isOrgAdmin } = useOrganization();

  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [search, setSearch] = useState<string>('');
  // Billing grace period — stage 2 (day 14+): manager admin tools are
  // read-only; billing screens (BILL-08/09/10) stay fully interactive.
  const { isManagerAdminReadOnly } = useSubscriptionGate();

  // ── Properties query ────────────────────────────────────────────────────────
  const { data: properties = [], isLoading: propsLoading } = useQuery<PropertyRow[]>({
    queryKey: ['org-properties', activeOrg?.id],
    queryFn: async () => {
      if (!activeOrg?.id) return [];
      const { data, error } = await supabase.rpc('get_org_properties', {
        p_org_id: activeOrg.id,
      });
      if (error) return [];
      return ((data ?? []) as Record<string, unknown>[]).map(propertyRowFromRpc);
    },
    enabled: !!activeOrg?.id,
    staleTime: 1000 * 60 * 2,
  });

  // ── Summary stats ───────────────────────────────────────────────────────────
  const { data: summary } = useQuery<PropertySummaryStats | null>({
    queryKey: ['org-property-summary', activeOrg?.id],
    queryFn: async () => {
      if (!activeOrg?.id) return null;
      const { data, error } = await supabase.rpc('get_property_summary', {
        p_org_id: activeOrg.id,
      });
      if (error) return null;
      return data as PropertySummaryStats;
    },
    enabled: !!activeOrg?.id && isOrgAdmin,
    staleTime: 1000 * 60 * 3,
  });

  // ── Refresh ─────────────────────────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['org-properties', activeOrg?.id] }),
      queryClient.invalidateQueries({ queryKey: ['org-property-summary', activeOrg?.id] }),
    ]);
    setRefreshing(false);
  }, [queryClient, activeOrg?.id]);

  const filtered = search.trim()
    ? properties.filter(
        (p) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.address.toLowerCase().includes(search.toLowerCase())
      )
    : properties;

  if (!activeOrg) {
    return (
      <View style={[styles.root, { backgroundColor: Colors.background }]}>
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 80 }} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: Colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + (Platform.OS === 'android' ? 12 : 8),
            backgroundColor: Colors.surface,
            borderBottomColor: Colors.border,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ChevronLeft size={24} color={Colors.slate} strokeWidth={2} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: Colors.slate }]}>Properties</Text>
          <Text style={[styles.headerSub, { color: Colors.slateLighter }]}>
            {activeOrg.name} · {ORG_TYPE_LABELS[activeOrg.type]}
          </Text>
        </View>

        {isOrgAdmin && (
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: Colors.primary }]}
            onPress={() => router.push('/add-property')}
            activeOpacity={0.8}
            disabled={isManagerAdminReadOnly}
          >
            <Plus size={16} color="#fff" strokeWidth={2.5} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />
        }
      >
        {/* Billing grace — manager read-only notice (stage 2, non-blocking) */}
        <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
          <ReadOnlyNotice variant="manager" />
        </View>

        {/* Summary */}
        {isOrgAdmin && summary && (
          <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
            <SummaryStrip stats={summary} />
          </View>
        )}

        {/* Search */}
        <View style={[styles.searchWrap, { marginTop: isOrgAdmin && summary ? 14 : 20 }]}>
          <View style={[styles.searchBar, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
            <Search size={16} color={Colors.slateLighter} />
            <TextInput
              style={[styles.searchInput, { color: Colors.slate }]}
              placeholder="Search properties..."
              placeholderTextColor={Colors.slateLighter}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={14} color={Colors.slateLighter} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* List */}
        <View style={styles.listSection}>
          {propsLoading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
          ) : filtered.length === 0 ? (
            <View style={[styles.emptyState, { borderColor: Colors.border }]}>
              <Building2 size={32} color={Colors.slateLighter} />
              <Text style={[styles.emptyTitle, { color: Colors.slateLight }]}>
                {search ? 'No matches found' : 'No properties yet'}
              </Text>
              {!search && isOrgAdmin && (
                <Text style={[styles.emptyHint, { color: Colors.slateLighter }]}>
                  Tap + to add your first building or property
                </Text>
              )}
            </View>
          ) : (
            filtered.map((property) => (
              <PropertyCard key={property.id} property={property} orgId={activeOrg.id} />
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  backBtn: { padding: 2 },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: '700' as const, letterSpacing: -0.3 },
  headerSub: { fontSize: 12, marginTop: 1 },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Summary
  summaryStrip: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  summaryItem: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  summaryDivider: { width: StyleSheet.hairlineWidth },
  summaryValue: { fontSize: 20, fontWeight: '800' as const, letterSpacing: -0.4 },
  summaryLabel: { fontSize: 11, fontWeight: '500' as const, marginTop: 2 },

  // Search
  searchWrap: { paddingHorizontal: 20 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14 },

  // List
  listSection: { padding: 20, gap: 12 },

  // Empty
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    borderStyle: 'dashed' as const,
  },
  emptyTitle: { fontSize: 15, fontWeight: '600' as const },
  emptyHint: { fontSize: 13, textAlign: 'center' },

  // Property card
  propertyCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  propertyCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  propertyIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  propertyInfo: { flex: 1 },
  propertyName: { fontSize: 15, fontWeight: '700' as const, letterSpacing: -0.2 },
  propertyAddress: { fontSize: 12, marginTop: 2 },
  propertyMeta: { alignItems: 'flex-end', gap: 6 },
  propertyBadges: { flexDirection: 'row', gap: 6 },
  unitsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  unitsBadgeText: { fontSize: 11, fontWeight: '600' as const },
  occupancyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  occupancyText: { fontSize: 11, fontWeight: '700' as const },

  // Occupancy bar
  occupancyBarWrap: {
    height: 3,
    marginHorizontal: 16,
    marginBottom: 0,
    borderRadius: 2,
    overflow: 'hidden',
  },
  occupancyBarFill: { height: 3, borderRadius: 2 },

  // Units section (expanded)
  unitsSection: { paddingTop: 8, paddingBottom: 12, paddingHorizontal: 16 },
  unitsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  unitsSectionTitle: { fontSize: 12, fontWeight: '600' as const, textTransform: 'uppercase' as const, letterSpacing: 0.6 },
  addUnitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  addUnitBtnText: { fontSize: 12, fontWeight: '600' as const },

  // Unit row
  unitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 6,
    gap: 10,
  },
  unitNumberBox: {
    width: 36,
    height: 36,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitNumber: { fontSize: 13, fontWeight: '800' as const },
  unitInfo: { flex: 1 },
  unitResident: { fontSize: 13, fontWeight: '600' as const },
  unitVacant: { fontSize: 13, fontStyle: 'italic' as const },
  unitFloor: { fontSize: 11, marginTop: 1 },
  occupiedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  occupiedChipText: { fontSize: 10, fontWeight: '700' as const },
  unitRemoveBtn: { padding: 4 },

  // Add unit inline
  addUnitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 6,
  },
  addUnitInput: {
    flex: 1,
    fontSize: 14,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  addUnitConfirm: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addUnitCancel: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // No units
  noUnitsHint: { paddingVertical: 12, alignItems: 'center' },
  noUnitsText: { fontSize: 13 },

  // Manager strip
  managerStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 10,
    marginTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  managerText: { fontSize: 12 },
});
