import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Animated,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Building2,
  Search,
  X,
  CheckCircle,
  ChevronRight,
  Hash,
  Home,
  Layers,
  LayoutGrid,
  Users,
  ChevronLeft,
} from 'lucide-react-native';
import { useColors } from '@/constants/colors';
import { useOrganization } from '@/store/OrganizationContext';
import {
  Organization,
  OrgType,
  ORG_TYPE_LABELS,
  ORG_TYPE_DESCRIPTIONS,
} from '@/types/organization';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ─── Org type filter config ────────────────────────────────────────────────────

const ORG_TYPES: { type: OrgType; icon: React.ReactNode; label: string }[] = [
  { type: 'hoa', icon: null, label: 'HOA' },
  { type: 'condo', icon: null, label: 'Condo' },
  { type: 'multifamily', icon: null, label: 'Apt' },
  { type: 'property_management', icon: null, label: 'Property Mgmt' },
];

const ORG_TYPE_EMOJIS: Record<OrgType, string> = {
  hoa: '🏡',
  condo: '🏢',
  multifamily: '🏬',
  property_management: '🏗️',
};

type Mode = 'join' | 'claim';

// ─── Org result card ──────────────────────────────────────────────────────────

function OrgCard({
  org,
  onPress,
}: {
  org: Organization;
  onPress: () => void;
}) {
  const Colors = useColors();
  return (
    <TouchableOpacity
      style={[styles.orgCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}
      onPress={onPress}
      activeOpacity={0.78}
    >
      <View style={[styles.orgCardIcon, { backgroundColor: Colors.primary + '18' }]}>
        <Text style={styles.orgCardEmoji}>{ORG_TYPE_EMOJIS[org.type]}</Text>
      </View>
      <View style={styles.orgCardInfo}>
        <Text style={[styles.orgCardName, { color: Colors.slate }]} numberOfLines={1}>
          {org.name}
        </Text>
        <Text style={[styles.orgCardMeta, { color: Colors.slateLighter }]}>
          {ORG_TYPE_LABELS[org.type]}
          {org.city ? ` · ${org.city}, ${org.state}` : ''}
          {org.totalUnits ? ` · ${org.totalUnits} units` : ''}
        </Text>
      </View>
      {org.isVerified ? (
        <CheckCircle size={16} color={Colors.success} />
      ) : null}
      <ChevronRight size={16} color={Colors.slateLighter} />
    </TouchableOpacity>
  );
}

// ─── Claim form ───────────────────────────────────────────────────────────────

function ClaimForm() {
  const Colors = useColors();
  const { createOrg, isCreatingOrg } = useOrganization();
  const [name, setName] = useState<string>('');
  const [type, setType] = useState<OrgType>('hoa');
  const [address, setAddress] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [state, setState] = useState<string>('');
  const [zip, setZip] = useState<string>('');
  const [totalUnits, setTotalUnits] = useState<string>('');

  const handleSubmit = useCallback(async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter your community name.');
      return;
    }
    try {
      await createOrg({
        name: name.trim(),
        type,
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        zip: zip.trim(),
        totalUnits: totalUnits ? parseInt(totalUnits, 10) : undefined,
      });
      Alert.alert(
        '🎉 Community Created!',
        `${name} is now live on Porchivo. Share your invite code with residents to get them started.`,
        [{ text: 'Done', onPress: () => router.back() }]
      );
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Something went wrong. Please try again.');
    }
  }, [name, type, address, city, state, zip, totalUnits, createOrg]);

  const inputStyle = [styles.input, { backgroundColor: Colors.surface, borderColor: Colors.border, color: Colors.slate }];
  const labelStyle = [styles.fieldLabel, { color: Colors.slateLighter }];

  return (
    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Text style={[styles.claimHeadline, { color: Colors.slate }]}>
        Claim your community
      </Text>
      <Text style={[styles.claimSubtext, { color: Colors.slateLighter }]}>
        You'll become the admin. Share the auto-generated invite code with residents to let them join.
      </Text>

      {/* Type selector */}
      <Text style={labelStyle}>Community type</Text>
      <View style={styles.typeGrid}>
        {ORG_TYPES.map((t) => (
          <TouchableOpacity
            key={t.type}
            style={[
              styles.typeChip,
              {
                backgroundColor: type === t.type ? Colors.primary : Colors.surface,
                borderColor: type === t.type ? Colors.primary : Colors.border,
              },
            ]}
            onPress={() => setType(t.type)}
            activeOpacity={0.75}
          >
            <Text style={styles.typeChipEmoji}>{ORG_TYPE_EMOJIS[t.type]}</Text>
            <Text
              style={[styles.typeChipLabel, { color: type === t.type ? '#fff' : Colors.slateLight }]}
            >
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={labelStyle}>Community name *</Text>
      <TextInput
        style={inputStyle}
        placeholder={`e.g. Oakwood ${ORG_TYPE_LABELS[type]}`}
        placeholderTextColor={Colors.slateLighter}
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        returnKeyType="next"
      />

      <Text style={labelStyle}>Street address</Text>
      <TextInput
        style={inputStyle}
        placeholder="123 Main St"
        placeholderTextColor={Colors.slateLighter}
        value={address}
        onChangeText={setAddress}
        autoCapitalize="words"
        returnKeyType="next"
      />

      <View style={styles.rowInputs}>
        <View style={{ flex: 1 }}>
          <Text style={labelStyle}>City</Text>
          <TextInput
            style={inputStyle}
            placeholder="Austin"
            placeholderTextColor={Colors.slateLighter}
            value={city}
            onChangeText={setCity}
            autoCapitalize="words"
            returnKeyType="next"
          />
        </View>
        <View style={{ width: 64 }}>
          <Text style={labelStyle}>State</Text>
          <TextInput
            style={inputStyle}
            placeholder="TX"
            placeholderTextColor={Colors.slateLighter}
            value={state}
            onChangeText={(v) => setState(v.toUpperCase().slice(0, 2))}
            autoCapitalize="characters"
            maxLength={2}
            returnKeyType="next"
          />
        </View>
        <View style={{ width: 90 }}>
          <Text style={labelStyle}>ZIP</Text>
          <TextInput
            style={inputStyle}
            placeholder="78701"
            placeholderTextColor={Colors.slateLighter}
            value={zip}
            onChangeText={setZip}
            keyboardType="number-pad"
            maxLength={5}
            returnKeyType="next"
          />
        </View>
      </View>

      <Text style={labelStyle}>Total units (optional)</Text>
      <TextInput
        style={inputStyle}
        placeholder="e.g. 48"
        placeholderTextColor={Colors.slateLighter}
        value={totalUnits}
        onChangeText={setTotalUnits}
        keyboardType="number-pad"
        returnKeyType="done"
      />

      <TouchableOpacity
        style={[styles.submitBtn, { backgroundColor: isCreatingOrg ? Colors.primary + '88' : Colors.primary }]}
        onPress={handleSubmit}
        disabled={isCreatingOrg}
        activeOpacity={0.85}
      >
        {isCreatingOrg ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <>
            <Building2 size={18} color="#fff" />
            <Text style={styles.submitBtnText}>Create Community</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function JoinCommunityScreen() {
  const Colors = useColors();
  const insets = useSafeAreaInsets();
  const { mode: modeParam } = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<Mode>(modeParam === 'claim' ? 'claim' : 'join');

  // Join mode state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<OrgType | null>(null);
  const [results, setResults] = useState<Organization[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [inviteCodeMode, setInviteCodeMode] = useState<boolean>(false);
  const [inviteCode, setInviteCode] = useState<string>('');
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [unitInput, setUnitInput] = useState<string>('');
  const [isRequesting, setIsRequesting] = useState<boolean>(false);

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { searchOrgs, searchByInviteCode, requestMembership } = useOrganization();

  // ── Search ──────────────────────────────────────────────────────────────────
  const runSearch = useCallback(
    async (q: string, t: OrgType | null) => {
      if (!q.trim() && !t) { setResults([]); setHasSearched(false); return; }
      setIsSearching(true);
      setHasSearched(true);
      const found = await searchOrgs(q.trim(), t ?? undefined);
      setResults(found);
      setIsSearching(false);
    },
    [searchOrgs]
  );

  const handleSearchChange = useCallback(
    (text: string) => {
      setSearchQuery(text);
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
      searchTimeout.current = setTimeout(() => runSearch(text, typeFilter), 400);
    },
    [typeFilter, runSearch]
  );

  const handleTypeFilter = useCallback(
    (t: OrgType) => {
      const next = typeFilter === t ? null : t;
      setTypeFilter(next);
      runSearch(searchQuery, next);
    },
    [typeFilter, searchQuery, runSearch]
  );

  const handleInviteSearch = useCallback(async () => {
    if (!inviteCode.trim()) return;
    setIsSearching(true);
    const found = await searchByInviteCode(inviteCode);
    setIsSearching(false);
    if (found) {
      setSelectedOrg(found);
    } else {
      Alert.alert('Not Found', 'No community found with that invite code. Double-check the code and try again.');
    }
  }, [inviteCode, searchByInviteCode]);

  // ── Request membership ──────────────────────────────────────────────────────
  const handleJoinRequest = useCallback(
    async (org: Organization) => {
      setIsRequesting(true);
      try {
        await requestMembership({ orgId: org.id });
        Alert.alert(
          '✅ Request Sent!',
          `Your request to join ${org.name} has been submitted. You'll be notified once approved.`,
          [{ text: 'Done', onPress: () => router.back() }]
        );
      } catch (e: any) {
        const msg = e?.message ?? '';
        if (msg.includes('unique') || msg.includes('duplicate')) {
          Alert.alert('Already Requested', 'You already have a pending or active membership for this community.');
        } else {
          Alert.alert('Error', 'Could not submit your request. Please try again.');
        }
      } finally {
        setIsRequesting(false);
        setSelectedOrg(null);
      }
    },
    [requestMembership]
  );

  // ── Org detail sheet (mini) ────────────────────────────────────────────────
  const showOrgDetail = useCallback((org: Organization) => {
    setSelectedOrg(org);
    setUnitInput('');
  }, []);

  const inputStyle = [styles.input, { backgroundColor: Colors.surface, borderColor: Colors.border, color: Colors.slate }];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.root, { backgroundColor: Colors.background }]}>
        {/* Header */}
        <View
          style={[
            styles.header,
            {
              paddingTop: insets.top + (Platform.OS === 'android' ? 8 : 4),
              backgroundColor: Colors.surface,
              borderBottomColor: Colors.border,
            },
          ]}
        >
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.backBtn}>
            <ChevronLeft size={24} color={Colors.slate} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: Colors.slate }]}>Find Community</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Mode toggle */}
        <View style={[styles.modeToggle, { backgroundColor: Colors.surface, borderBottomColor: Colors.border }]}>
          {(['join', 'claim'] as Mode[]).map((m) => (
            <TouchableOpacity
              key={m}
              style={[
                styles.modeTab,
                mode === m && { borderBottomColor: Colors.primary, borderBottomWidth: 2 },
              ]}
              onPress={() => setMode(m)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.modeTabText,
                  { color: mode === m ? Colors.primary : Colors.slateLighter },
                ]}
              >
                {m === 'join' ? '🔍 Join a Community' : '🏗️ Claim My Community'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView
          style={styles.body}
          contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {mode === 'claim' ? (
            <ClaimForm />
          ) : (
            <>
              {/* Invite code toggle */}
              <TouchableOpacity
                style={[styles.inviteToggle, { backgroundColor: Colors.surface, borderColor: Colors.border }]}
                onPress={() => { setInviteCodeMode(!inviteCodeMode); setResults([]); setHasSearched(false); }}
                activeOpacity={0.75}
              >
                <Hash size={16} color={Colors.primary} />
                <Text style={[styles.inviteToggleText, { color: Colors.primary }]}>
                  {inviteCodeMode ? 'Search by name instead' : 'I have an invite code'}
                </Text>
              </TouchableOpacity>

              {inviteCodeMode ? (
                /* ── Invite code mode ── */
                <View style={styles.inviteCodeSection}>
                  <Text style={[styles.fieldLabel, { color: Colors.slateLighter }]}>Enter your 6-character invite code</Text>
                  <View style={styles.codeRow}>
                    <TextInput
                      style={[inputStyle, { flex: 1, letterSpacing: 4, textTransform: 'uppercase' }]}
                      placeholder="ABC123"
                      placeholderTextColor={Colors.slateLighter}
                      value={inviteCode}
                      onChangeText={(v) => setInviteCode(v.toUpperCase().slice(0, 6))}
                      autoCapitalize="characters"
                      maxLength={6}
                      returnKeyType="search"
                      onSubmitEditing={handleInviteSearch}
                    />
                    <TouchableOpacity
                      style={[styles.codeSearchBtn, { backgroundColor: Colors.primary }]}
                      onPress={handleInviteSearch}
                      disabled={isSearching}
                      activeOpacity={0.85}
                    >
                      {isSearching ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Search size={18} color="#fff" />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                /* ── Name search mode ── */
                <>
                  <View style={[styles.searchBar, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
                    <Search size={18} color={Colors.slateLighter} />
                    <TextInput
                      style={[styles.searchInput, { color: Colors.slate }]}
                      placeholder="Search by community name or city…"
                      placeholderTextColor={Colors.slateLighter}
                      value={searchQuery}
                      onChangeText={handleSearchChange}
                      autoFocus
                      returnKeyType="search"
                      onSubmitEditing={() => runSearch(searchQuery, typeFilter)}
                    />
                    {searchQuery.length > 0 ? (
                      <TouchableOpacity
                        onPress={() => { setSearchQuery(''); setResults([]); setHasSearched(false); }}
                        activeOpacity={0.7}
                      >
                        <X size={16} color={Colors.slateLighter} />
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {/* Type filter chips */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.typeFilters}
                  >
                    {ORG_TYPES.map((t) => (
                      <TouchableOpacity
                        key={t.type}
                        style={[
                          styles.filterChip,
                          {
                            backgroundColor: typeFilter === t.type ? Colors.primary + '22' : Colors.surface,
                            borderColor: typeFilter === t.type ? Colors.primary : Colors.border,
                          },
                        ]}
                        onPress={() => handleTypeFilter(t.type)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.filterChipEmoji}>{ORG_TYPE_EMOJIS[t.type]}</Text>
                        <Text
                          style={[styles.filterChipText, { color: typeFilter === t.type ? Colors.primary : Colors.slateLight }]}
                        >
                          {t.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  {/* Results */}
                  {isSearching ? (
                    <ActivityIndicator color={Colors.primary} style={{ marginTop: 24 }} />
                  ) : hasSearched && results.length === 0 ? (
                    <View style={[styles.noResults, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
                      <Building2 size={28} color={Colors.slateLighter} />
                      <Text style={[styles.noResultsTitle, { color: Colors.slateLight }]}>No communities found</Text>
                      <Text style={[styles.noResultsHint, { color: Colors.slateLighter }]}>
                        Try different keywords, or claim your community as an admin.
                      </Text>
                    </View>
                  ) : (
                    results.map((org) => (
                      <OrgCard key={org.id} org={org} onPress={() => showOrgDetail(org)} />
                    ))
                  )}

                  {!hasSearched && (
                    <Text style={[styles.hint, { color: Colors.slateLighter }]}>
                      Start typing to search for your HOA, condo, or apartment community.
                    </Text>
                  )}
                </>
              )}
            </>
          )}
        </ScrollView>

        {/* Org detail overlay */}
        {selectedOrg ? (
          <View style={[styles.orgOverlay, { backgroundColor: Colors.background + 'EE' }]}>
            <View style={[styles.orgDetailSheet, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
              <View style={styles.orgDetailHeader}>
                <Text style={styles.orgDetailEmoji}>{ORG_TYPE_EMOJIS[selectedOrg.type]}</Text>
                <View style={styles.orgDetailInfo}>
                  <Text style={[styles.orgDetailName, { color: Colors.slate }]}>{selectedOrg.name}</Text>
                  <Text style={[styles.orgDetailMeta, { color: Colors.slateLighter }]}>
                    {ORG_TYPE_DESCRIPTIONS[selectedOrg.type]}
                    {selectedOrg.city ? ` · ${selectedOrg.city}, ${selectedOrg.state}` : ''}
                  </Text>
                </View>
                {selectedOrg.isVerified ? <CheckCircle size={18} color={Colors.success} /> : null}
              </View>

              <Text style={[styles.fieldLabel, { color: Colors.slateLighter, marginTop: 16 }]}>
                Your unit number (optional)
              </Text>
              <TextInput
                style={inputStyle}
                placeholder="e.g. 4B"
                placeholderTextColor={Colors.slateLighter}
                value={unitInput}
                onChangeText={setUnitInput}
                autoCapitalize="characters"
                returnKeyType="done"
              />

              <View style={styles.orgDetailActions}>
                <TouchableOpacity
                  style={[styles.cancelBtn, { borderColor: Colors.border }]}
                  onPress={() => setSelectedOrg(null)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.cancelBtnText, { color: Colors.slateLight }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.joinBtn, { backgroundColor: isRequesting ? Colors.primary + '88' : Colors.primary }]}
                  onPress={() => handleJoinRequest(selectedOrg)}
                  disabled={isRequesting}
                  activeOpacity={0.85}
                >
                  {isRequesting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.joinBtnText}>Request to Join</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700' as const },

  modeToggle: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modeTabText: { fontSize: 13, fontWeight: '600' as const },

  body: { flex: 1, paddingHorizontal: 20, paddingTop: 20 },

  inviteToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  inviteToggleText: { fontSize: 13, fontWeight: '600' as const },

  inviteCodeSection: { marginBottom: 16 },
  codeRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  codeSearchBtn: { padding: 14, borderRadius: 10 },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  searchInput: { flex: 1, fontSize: 15 },

  typeFilters: { paddingBottom: 14, gap: 8 },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterChipEmoji: { fontSize: 14 },
  filterChipText: { fontSize: 13, fontWeight: '600' as const },

  orgCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  orgCardIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  orgCardEmoji: { fontSize: 20 },
  orgCardInfo: { flex: 1 },
  orgCardName: { fontSize: 15, fontWeight: '700' as const },
  orgCardMeta: { fontSize: 12, marginTop: 2 },

  noResults: {
    alignItems: 'center',
    gap: 10,
    padding: 32,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 8,
  },
  noResultsTitle: { fontSize: 16, fontWeight: '600' as const },
  noResultsHint: { fontSize: 13, textAlign: 'center' },

  hint: { fontSize: 13, textAlign: 'center', marginTop: 32, lineHeight: 20 },

  // ── Claim form ─────────────────────────────────────────────────────────────
  claimHeadline: { fontSize: 22, fontWeight: '800' as const, letterSpacing: -0.4, marginBottom: 8 },
  claimSubtext: { fontSize: 14, lineHeight: 20, marginBottom: 20 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
  },
  typeChipEmoji: { fontSize: 15 },
  typeChipLabel: { fontSize: 13, fontWeight: '600' as const },
  rowInputs: { flexDirection: 'row', gap: 8, marginBottom: 0 },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 24,
    marginBottom: 8,
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' as const },

  // ── Shared ─────────────────────────────────────────────────────────────────
  fieldLabel: { fontSize: 12, fontWeight: '600' as const, marginBottom: 6, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 9,
    fontSize: 15,
    marginBottom: 4,
  },

  // ── Org detail overlay ────────────────────────────────────────────────────
  orgOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 0,
  },
  orgDetailSheet: {
    width: '100%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    padding: 24,
    paddingBottom: 40,
  },
  orgDetailHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  orgDetailEmoji: { fontSize: 32 },
  orgDetailInfo: { flex: 1 },
  orgDetailName: { fontSize: 18, fontWeight: '800' as const },
  orgDetailMeta: { fontSize: 13, marginTop: 2 },
  orgDetailActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  cancelBtnText: { fontSize: 15, fontWeight: '600' as const },
  joinBtn: { flex: 2, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  joinBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' as const },
});
