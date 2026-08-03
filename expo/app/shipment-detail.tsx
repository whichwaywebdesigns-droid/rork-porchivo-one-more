import React, { useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Image,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import {
  Package, Clock, MapPin, User, Truck, ChevronRight, X, Check, AlertTriangle, Shield, Bell, PackageCheck, ChevronLeft, MessageCircle, Camera,
} from 'lucide-react-native';
import { useColors, AppColors } from '@/constants/colors';
import { useApp } from '@/store/AppContext';
import { useShipments } from '@/store/ShipmentsContext';
import { useNotifications } from '@/store/NotificationsContext';
import StatusBadge from '@/components/StatusBadge';
import CarrierIcon from '@/components/CarrierIcon';
import LiveTrackingTimeline from '@/components/LiveTrackingTimeline';
import ProofOfDeliverySheet from '@/components/ProofOfDeliverySheet';

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatNotifTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function ShipmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useApp();
  const { shipments, acceptShipment, completeShipment, cancelShipment, updateShipmentTracking, trackingByShipment, refreshShipmentTracking, ship24Enabled } = useShipments();
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const { notifications } = useNotifications();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const shipment = useMemo(() => shipments.find(s => s.id === id), [shipments, id]);

  const [trackingInput, setTrackingInput] = useState('');
  const [shareLocation, setShareLocation] = useState(false);
  const [showTrackingForm, setShowTrackingForm] = useState(false);
  const [showProofSheet, setShowProofSheet] = useState(false);

  const isOwner = shipment?.homeownerId === user?.id;
  const isPartnerAssigned = shipment?.partnerId === user?.id;

  const handleAccept = useCallback(() => {
    if (!shipment) return;
    Alert.alert(
      'Accept Shipment',
      `Accept this shipment from ${shipment.homeownerName}? You'll be responsible for picking up and safeguarding the package.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Accept', onPress: () => { acceptShipment(shipment.id); } },
      ]
    );
  }, [shipment, acceptShipment]);

  const handleCancel = useCallback(() => {
    if (!shipment) return;
    Alert.alert(
      'Cancel Shipment',
      'Are you sure you want to cancel this shipment?',
      [
        { text: 'Keep', style: 'cancel' },
        { text: 'Cancel Shipment', style: 'destructive', onPress: () => { cancelShipment(shipment.id); router.back(); } },
      ]
    );
  }, [shipment, cancelShipment, router]);

  const handleComplete = useCallback(() => {
    if (!shipment) return;
    setShowProofSheet(true);
  }, [shipment]);

  const handleProofComplete = useCallback(() => {
    setShowProofSheet(false);
    Alert.alert('Delivery Complete', 'The shipment has been marked as completed. The homeowner has been notified.');
  }, []);

  const shipmentNotifications = useMemo(() =>
    notifications.filter(n => n.shipmentId === id),
    [notifications, id]
  );

  const handleSaveTracking = useCallback(() => {
    if (!shipment || !trackingInput.trim()) return;
    updateShipmentTracking(shipment.id, trackingInput.trim(), shareLocation);
    setShowTrackingForm(false);
    Alert.alert(
      'Tracking Saved',
      'You\'ll be notified when your package is delivered, and your Porch Partner will be alerted to pick it up.',
    );
  }, [shipment, trackingInput, shareLocation, updateShipmentTracking]);

  if (!shipment) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Shipment', presentation: 'modal' }} />
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>Shipment not found</Text>
        </View>
      </View>
    );
  }

  const deliveryBanner = shipment.deliveryStatus === 'delivered' || shipment.deliveryStatus === 'delivered_to_homeowner';

  const deliveryStatusText = shipment.deliveryStatus === 'delivered' || shipment.deliveryStatus === 'delivered_to_homeowner'
    ? 'Delivered'
    : shipment.deliveryStatus === 'out_for_delivery'
    ? 'Out for delivery'
    : shipment.deliveryStatus === 'in_transit'
    ? 'In transit'
    : shipment.trackingNumber
    ? 'Tracking active'
    : 'Pending';

  const deliveryStatusColor = shipment.deliveryStatus === 'delivered' || shipment.deliveryStatus === 'delivered_to_homeowner'
    ? colors.success
    : shipment.deliveryStatus === 'out_for_delivery'
    ? colors.secondary
    : shipment.deliveryStatus === 'in_transit'
    ? colors.primaryLight
    : colors.slateLight;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Shipment Details',
          presentation: 'modal',
          headerStyle: { backgroundColor: colors.white },
          headerTintColor: colors.primary,
          headerShadowVisible: false,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
              <ChevronLeft size={24} color={colors.slate} strokeWidth={2} />
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {deliveryBanner && (
          <View style={styles.deliveredBanner}>
            <Check size={18} color={colors.success} />
            <Text style={styles.deliveredText}>
              {isOwner
                ? 'Delivered · Porchivo partner on the way'
                : 'Delivered to porch · Time to pick up'}
            </Text>
          </View>
        )}

        <View style={styles.headerCard}>
          <View style={styles.headerTop}>
            <CarrierIcon carrier={shipment.carrier} size={44} />
            <View style={styles.headerInfo}>
              <Text style={styles.headerCarrier}>{shipment.carrier}</Text>
              <Text style={styles.headerPackages}>{shipment.packagesExpected}</Text>
            </View>
            <StatusBadge status={shipment.status} size="medium" />
          </View>
        </View>

        <View style={styles.detailCard}>
          <Text style={styles.cardTitle}>Shipment Details</Text>

          <View style={styles.detailRow}>
            <View style={styles.detailIcon}><MapPin size={16} color={colors.primary} /></View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Address</Text>
              <Text style={styles.detailValue}>{shipment.addressText}</Text>
            </View>
          </View>

          <View style={styles.detailDivider} />

          <View style={styles.detailRow}>
            <View style={[styles.detailIcon, { backgroundColor: deliveryStatusColor + '20' }]}>
              <Truck size={16} color={deliveryStatusColor} />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Delivery Status</Text>
              <Text style={[styles.detailValue, { color: deliveryStatusColor }]}>{deliveryStatusText}</Text>
            </View>
          </View>

          {shipment.preferredReturnTime ? (
            <>
              <View style={styles.detailDivider} />
              <View style={styles.detailRow}>
                <View style={styles.detailIcon}><Clock size={16} color={colors.secondary} /></View>
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Preferred Return</Text>
                  <Text style={styles.detailValue}>{shipment.preferredReturnTime}</Text>
                </View>
              </View>
            </>
          ) : null}
        </View>

        {shipment.notes ? (
          <View style={styles.detailCard}>
            <Text style={styles.cardTitle}>Notes</Text>
            <Text style={styles.notesText}>{shipment.notes}</Text>
          </View>
        ) : null}

        {shipment.partnerName && (
          <View style={styles.detailCard}>
            <Text style={styles.cardTitle}>{isOwner ? 'Your Porch Partner' : 'Homeowner'}</Text>
            <View style={styles.personRow}>
              <View style={[styles.personAvatar, { backgroundColor: isOwner ? colors.peach : colors.skyBlue }]}>
                <Text style={[styles.personInitial, { color: isOwner ? colors.secondary : colors.primary }]}>
                  {isOwner ? shipment.partnerName[0] : shipment.homeownerName[0]}
                </Text>
              </View>
              <View style={styles.personInfo}>
                <Text style={styles.personName}>{isOwner ? shipment.partnerName : shipment.homeownerName}</Text>
              </View>
              <TouchableOpacity
                style={styles.chatBtn}
                onPress={() => router.push({ pathname: '/chat' as any, params: { shipmentId: shipment.id } })}
                activeOpacity={0.7}
                testID="shipment-chat-btn"
              >
                <MessageCircle size={16} color={colors.primary} />
                <Text style={styles.chatBtnText}>Chat</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {shipment.trackingNumber && (
          <View style={{ marginBottom: 12 }}>
            <LiveTrackingTimeline
              configured={ship24Enabled}
              milestone={trackingByShipment[shipment.id]?.milestone ?? null}
              events={trackingByShipment[shipment.id]?.events ?? []}
              lastPolledAt={trackingByShipment[shipment.id]?.lastPolledAt ?? null}
              estimatedDelivery={trackingByShipment[shipment.id]?.estimatedDelivery ?? null}
              isRefreshing={isRefreshing}
              onRefresh={async () => {
                setIsRefreshing(true);
                try {
                  await refreshShipmentTracking(shipment.id);
                } finally {
                  setIsRefreshing(false);
                }
              }}
            />
          </View>
        )}

        {shipment.trackingNumber && (
          <View style={styles.detailCard}>
            <Text style={styles.cardTitle}>Tracking</Text>
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}><Truck size={16} color={colors.primary} /></View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Tracking Number</Text>
                <Text style={styles.detailValue}>{shipment.trackingNumber}</Text>
              </View>
            </View>
            {shipment.homeLocationVisibleToPartner && (
              <>
                <View style={styles.detailDivider} />
                <View style={styles.detailRow}>
                  <View style={styles.detailIcon}><MapPin size={16} color={colors.success} /></View>
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>Porch Location</Text>
                    <Text style={[styles.detailValue, { color: colors.success }]}>Shared with partner</Text>
                  </View>
                </View>
              </>
            )}
          </View>
        )}

        {isOwner && shipment.status === 'accepted' && !shipment.trackingNumber && !showTrackingForm && (
          <TouchableOpacity style={styles.trackingPrompt} onPress={() => setShowTrackingForm(true)}>
            <Truck size={20} color={colors.primary} />
            <View style={styles.trackingPromptContent}>
              <Text style={styles.trackingPromptTitle}>Connect tracking</Text>
              <Text style={styles.trackingPromptSub}>So your Porch Partner knows when to pick up</Text>
            </View>
            <ChevronRight size={18} color={colors.primary} />
          </TouchableOpacity>
        )}

        {showTrackingForm && (
          <View style={styles.detailCard}>
            <Text style={styles.cardTitle}>Add Tracking Number</Text>
            <TextInput
              style={styles.trackingInput}
              value={trackingInput}
              onChangeText={setTrackingInput}
              placeholder="Enter tracking number"
              placeholderTextColor={colors.slateLighter}
            />
            <TouchableOpacity style={styles.checkboxRow} onPress={() => setShareLocation(!shareLocation)}>
              <View style={[styles.checkbox, shareLocation && styles.checkboxActive]}>
                {shareLocation && <Check size={12} color={colors.white} />}
              </View>
              <Text style={styles.checkboxText}>Share exact porch location with partner</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveTrackingBtn, !trackingInput.trim() && styles.saveTrackingBtnDisabled]}
              onPress={handleSaveTracking}
              disabled={!trackingInput.trim()}
            >
              <Text style={styles.saveTrackingText}>Save Tracking</Text>
            </TouchableOpacity>
          </View>
        )}

        {shipmentNotifications.length > 0 && (
          <View style={styles.detailCard}>
            <Text style={styles.cardTitle}>Delivery Notifications</Text>
            {shipmentNotifications.map((notif, idx) => (
              <View key={notif.id}>
                {idx > 0 && <View style={styles.detailDivider} />}
                <View style={styles.notifRow}>
                  <View style={[
                    styles.notifIcon,
                    { backgroundColor: notif.type === 'package_delivered' || notif.type === 'partner_pickup_alert'
                      ? colors.success + '20'
                      : colors.skyBlue
                    },
                  ]}>
                    {notif.type === 'package_delivered' || notif.type === 'partner_pickup_alert' ? (
                      <PackageCheck size={16} color={colors.success} />
                    ) : notif.type === 'tracking_added' ? (
                      <Truck size={16} color={colors.primary} />
                    ) : (
                      <Bell size={16} color={colors.secondary} />
                    )}
                  </View>
                  <View style={styles.notifContent}>
                    <Text style={styles.notifTitle}>{notif.title}</Text>
                    <Text style={styles.notifMessage}>{notif.message}</Text>
                    <Text style={styles.notifTime}>{formatNotifTime(notif.createdAt)}</Text>
                  </View>
                  {!notif.read && <View style={styles.unreadDot} />}
                </View>
              </View>
            ))}
          </View>
        )}

        {isOwner && shipment.trackingNumber && shipment.deliveryStatus === 'pending' && (
          <View style={styles.trackingActiveCard}>
            <Bell size={18} color={colors.primary} />
            <View style={styles.trackingActiveContent}>
              <Text style={styles.trackingActiveTitle}>Delivery notifications active</Text>
              <Text style={styles.trackingActiveSub}>We'll notify you and your Porch Partner when this package is delivered.</Text>
            </View>
          </View>
        )}

        {isPartnerAssigned && shipment.trackingNumber && shipment.deliveryStatus !== 'delivered' && shipment.deliveryStatus !== 'delivered_to_homeowner' && (
          <View style={styles.partnerAlertCard}>
            <Bell size={18} color={colors.secondary} />
            <View style={styles.trackingActiveContent}>
              <Text style={[styles.trackingActiveTitle, { color: colors.secondary }]}>You'll be notified</Text>
              <Text style={styles.trackingActiveSub}>When {shipment.homeownerName}'s package is delivered, you'll get an alert to go pick it up.</Text>
            </View>
          </View>
        )}

        {isOwner && shipment.status === 'completed' && shipment.completionPhotoUrl && (
          <View style={styles.detailCard}>
            <Text style={styles.cardTitle}>Proof of Delivery</Text>
            <Text style={styles.proofSubText}>Your Porch Partner captured this photo when marking the delivery complete.</Text>
            <View style={styles.proofPhotoWrap}>
              <Image
                source={{ uri: shipment.completionPhotoUrl }}
                style={styles.proofPhoto}
                resizeMode="cover"
              />
            </View>
          </View>
        )}

        {shipment.status === 'open' && !isOwner && (
          <View style={styles.safetyNote}>
            <AlertTriangle size={14} color={colors.slateLight} />
            <Text style={styles.safetyText}>Only meet neighbors in well-lit areas and use your judgment when sharing exact porch location.</Text>
          </View>
        )}

        <View style={styles.actionArea}>
          {shipment.status === 'open' && !isOwner && (
            <TouchableOpacity style={styles.acceptBtn} onPress={handleAccept} activeOpacity={0.85}>
              <Text style={styles.acceptBtnText}>Accept Porch Partner Shipment</Text>
            </TouchableOpacity>
          )}

          {shipment.status === 'accepted' && isPartnerAssigned && (
            <TouchableOpacity style={styles.completeBtn} onPress={handleComplete} activeOpacity={0.85}>
              <Camera size={18} color={colors.white} />
              <Text style={styles.completeBtnText}>Mark as Completed</Text>
            </TouchableOpacity>
          )}

          {isOwner && (shipment.status === 'open' || shipment.status === 'accepted') && (
            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel} activeOpacity={0.85}>
              <X size={16} color={colors.danger} />
              <Text style={styles.cancelBtnText}>Cancel Shipment</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      <ProofOfDeliverySheet
        visible={showProofSheet}
        shipmentId={shipment.id}
        onClose={() => setShowProofSheet(false)}
        onComplete={handleProofComplete}
      />
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFoundText: {
    fontSize: 16,
    color: colors.slateLight,
  },
  deliveredBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.successLight,
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
  },
  deliveredText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.success,
    flex: 1,
  },
  headerCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 18,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerInfo: {
    flex: 1,
  },
  headerCarrier: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.slate,
  },
  headerPackages: {
    fontSize: 14,
    color: colors.slateLight,
    marginTop: 2,
  },
  detailCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 18,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: colors.slateLight,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 14,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  detailIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.skyBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: colors.slateLighter,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 15,
    color: colors.slate,
    fontWeight: '500' as const,
  },
  detailDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: 12,
    marginLeft: 44,
  },
  notesText: {
    fontSize: 15,
    color: colors.slate,
    lineHeight: 22,
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  personAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  personInitial: {
    fontSize: 16,
    fontWeight: '700' as const,
  },
  personInfo: {
    flex: 1,
  },
  personName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.slate,
  },
  chatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.skyBlue,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  chatBtnText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: colors.primary,
  },
  trackingPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.skyBlue,
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
  },
  trackingPromptContent: {
    flex: 1,
  },
  trackingPromptTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: colors.primary,
  },
  trackingPromptSub: {
    fontSize: 12,
    color: colors.primaryLight,
    marginTop: 1,
  },
  trackingInput: {
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: colors.slate,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxText: {
    fontSize: 13,
    color: colors.slateLight,
    flex: 1,
  },
  saveTrackingBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveTrackingBtnDisabled: {
    backgroundColor: colors.borderLight,
  },
  saveTrackingText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '600' as const,
  },
  safetyNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 14,
    backgroundColor: colors.background,
    borderRadius: 10,
    marginBottom: 12,
  },
  safetyText: {
    fontSize: 12,
    color: colors.slateLight,
    lineHeight: 18,
    flex: 1,
  },
  actionArea: {
    gap: 10,
    marginTop: 8,
  },
  acceptBtn: {
    backgroundColor: colors.secondary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  acceptBtnText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600' as const,
  },
  completeBtn: {
    backgroundColor: colors.success,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  completeBtnText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600' as const,
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.dangerLight,
    backgroundColor: colors.white,
  },
  cancelBtnText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  notifIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  notifContent: {
    flex: 1,
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.slate,
    marginBottom: 2,
  },
  notifMessage: {
    fontSize: 13,
    color: colors.slateLight,
    lineHeight: 18,
    marginBottom: 4,
  },
  notifTime: {
    fontSize: 11,
    color: colors.slateLighter,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.secondary,
    marginTop: 6,
  },
  trackingActiveCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.skyBlue,
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
  },
  trackingActiveContent: {
    flex: 1,
  },
  trackingActiveTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.primary,
    marginBottom: 2,
  },
  trackingActiveSub: {
    fontSize: 12,
    color: colors.slateLight,
    lineHeight: 17,
  },
  partnerAlertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.peach,
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
  },
  proofSubText: {
    fontSize: 13,
    color: colors.slateLight,
    lineHeight: 18,
    marginBottom: 12,
  },
  proofPhotoWrap: {
    borderRadius: 12,
    overflow: 'hidden' as const,
    backgroundColor: colors.borderLight,
  },
  proofPhoto: {
    width: '100%',
    height: 220,
  },
  });
}
