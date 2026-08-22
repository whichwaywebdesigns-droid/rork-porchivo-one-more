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
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  Users,
  Shield,
  ChevronDown,
  UserPlus,
  RefreshCw,
  Mail,
  MoreHorizontal,
  Check,
  X,
  AlertTriangle,
  UserCheck,
  UserX,
  Copy,
  Crown,
  Wrench,
  Building2,
} from 'lucide-react-native';
import { useColors } from '@/constants/colors';
import { useOrganization } from '@/store/OrganizationContext';
import { useSubscriptionGate } from '@/hooks/useSubscriptionGate';
import { ReadOnlyNotice } from '@/components/BillingGraceBanner';
import { supabase } from '@/lib/supabase';
import {
  MemberAdminRow,
  OrgRole,
  OrgMembershipStatus,
  memberAdminRowFromRpc,
  ASSIGNABLE_ROLES,
  ORG_ROLE_LABELS,
  MEMBERSHIP_STATUS_LABELS,
  ORG_TYPE_LABELS,
} from '@/types/organization';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';

// ─── Role accent colors ────────────────────────────────────────────────────────

const ROLE_ACCENT: Record<OrgRole, string> = {
  resident:         '#6B7F99',
  board_member:     '#8B5CF6',
  hoa_admin:        '#3A7BD5',
  property_staff:   '#2E9B6F',
  property_manager: '#E07B00',
  super_admin:      '#C2410C',
};

const ROLE_ICON: Record<OrgRole, React.ReactNode> = {
  resident:         <Users size={12} color="#6B7F99" />,
  board_member:     <Crown size={12} color="#8B5CF6" />,
  hoa_admin:        <Shield size={12} color="#3A7BD5" />,
  property_staff:   <Wrench size={12} color="#2E9B6F" />,
  property_manager: <Building2 size={12} color="#E07B00" />,
  super_admin:      <Shield size={12} color="#C2410C" />,
};

// ─── Status config ─────────────────────────────────────────────────────────────

type FilterTab = 'all' | 'active' | 'pending' | 'suspended';

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all',       label: 'All' },
  { key: 'active',    label: 'Active' },
  { key: 'pending',   label: 'Pending' },
  { key: 'suspended', label: 'Suspended' },
];

function statusColor(status: OrgMembershipStatus, Colors: ReturnType<typeof useColors>): string {
  switch (status) {
    case 'active':    return Colors.success;
    case 'pending':   return Colors.gold;
    case 'suspended': return Colors.danger;
    case 'removed':   return Colors.slateLighter;
  }
}

// ─── Avatar bubble ─────────────────────────────────────────────────────────────

function AvatarBubble({ initials, color, avatarUrl, size = 44 }: { initials: string; color: string; avatarUrl?: string | null; size?: number }) {
  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 1.5, borderColor: color + '55' }}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={120}
      />
    );
  }
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: color + '22', borderWidth: 1.5, borderColor: color + '50',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ fontSize: size * 0.33, fontWeight: '700' as const, color }}>{initials}</Text>
    </View>
  );
}

// ─── Role badge ────────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: OrgRole }) {
  const accent = ROLE_ACCENT[role];
  return (
    <View style={[styles.roleBadge, { backgroundColor: accent + '18', borderColor: accent + '45' }]}>
      {ROLE_ICON[role]}
      <Text style={[styles.roleBadgeText, { color: accent }]}>{ORG_ROLE_LABELS[role]}</Text>
    </View>
  );
}

// ─── Role picker sheet ────────────────────────────────────────────────────────

