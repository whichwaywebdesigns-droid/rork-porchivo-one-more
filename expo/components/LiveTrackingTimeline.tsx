import React, { memo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Platform } from 'react-native';
import { Truck, MapPin, Package, CheckCircle2, AlertTriangle, Navigation, RefreshCw, Inbox } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { LiveTrackingEvent } from '@/types';
import { friendlyMilestoneLabel, Ship24Milestone } from '@/lib/ship24';

interface Props {
  milestone: Ship24Milestone | null | undefined;
  events: LiveTrackingEvent[];
  lastPolledAt: string | null | undefined;
  estimatedDelivery?: string | null;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  configured?: boolean;
}

function iconForMilestone(m: string | null | undefined) {
  switch (m) {
    case 'delivered':
      return <CheckCircle2 size={14} color={Colors.white} />;
    case 'out_for_delivery':
      return <Navigation size={14} color={Colors.white} />;
    case 'in_transit':
      return <Truck size={14} color={Colors.white} />;
    case 'available_for_pickup':
      return <Inbox size={14} color={Colors.white} />;
    case 'failed_attempt':
    case 'exception':
      return <AlertTriangle size={14} color={Colors.white} />;
    case 'info_received':
      return <Package size={14} color={Colors.white} />;
    default:
      return <MapPin size={14} color={Colors.white} />;
  }
}

function colorForMilestone(m: string | null | undefined): string {
  switch (m) {
    case 'delivered': return Colors.success;
    case 'out_for_delivery': return Colors.secondary;
    case 'in_transit': return Colors.primaryLight;
    case 'info_received': return Colors.slateLight;
    case 'available_for_pickup': return '#7C3AED';
    case 'failed_attempt':
    case 'exception': return Colors.danger;
    default: return Colors.primary;
  }
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diff = Math.round((now - d.getTime()) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function formatAbsolute(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

const LiveTrackingTimeline: React.FC<Props> = memo(function LiveTrackingTimeline({
  milestone,
  events,
  lastPolledAt,
  estimatedDelivery,
  onRefresh,
  isRefreshing,
  configured,
}) {
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (milestone === 'delivered' || milestone === null) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1100, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 1100, useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [milestone, pulseAnim]);

  useEffect(() => {
    if (!isRefreshing) {
      spinAnim.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 900, useNativeDriver: Platform.OS !== 'web' }),
    );
    loop.start();
    return () => loop.stop();
  }, [isRefreshing, spinAnim]);

  const pulseStyle = {
    opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
    transform: [{ scale: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.35] }) }],
  };

  const spinStyle = {
    transform: [{ rotate: spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
  };

  const heroColor = colorForMilestone(milestone);
  const label = friendlyMilestoneLabel(milestone ?? null);

  if (!configured) {
    return (
      <View style={styles.card}>
        <View style={styles.notConfiguredRow}>
          <AlertTriangle size={16} color={Colors.slateLight} />
          <Text style={styles.notConfiguredText}>
            Live tracking unavailable. Add your Ship24 API key to enable real-time updates.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card} testID="live-tracking-timeline">
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.heroDot, { backgroundColor: heroColor }]}>
            {milestone && milestone !== 'delivered' && (
              <Animated.View style={[styles.pulseRing, { borderColor: heroColor }, pulseStyle]} />
            )}
            {iconForMilestone(milestone)}
          </View>
          <View style={styles.headerText}>
            <Text style={styles.heroLabel}>{label}</Text>
            <Text style={styles.heroSub}>
              {lastPolledAt ? `Updated ${formatRelative(lastPolledAt)}` : 'Live tracking active'}
            </Text>
          </View>
        </View>
        {onRefresh && (
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={onRefresh}
            activeOpacity={0.7}
            disabled={isRefreshing}
            testID="refresh-tracking"
          >
            <Animated.View style={spinStyle}>
              <RefreshCw size={16} color={Colors.primary} />
            </Animated.View>
          </TouchableOpacity>
        )}
      </View>

      {estimatedDelivery && milestone !== 'delivered' && (
        <View style={styles.etaBar}>
          <Truck size={13} color={Colors.primary} />
          <Text style={styles.etaText}>
            Estimated delivery · {new Date(estimatedDelivery).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </Text>
        </View>
      )}

      {events.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Waiting for first update</Text>
          <Text style={styles.emptySub}>
            The carrier hasn&apos;t scanned this package yet. We&apos;ll update automatically.
          </Text>
        </View>
      ) : (
        <View style={styles.timeline}>
          {events.slice(0, 8).map((ev, idx) => {
            const dotColor = colorForMilestone(ev.milestone);
            const isFirst = idx === 0;
            return (
              <View key={ev.id} style={styles.row}>
                <View style={styles.leftCol}>
                  <View style={[styles.dot, { backgroundColor: isFirst ? dotColor : Colors.white, borderColor: dotColor }]}>
                    {isFirst && <View style={styles.innerDot} />}
                  </View>
                  {idx < Math.min(events.length, 8) - 1 && <View style={styles.connector} />}
                </View>
                <View style={styles.eventContent}>
                  <Text style={[styles.eventStatus, isFirst && { color: Colors.slate }]} numberOfLines={2}>
                    {ev.status}
                  </Text>
                  <View style={styles.eventMetaRow}>
                    {ev.location ? (
                      <>
                        <MapPin size={11} color={Colors.slateLighter} />
                        <Text style={styles.eventMeta} numberOfLines={1}>{ev.location}</Text>
                        <Text style={styles.eventDot}>·</Text>
                      </>
                    ) : null}
                    <Text style={styles.eventTime}>{formatAbsolute(ev.occurrenceAt)}</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
});

export default LiveTrackingTimeline;

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  heroDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
  },
  headerText: {
    flex: 1,
  },
  heroLabel: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.slate,
  },
  heroSub: {
    fontSize: 12,
    color: Colors.slateLight,
    marginTop: 2,
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.skyBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  etaBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: Colors.skyBlue,
    borderRadius: 10,
  },
  etaText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '600' as const,
  },
  emptyState: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: Colors.background,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.slate,
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 12,
    color: Colors.slateLight,
    textAlign: 'center',
    lineHeight: 17,
  },
  timeline: {
    marginTop: 18,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    minHeight: 52,
  },
  leftCol: {
    width: 18,
    alignItems: 'center',
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 3,
  },
  innerDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.white,
  },
  connector: {
    flex: 1,
    width: 2,
    backgroundColor: Colors.borderLight,
    marginTop: 2,
    marginBottom: 2,
  },
  eventContent: {
    flex: 1,
    paddingBottom: 16,
  },
  eventStatus: {
    fontSize: 14,
    color: Colors.slateLight,
    fontWeight: '500' as const,
    lineHeight: 19,
  },
  eventMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    flexWrap: 'wrap',
    gap: 4,
  },
  eventMeta: {
    fontSize: 11,
    color: Colors.slateLighter,
    maxWidth: 180,
  },
  eventDot: {
    fontSize: 11,
    color: Colors.slateLighter,
  },
  eventTime: {
    fontSize: 11,
    color: Colors.slateLighter,
  },
  notConfiguredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  notConfiguredText: {
    flex: 1,
    fontSize: 13,
    color: Colors.slateLight,
    lineHeight: 18,
  },
});
