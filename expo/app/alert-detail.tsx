import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  Platform,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  AlertTriangle,
  Package,
  Car,
  User,
  HelpCircle,
  MapPin,
  Clock,
  Shield,
  CheckCircle,
  BellOff,
  Flag,
  ChevronLeft,
  Ban,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useAlerts, getCategoryLabel, getCategoryColor } from '@/store/AlertsContext';
import { SuspiciousActivityCategory } from '@/types';
import * as Haptics from 'expo-haptics';
import { log } from "@/lib/logger";

function formatFullTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getCategoryIcon(category: SuspiciousActivityCategory, size: number, color: string) {
  switch (category) {
    case 'suspicious_person': return <User size={size} color={color} />;
    case 'package_taken': return <Package size={size} color={color} />;
    case 'unknown_vehicle': return <Car size={size} color={color} />;
    case 'other': return <HelpCircle size={size} color={color} />;
  }
}

export default function AlertDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { alerts, resolveAlert, muteAlert, reportAbuse, isAlertMuted, isAlertReported, blockUser, isUserBlocked } = useAlerts();

  const alert = useMemo(() => alerts.find(a => a.id === id), [alerts, id]);
  const muted = isAlertMuted(id ?? '');
  const reported = isAlertReported(id ?? '');
  const alertUserId = alert?.userId ?? '';
  const blocked = isUserBlocked(alertUserId);

  const handleResolve = useCallback(() => {
    if (!alert) return;
    Alert.alert(
      'Mark as Resolved',
      'This will de-emphasize this alert in the feed. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Resolve',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            resolveAlert(alert.id);
            log('[AlertDetail] Alert resolved:', alert.id);
          },
        },
      ],
    );
  }, [alert, resolveAlert]);

  const handleMute = useCallback(() => {
    if (!alert) return;
    if (muted) {
      Alert.alert('Already muted', 'You have already muted this alert.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    muteAlert(alert.id);
    Alert.alert('Muted', 'You will not receive future updates about this alert.');
    log('[AlertDetail] Alert muted:', alert.id);
  }, [alert, muted, muteAlert]);

  const handleReport = useCallback(() => {
    if (!alert) return;
    if (reported) {
      Alert.alert('Already reported', 'You have already reported this alert.');
      return;
    }
    Alert.alert(
      'Report Abuse',
      'Flag this alert as inappropriate or false? Our team will review it.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            reportAbuse(alert.id);
            Alert.alert('Reported', 'Thank you. Our team will review this alert.');
            log('[AlertDetail] Alert reported:', alert.id);
          },
        },
      ],
    );
  }, [alert, reported, reportAbuse]);

  const handleBlockUser = useCallback(() => {
    if (!alert) return;
    if (blocked) {
      Alert.alert('Already blocked', 'You have already blocked this user.');
      return;
    }
    Alert.alert(
      'Block This User',
      'You will no longer see alerts from this user. You can unblock them later from your profile settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block User',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            blockUser(alert.userId);
            Alert.alert('User Blocked', 'You will no longer see alerts from this user.');
            log('[AlertDetail] User blocked:', alert.userId);
          },
        },
      ],
    );
  }, [alert, blocked, blockUser]);

  if (!alert) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Alert Detail' }} />
        <View style={styles.notFound}>
          <AlertTriangle size={36} color={Colors.slateLighter} />
          <Text style={styles.notFoundText}>Alert not found</Text>
        </View>
      </View>
    );
  }

  const colors = getCategoryColor(alert.category);
  const isResolved = alert.status === 'resolved';

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Alert Detail',
        }}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroSection}>
          <View style={[styles.heroIconWrap, { backgroundColor: colors.bg }]}>
            {getCategoryIcon(alert.category, 28, colors.fg)}
          </View>

          <View style={styles.categoryBadge}>
            <Text style={[styles.categoryBadgeText, { color: colors.fg }]}>
              {getCategoryLabel(alert.category)}
            </Text>
          </View>

          {isResolved && (
            <View style={styles.resolvedChip}>
              <CheckCircle size={14} color="#2E7D32" />
              <Text style={styles.resolvedChipText}>Resolved</Text>
            </View>
          )}

          <Text style={styles.timeAgo}>{formatRelativeTime(alert.createdAt)}</Text>
        </View>

        <View style={styles.detailCard}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.descriptionText}>{alert.description}</Text>
        </View>

        {alert.photoUrl && (
          <View style={styles.detailCard}>
            <Text style={styles.sectionTitle}>Photo</Text>
            <Image
              source={{ uri: alert.photoUrl }}
              style={styles.photo}
              resizeMode="cover"
            />
          </View>
        )}

        <View style={styles.detailCard}>
          <Text style={styles.sectionTitle}>Location & Time</Text>
          <View style={styles.infoRow}>
            <MapPin size={16} color={Colors.slateLight} />
            <Text style={styles.infoText}>{alert.approximateLocation}</Text>
          </View>
          <View style={styles.infoRow}>
            <Clock size={16} color={Colors.slateLight} />
            <Text style={styles.infoText}>{formatFullTime(alert.createdAt)}</Text>
          </View>
          {alert.resolvedAt && (
            <View style={styles.infoRow}>
              <CheckCircle size={16} color="#2E7D32" />
              <Text style={[styles.infoText, { color: '#2E7D32' }]}>
                Resolved {formatFullTime(alert.resolvedAt)}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.privacyNote}>
          <Shield size={14} color={Colors.primary} />
          <Text style={styles.privacyText}>
            No exact addresses or personal information is shared. These are neighbor-to-neighbor tips to keep your block safe.
          </Text>
        </View>

        <View style={styles.actionsSection}>
          <Text style={styles.actionsTitle}>Actions</Text>

          {!isResolved && (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={handleResolve}
              activeOpacity={0.7}
              testID="resolve-alert-btn"
            >
              <View style={[styles.actionIconWrap, { backgroundColor: '#E8F5E9' }]}>
                <CheckCircle size={18} color="#2E7D32" />
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.actionLabel}>Mark as Resolved</Text>
                <Text style={styles.actionDesc}>De-emphasize this alert in the feed</Text>
              </View>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.actionBtn, muted && styles.actionBtnDisabled]}
            onPress={handleMute}
            activeOpacity={0.7}
            testID="mute-alert-btn"
          >
            <View style={[styles.actionIconWrap, { backgroundColor: '#FFF8E1' }]}>
              <BellOff size={18} color="#F57F17" />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionLabel}>{muted ? 'Muted' : 'Mute Future Alerts'}</Text>
              <Text style={styles.actionDesc}>Stop receiving updates about this alert</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, reported && styles.actionBtnDisabled]}
            onPress={handleReport}
            activeOpacity={0.7}
            testID="report-abuse-btn"
          >
            <View style={[styles.actionIconWrap, { backgroundColor: '#FFEBEE' }]}>
              <Flag size={18} color="#C62828" />
            </View>
            <View style={styles.actionContent}>
              <Text style={[styles.actionLabel, { color: reported ? Colors.slateLighter : '#C62828' }]}>
                {reported ? 'Reported' : 'Report Abuse'}
              </Text>
              <Text style={styles.actionDesc}>Flag this alert as inappropriate or false</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, blocked && styles.actionBtnDisabled]}
            onPress={handleBlockUser}
            activeOpacity={0.7}
            testID="block-user-btn"
          >
            <View style={[styles.actionIconWrap, { backgroundColor: '#F3E5F5' }]}>
              <Ban size={18} color="#6A1B9A" />
            </View>
            <View style={styles.actionContent}>
              <Text style={[styles.actionLabel, { color: blocked ? Colors.slateLighter : '#6A1B9A' }]}>
                {blocked ? 'User Blocked' : 'Block User'}
              </Text>
              <Text style={styles.actionDesc}>Hide all alerts from this user</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  notFoundText: {
    fontSize: 16,
    color: Colors.slateLight,
    fontWeight: '500' as const,
  },
  heroSection: {
    backgroundColor: Colors.white,
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  heroIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  categoryBadge: {
    marginBottom: 8,
  },
  categoryBadgeText: {
    fontSize: 18,
    fontWeight: '700' as const,
  },
  resolvedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    marginBottom: 8,
  },
  resolvedChipText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#2E7D32',
  },
  timeAgo: {
    fontSize: 14,
    color: Colors.slateLight,
    fontWeight: '500' as const,
  },
  detailCard: {
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 18,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.slateLighter,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  descriptionText: {
    fontSize: 15,
    color: Colors.slate,
    lineHeight: 23,
  },
  photo: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: Colors.background,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    color: Colors.slate,
    fontWeight: '500' as const,
    flex: 1,
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: Colors.skyBlue,
    padding: 14,
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 12,
  },
  privacyText: {
    flex: 1,
    fontSize: 12,
    color: Colors.primary,
    lineHeight: 18,
    fontWeight: '500' as const,
  },
  actionsSection: {
    marginHorizontal: 16,
    marginTop: 20,
  },
  actionsTitle: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.slateLighter,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    padding: 14,
    borderRadius: 14,
    marginBottom: 8,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  actionBtnDisabled: {
    opacity: 0.5,
  },
  actionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionContent: {
    flex: 1,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.slate,
    marginBottom: 2,
  },
  actionDesc: {
    fontSize: 12,
    color: Colors.slateLighter,
  },
});