function RolePickerSheet({
  visible,
  currentRole,
  memberName,
  onSelect,
  onClose,
}: {
  visible: boolean;
  currentRole: OrgRole;
  memberName: string;
  onSelect: (role: OrgRole) => void;
  onClose: () => void;
}) {
  const Colors = useColors();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(400)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 10 }).start();
    } else {
      Animated.timing(slideAnim, { toValue: 400, duration: 220, useNativeDriver: true }).start();
    }
  }, [visible, slideAnim]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Animated.View
          style={[
            styles.roleSheet,
            { backgroundColor: Colors.surface, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <Pressable>
            <View style={[styles.roleSheetHandle, { backgroundColor: Colors.border }]} />
            <Text style={[styles.roleSheetTitle, { color: Colors.slate }]}>Change Role</Text>
            <Text style={[styles.roleSheetSub, { color: Colors.slateLighter }]}>
              {memberName}
            </Text>

            <View style={styles.roleList}>
              {ASSIGNABLE_ROLES.map((role) => {
                const accent = ROLE_ACCENT[role];
                const isSelected = role === currentRole;
                return (
                  <TouchableOpacity
                    key={role}
                    style={[
                      styles.roleRow,
                      {
                        backgroundColor: isSelected ? accent + '14' : Colors.elevated,
                        borderColor: isSelected ? accent + '55' : Colors.border,
                      },
                    ]}
                    onPress={() => { onSelect(role); onClose(); }}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.roleRowIcon, { backgroundColor: accent + '20' }]}>
                      {ROLE_ICON[role]}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.roleRowLabel, { color: Colors.slate }]}>
                        {ORG_ROLE_LABELS[role]}
                      </Text>
                      <Text style={[styles.roleRowDesc, { color: Colors.slateLighter }]}>
                        {ROLE_DESCRIPTIONS[role]}
                      </Text>
                    </View>
                    {isSelected ? (
                      <Check size={16} color={accent} strokeWidth={2.5} />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[styles.cancelBtn, { borderColor: Colors.border, marginBottom: insets.bottom + 8 }]}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={[styles.cancelBtnText, { color: Colors.slateLight }]}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const ROLE_DESCRIPTIONS: Record<OrgRole, string> = {
  resident:         'Standard community member',
  board_member:     'Can post announcements and view full directory',
  property_staff:   'Can log packages and manage operations',
  property_manager: 'Manages properties, units, and staff',
  hoa_admin:        'Full administrative access',
  super_admin:      'Platform-level super administrator',
};

// ─── Invite sheet ──────────────────────────────────────────────────────────────

function InviteSheet({
  visible,
  onClose,
  onInvite,
  isLoading,
}: {
  visible: boolean;
  onClose: () => void;
  onInvite: (email: string, role: OrgRole) => void;
  isLoading: boolean;
}) {
  const Colors = useColors();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(500)).current;
  const [email, setEmail] = useState<string>('');
  const [role, setRole] = useState<OrgRole>('resident');
  const [showRolePicker, setShowRolePicker] = useState<boolean>(false);

  React.useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 10 }).start();
    } else {
      Animated.timing(slideAnim, { toValue: 500, duration: 220, useNativeDriver: true }).start();
      setEmail('');
      setRole('resident');
      setShowRolePicker(false);
    }
  }, [visible, slideAnim]);

  const canSubmit = email.trim().includes('@');

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%' }}>
          <Animated.View
            style={[
              styles.inviteSheet,
              { backgroundColor: Colors.surface, transform: [{ translateY: slideAnim }] },
            ]}
          >
            <Pressable>
              <View style={[styles.roleSheetHandle, { backgroundColor: Colors.border }]} />

              <View style={styles.inviteHeader}>
                <View style={[styles.inviteIconWrap, { backgroundColor: Colors.primary + '18' }]}>
                  <UserPlus size={22} color={Colors.primary} />
                </View>
                <Text style={[styles.roleSheetTitle, { color: Colors.slate, marginTop: 0 }]}>
                  Invite Member
                </Text>
                <Text style={[styles.roleSheetSub, { color: Colors.slateLighter }]}>
                  They must already have a Porchivo account
                </Text>
              </View>

              {/* Email input */}
              <View style={[styles.inputWrap, { borderColor: Colors.border, backgroundColor: Colors.elevated }]}>
                <Mail size={16} color={Colors.slateLighter} />
                <TextInput
                  style={[styles.input, { color: Colors.slate }]}
                  placeholder="member@email.com"
                  placeholderTextColor={Colors.slateLighter}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              {/* Role selector */}
              <TouchableOpacity
                style={[styles.roleSelector, { borderColor: Colors.border, backgroundColor: Colors.elevated }]}
                onPress={() => setShowRolePicker(true)}
                activeOpacity={0.75}
              >
                <View style={[styles.roleRowIcon, { backgroundColor: ROLE_ACCENT[role] + '20' }]}>
                  {ROLE_ICON[role]}
                </View>
                <Text style={[styles.roleSelectorText, { color: Colors.slate }]}>
                  {ORG_ROLE_LABELS[role]}
                </Text>
                <ChevronDown size={16} color={Colors.slateLighter} />
              </TouchableOpacity>

              {/* Inline role picker */}
              {showRolePicker ? (
                <View style={[styles.inlineRolePicker, { borderColor: Colors.border, backgroundColor: Colors.background }]}>
                  {ASSIGNABLE_ROLES.map((r) => {
                    const acc = ROLE_ACCENT[r];
                    return (
                      <TouchableOpacity
                        key={r}
                        style={[
                          styles.inlineRoleRow,
                          { borderBottomColor: Colors.border },
                          r === role ? { backgroundColor: acc + '12' } : undefined,
                        ]}
                        onPress={() => { setRole(r); setShowRolePicker(false); }}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.inlineRoleLabel, { color: r === role ? acc : Colors.slateLight }]}>
                          {ORG_ROLE_LABELS[r]}
                        </Text>
                        {r === role ? <Check size={14} color={acc} strokeWidth={2.5} /> : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : null}

              {/* Submit */}
              <TouchableOpacity
                style={[
                  styles.inviteSubmit,
                  { backgroundColor: canSubmit ? Colors.primary : Colors.border, marginBottom: insets.bottom + 8 },
                ]}
                onPress={() => canSubmit && !isLoading && onInvite(email.trim(), role)}
                activeOpacity={0.85}
                disabled={!canSubmit || isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <UserPlus size={16} color="#fff" />
                    <Text style={styles.inviteSubmitText}>Send Invite</Text>
                  </>
                )}
              </TouchableOpacity>
            </Pressable>
          </Animated.View>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

// ─── Member card ───────────────────────────────────────────────────────────────

function MemberCard({
  member,
  isMe,
  canManage,
  onChangeRole,
  onSuspend,
  onReinstate,
  onRemove,
}: {
  member: MemberAdminRow;
  isMe: boolean;
  canManage: boolean;
  onChangeRole: () => void;
  onSuspend: () => void;
  onReinstate: () => void;
  onRemove: () => void;
}) {
  const Colors = useColors();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [menuOpen, setMenuOpen] = useState<boolean>(false);

  const press = (cb: () => void) => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.97, duration: 70, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start(() => cb());
  };

  const statusDotColor = statusColor(member.status, Colors);

  return (
    <Animated.View
      style={[
        styles.memberCard,
        { backgroundColor: Colors.surface, borderColor: Colors.border },
        { transform: [{ scale: scaleAnim }] },
      ]}
    >
      <TouchableOpacity
        style={styles.memberCardInner}
        onPress={() => press(() => {})}
        activeOpacity={0.85}
      >
        {/* Avatar */}
        <AvatarBubble
          initials={member.initials}
          color={member.avatarColor}
          avatarUrl={member.avatarUrl}
        />

        {/* Info */}
        <View style={styles.memberInfo}>
          <View style={styles.memberNameRow}>
            <Text style={[styles.memberName, { color: Colors.slate }]} numberOfLines={1}>
              {member.displayName}
              {isMe ? (
                <Text style={[styles.meTag, { color: Colors.primary }]}> (you)</Text>
              ) : null}
            </Text>
            {/* Status dot */}
            <View style={[styles.statusDot, { backgroundColor: statusDotColor }]} />
          </View>

          <View style={styles.memberMetaRow}>
            <RoleBadge role={member.role} />
            {member.unitNumber ? (
              <Text style={[styles.unitChip, { color: Colors.slateLighter, backgroundColor: Colors.elevated }]}>
                Unit {member.unitNumber}
              </Text>
            ) : null}
          </View>

          {member.email ? (
            <Text style={[styles.memberEmail, { color: Colors.slateLighter }]} numberOfLines={1}>
              {member.email}
            </Text>
          ) : null}
        </View>

        {/* Context menu trigger */}
        {canManage && !isMe ? (
          <TouchableOpacity
            style={[styles.menuBtn, { backgroundColor: Colors.elevated }]}
            onPress={() => setMenuOpen(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <MoreHorizontal size={18} color={Colors.slateLight} />
          </TouchableOpacity>
        ) : null}
      </TouchableOpacity>

      {/* Inline action menu */}
      {menuOpen ? (
        <View style={[styles.actionMenu, { backgroundColor: Colors.elevated, borderColor: Colors.border }]}>
          <TouchableOpacity
            style={styles.actionMenuItem}
            onPress={() => { setMenuOpen(false); onChangeRole(); }}
            activeOpacity={0.7}
          >
            <Shield size={14} color={Colors.primary} />
            <Text style={[styles.actionMenuText, { color: Colors.slate }]}>Change Role</Text>
          </TouchableOpacity>

          {member.status === 'active' ? (
            <TouchableOpacity
              style={[styles.actionMenuItem, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border }]}
              onPress={() => { setMenuOpen(false); onSuspend(); }}
              activeOpacity={0.7}
            >
              <AlertTriangle size={14} color={Colors.gold} />
              <Text style={[styles.actionMenuText, { color: Colors.slate }]}>Suspend</Text>
            </TouchableOpacity>
          ) : null}

          {member.status === 'suspended' ? (
            <TouchableOpacity
              style={[styles.actionMenuItem, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border }]}
              onPress={() => { setMenuOpen(false); onReinstate(); }}
              activeOpacity={0.7}
            >
              <UserCheck size={14} color={Colors.success} />
              <Text style={[styles.actionMenuText, { color: Colors.slate }]}>Reinstate</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={[styles.actionMenuItem, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border }]}
            onPress={() => { setMenuOpen(false); onRemove(); }}
            activeOpacity={0.7}
          >
            <UserX size={14} color={Colors.danger} />
            <Text style={[styles.actionMenuText, { color: Colors.danger }]}>Remove</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionMenuItem, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border }]}
            onPress={() => setMenuOpen(false)}
            activeOpacity={0.7}
          >
            <X size={14} color={Colors.slateLighter} />
            <Text style={[styles.actionMenuText, { color: Colors.slateLighter }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function RoleManagementScreen() {
  const Colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const {
    activeOrg,
    activeMembership,
    orgRole,
    assignMemberRole,
    isAssigningMemberRole,
    suspendMember,
    reinstateMember,
    removeMember,
    inviteMemberByEmail,
    isInvitingMember,
    regenerateInviteCode,
    isRegeneratingInviteCode,
  } = useOrganization();
  // Billing grace period — stage 2 (day 14+): member/role administration is
  // read-only for managers. Views stay live; mutations are blocked.
  const { isManagerAdminReadOnly } = useSubscriptionGate();

  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [rolePicker, setRolePicker] = useState<{ member: MemberAdminRow } | null>(null);
  const [showInvite, setShowInvite] = useState<boolean>(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // ── Fetch all members ──────────────────────────────────────────────────────
  const { data: members = [], isLoading } = useQuery<MemberAdminRow[]>({
    queryKey: ['org-members-admin', activeOrg?.id],
    queryFn: async () => {
      if (!activeOrg?.id) return [];
      const { data, error } = await supabase.rpc('get_org_members_admin', {
        p_org_id: activeOrg.id,
      });
      if (error || !data) return [];
      return (data as Record<string, unknown>[]).map(memberAdminRowFromRpc);
    },
    enabled: !!activeOrg?.id,
    staleTime: 1000 * 60 * 1,
  });

  // ── Filter ────────────────────────────────────────────────────────────────
  const filtered = filterTab === 'all'
    ? members
    : members.filter((m) => m.status === filterTab);

  // ── Counts for filter pills ───────────────────────────────────────────────
  const counts = {
    all:       members.length,
    active:    members.filter((m) => m.status === 'active').length,
    pending:   members.filter((m) => m.status === 'pending').length,
    suspended: members.filter((m) => m.status === 'suspended').length,
  };

  // ── Refresh ───────────────────────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['org-members-admin', activeOrg?.id] });
    setRefreshing(false);
  }, [queryClient, activeOrg?.id]);

  // ── Role change ───────────────────────────────────────────────────────────
  const handleRoleChange = useCallback(
    async (member: MemberAdminRow, newRole: OrgRole) => {
      if (newRole === member.role) return;
      // Billing grace stage 2: role changes are manager admin writes
      if (isManagerAdminReadOnly) return;
      setProcessingId(member.membershipId);
      try {
        await assignMemberRole({ membershipId: member.membershipId, newRole });
      } catch {
        Alert.alert('Error', 'Could not update role. Please try again.');
      } finally {
        setProcessingId(null);
      }
    },
    [assignMemberRole, isManagerAdminReadOnly]
  );

  // ── Suspend ───────────────────────────────────────────────────────────────
  const handleSuspend = useCallback(
    (member: MemberAdminRow) => {
      // Billing grace stage 2: suspensions are manager admin writes
      if (isManagerAdminReadOnly) return;
      Alert.alert(
        'Suspend Member',
        `Suspend ${member.displayName}? They will lose access until reinstated.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Suspend',
            style: 'destructive',
            onPress: async () => {
              setProcessingId(member.membershipId);
              try {
                await suspendMember({ membershipId: member.membershipId });
              } catch {
                Alert.alert('Error', 'Could not suspend member.');
              } finally {
                setProcessingId(null);
              }
            },
          },
        ]
      );
    },
    [suspendMember, isManagerAdminReadOnly]
  );

  // ── Reinstate ─────────────────────────────────────────────────────────────
  const handleReinstate = useCallback(
    (member: MemberAdminRow) => {
      // Billing grace stage 2: reinstatements are manager admin writes
      if (isManagerAdminReadOnly) return;
      Alert.alert(
        'Reinstate Member',
        `Restore access for ${member.displayName}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Reinstate',
            style: 'default',
            onPress: async () => {
              setProcessingId(member.membershipId);
              try {
                await reinstateMember({ membershipId: member.membershipId });
              } catch {
                Alert.alert('Error', 'Could not reinstate member.');
              } finally {
                setProcessingId(null);
              }
            },
          },
        ]
      );
    },
    [reinstateMember, isManagerAdminReadOnly]
  );

  // ── Remove ────────────────────────────────────────────────────────────────
  const handleRemove = useCallback(
    (member: MemberAdminRow) => {
      // Billing grace stage 2: removals are manager admin writes
      if (isManagerAdminReadOnly) return;
      Alert.alert(
        'Remove Member',
        `Permanently remove ${member.displayName} from ${activeOrg?.name ?? 'this community'}? This cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: async () => {
              setProcessingId(member.membershipId);
              try {
                await removeMember({ membershipId: member.membershipId });
              } catch {
                Alert.alert('Error', 'Could not remove member.');
              } finally {
                setProcessingId(null);
              }
            },
          },
        ]
      );
    },
    [removeMember, activeOrg?.name, isManagerAdminReadOnly]
  );

  // ── Invite by email ───────────────────────────────────────────────────────
  const handleInvite = useCallback(
    async (email: string, role: OrgRole) => {
      // Billing grace stage 2: invites are manager admin writes
      if (isManagerAdminReadOnly) return;
      try {
        const result = await inviteMemberByEmail({ email, role });
        setShowInvite(false);
        if (result === null) {
          Alert.alert(
            'User Not Found',
            `No Porchivo account was found for ${email}. Ask them to download the app and create an account first.`
          );
        } else {
          Alert.alert('Invited!', `${email} has been added as ${ORG_ROLE_LABELS[role]}.`);
        }
      } catch {
        Alert.alert('Error', 'Could not complete invite. Please try again.');
      }
    },
    [inviteMemberByEmail, isManagerAdminReadOnly]
  );

  // ── Regenerate invite code ────────────────────────────────────────────────
  const handleRegenerateCode = useCallback(() => {
    // Billing grace stage 2: invite-code regeneration is a manager admin write
    if (isManagerAdminReadOnly) return;
    Alert.alert(
      'Regenerate Invite Code',
      'The current code will stop working immediately. Share the new code with members who need to join.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Regenerate',
          style: 'default',
          onPress: async () => {
            try {
              const newCode = await regenerateInviteCode();
              Alert.alert('New Code Generated', `Your new invite code is: ${newCode}`);
            } catch {
              Alert.alert('Error', 'Could not regenerate code.');
            }
          },
        },
      ]
    );
  }, [regenerateInviteCode, isManagerAdminReadOnly]);

  // ── Copy invite code ──────────────────────────────────────────────────────
  const handleCopyCode = useCallback(async () => {
    if (!activeOrg?.inviteCode) return;
    await Clipboard.setStringAsync(activeOrg.inviteCode);
    Alert.alert('Copied', `Invite code ${activeOrg.inviteCode} copied to clipboard.`);
  }, [activeOrg?.inviteCode]);

  if (!activeOrg || !activeMembership) {
    return (
      <View style={[styles.root, { backgroundColor: Colors.background }]}>
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 80 }} />
      </View>
    );
  }

  const myId = activeMembership.userId;

  return (
    <View style={[styles.root, { backgroundColor: Colors.background }]}>
      {/* ── Header ────────────────────────────────────────────────────────── */}
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
          <Text style={[styles.headerTitle, { color: Colors.slate }]}>Role Management</Text>
          <Text style={[styles.headerSub, { color: Colors.slateLighter }]}>
            {activeOrg.name}
          </Text>
        </View>

        {/* Invite FAB in header */}
        <TouchableOpacity
          style={[styles.inviteBtn, { backgroundColor: Colors.primary }]}
          onPress={() => setShowInvite(true)}
          activeOpacity={0.85}
          disabled={isManagerAdminReadOnly}
        >
          <UserPlus size={16} color="#fff" strokeWidth={2.2} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />
        }
      >
        {/* ── Billing grace — manager read-only notice (stage 2) ─────────── */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
          <ReadOnlyNotice variant="manager" />
        </View>

        {/* ── Invite code strip ──────────────────────────────────────────── */}
        {activeOrg.inviteCode ? (
          <View style={[styles.codeStrip, { backgroundColor: Colors.primary + '10', borderColor: Colors.primary + '30' }]}>
            <View style={styles.codeStripLeft}>
              <Shield size={16} color={Colors.primary} />
              <View>
                <Text style={[styles.codeLabel, { color: Colors.slateLighter }]}>Community Invite Code</Text>
                <Text style={[styles.codeValue, { color: Colors.primary }]}>{activeOrg.inviteCode}</Text>
              </View>
            </View>
            <View style={styles.codeActions}>
              <TouchableOpacity
                style={[styles.codeBtn, { backgroundColor: Colors.surface, borderColor: Colors.border }]}
                onPress={handleCopyCode}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Copy size={14} color={Colors.slateLight} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.codeBtn, { backgroundColor: Colors.surface, borderColor: Colors.border }]}
                onPress={handleRegenerateCode}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                {isRegeneratingInviteCode ? (
                  <ActivityIndicator size="small" color={Colors.slateLight} />
                ) : (
                  <RefreshCw size={14} color={Colors.slateLight} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {/* ── Summary pills ────────────────────────────────────────────────── */}
        <View style={styles.summaryRow}>
          {[
            { label: 'Total', value: counts.all, color: Colors.primary },
            { label: 'Active', value: counts.active, color: Colors.success },
            { label: 'Pending', value: counts.pending, color: Colors.gold },
            { label: 'Suspended', value: counts.suspended, color: Colors.danger },
          ].map((s) => (
            <View key={s.label} style={[styles.summaryPill, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
              <Text style={[styles.summaryValue, { color: s.color }]}>{s.value}</Text>
              <Text style={[styles.summaryLabel, { color: Colors.slateLighter }]}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* ── Filter tabs ───────────────────────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {FILTER_TABS.map(({ key, label }) => {
            const isActive = filterTab === key;
            const count = counts[key];
            return (
              <TouchableOpacity
                key={key}
                style={[
                  styles.filterTab,
                  {
                    backgroundColor: isActive ? Colors.primary : Colors.surface,
                    borderColor: isActive ? Colors.primary : Colors.border,
                  },
                ]}
                onPress={() => setFilterTab(key)}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.filterTabText,
                    { color: isActive ? '#fff' : Colors.slateLight },
                  ]}
                >
                  {label}
                </Text>
                {count > 0 ? (
                  <View
                    style={[
                      styles.filterCount,
                      { backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : Colors.elevated },
                    ]}
                  >
                    <Text style={[styles.filterCountText, { color: isActive ? '#fff' : Colors.slateLight }]}>
                      {count}
                    </Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Member list ───────────────────────────────────────────────────── */}
        <View style={styles.listContainer}>
          {isLoading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginVertical: 32 }} />
          ) : filtered.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
              <Users size={28} color={Colors.slateLighter} />
              <Text style={[styles.emptyStateText, { color: Colors.slateLight }]}>
                No {filterTab === 'all' ? 'members' : filterTab + ' members'} found
              </Text>
            </View>
          ) : (
            filtered.map((member) => {
              const isProcessing = processingId === member.membershipId && (isAssigningMemberRole);
              if (isProcessing) {
                return (
                  <View
                    key={member.membershipId}
                    style={[styles.memberCard, { backgroundColor: Colors.surface, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center', paddingVertical: 20 }]}
                  >
                    <ActivityIndicator size="small" color={Colors.primary} />
                  </View>
                );
              }
              return (
                <MemberCard
                  key={member.membershipId}
                  member={member}
                  isMe={member.userId === myId}
                  canManage={
                    (orgRole === 'hoa_admin' || orgRole === 'super_admin') &&
                    member.role !== 'super_admin'
                  }
                  onChangeRole={() => setRolePicker({ member })}
                  onSuspend={() => handleSuspend(member)}
                  onReinstate={() => handleReinstate(member)}
                  onRemove={() => handleRemove(member)}
                />
              );
            })
          )}
        </View>

        {/* ── Role legend ───────────────────────────────────────────────────── */}
        <View style={[styles.legend, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
          <Text style={[styles.legendTitle, { color: Colors.slate }]}>Role Reference</Text>
          {ASSIGNABLE_ROLES.map((role) => {
            const acc = ROLE_ACCENT[role];
            return (
              <View key={role} style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: acc }]} />
                <Text style={[styles.legendRole, { color: Colors.slate }]}>{ORG_ROLE_LABELS[role]}</Text>
                <Text style={[styles.legendDesc, { color: Colors.slateLighter }]}>{ROLE_DESCRIPTIONS[role]}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* ── Role picker sheet ──────────────────────────────────────────────── */}
      {rolePicker ? (
        <RolePickerSheet
          visible={true}
          currentRole={rolePicker.member.role}
          memberName={rolePicker.member.displayName}
          onSelect={(newRole) => handleRoleChange(rolePicker.member, newRole)}
          onClose={() => setRolePicker(null)}
        />
      ) : null}

      {/* ── Invite sheet ───────────────────────────────────────────────────── */}
      <InviteSheet
        visible={showInvite}
        onClose={() => setShowInvite(false)}
        onInvite={handleInvite}
        isLoading={isInvitingMember}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

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
  inviteBtn: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },

  // Invite code strip
  codeStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  codeStripLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  codeLabel: { fontSize: 11, marginBottom: 2 },
  codeValue: { fontSize: 18, fontWeight: '800' as const, letterSpacing: 3 },
  codeActions: { flexDirection: 'row', gap: 8 },
  codeBtn: {
    width: 32, height: 32, borderRadius: 8,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },

  // Summary
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  summaryPill: {
    flex: 1, alignItems: 'center', paddingVertical: 12,
    borderRadius: 12, borderWidth: 1, gap: 2,
  },
  summaryValue: { fontSize: 20, fontWeight: '800' as const },
  summaryLabel: { fontSize: 10, fontWeight: '600' as const },

  // Filter
  filterRow: { paddingHorizontal: 20, paddingVertical: 14, gap: 8 },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  filterTabText: { fontSize: 13, fontWeight: '600' as const },
  filterCount: {
    minWidth: 20, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5,
  },
  filterCountText: { fontSize: 10, fontWeight: '700' as const },

  // Member list
  listContainer: { paddingHorizontal: 20, gap: 8 },

  memberCard: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
    overflow: 'hidden',
  },
  memberCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  memberInfo: { flex: 1 },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 5,
  },
  memberName: { fontSize: 15, fontWeight: '700' as const, flex: 1 },
  meTag: { fontSize: 13, fontWeight: '500' as const },
  statusDot: { width: 7, height: 7, borderRadius: 3.5 },
  memberMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  memberEmail: { fontSize: 11, marginTop: 4 },
  menuBtn: {
    width: 32, height: 32, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },

  // Role badge
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  roleBadgeText: { fontSize: 10, fontWeight: '700' as const },

  // Unit chip
  unitChip: {
    fontSize: 10,
    fontWeight: '600' as const,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },

  // Action menu
  actionMenu: {
    marginHorizontal: 14,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  actionMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  actionMenuText: { fontSize: 14, fontWeight: '500' as const },

  // Empty state
  emptyState: {
    alignItems: 'center',
    gap: 10,
    padding: 36,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  emptyStateText: { fontSize: 14 },

  // Legend
  legend: {
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  legendTitle: { fontSize: 13, fontWeight: '700' as const, marginBottom: 4 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendRole: { fontSize: 12, fontWeight: '600' as const, width: 100 },
  legendDesc: { fontSize: 11, flex: 1 },

  // Modal backdrop
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },

  // Role picker sheet
  roleSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  roleSheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    alignSelf: 'center', marginBottom: 20,
  },
  roleSheetTitle: {
    fontSize: 18, fontWeight: '800' as const,
    letterSpacing: -0.3, marginTop: 4, marginBottom: 4,
  },
  roleSheetSub: { fontSize: 13, marginBottom: 16 },
  roleList: { gap: 8, marginBottom: 14 },
  roleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 12, borderWidth: 1,
  },
  roleRowIcon: {
    width: 30, height: 30, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  roleRowLabel: { fontSize: 14, fontWeight: '700' as const },
  roleRowDesc: { fontSize: 11, marginTop: 2 },

  // Cancel btn
  cancelBtn: {
    paddingVertical: 14, borderRadius: 12,
    borderWidth: 1, alignItems: 'center', marginTop: 4,
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600' as const },

  // Invite sheet
  inviteSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  inviteHeader: { alignItems: 'center', marginBottom: 16, gap: 6 },
  inviteIconWrap: {
    width: 52, height: 52, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 12, borderWidth: 1, marginBottom: 10,
  },
  input: { flex: 1, fontSize: 15 },
  roleSelector: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 12, borderWidth: 1, marginBottom: 8,
  },
  roleSelectorText: { flex: 1, fontSize: 14, fontWeight: '600' as const },
  inlineRolePicker: {
    borderRadius: 12, borderWidth: 1,
    overflow: 'hidden', marginBottom: 8,
  },
  inlineRoleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  inlineRoleLabel: { fontSize: 13, fontWeight: '600' as const },
  inviteSubmit: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 15, borderRadius: 12,
    justifyContent: 'center', marginTop: 4,
  },
  inviteSubmitText: { color: '#fff', fontWeight: '700' as const, fontSize: 15 },
});
