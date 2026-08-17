import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { CloudOff, RefreshCw, CheckCircle, AlertTriangle } from "lucide-react-native";
import { useOfflineQueue } from "@/store/OfflineQueueContext";
import { useColors } from "@/constants/colors";

/**
 * Non-intrusive banner that appears at the top of the screen when the device
 * is offline, when queued actions are syncing, or when a sync batch completes.
 * Slides in/out via Animated for a smooth transition.
 */
export function OfflineBanner() {
  const { isOnline, pendingCount, isSyncing, lastSyncCount, syncFailedCount } =
    useOfflineQueue();
  const Colors = useColors();
  const [showSynced, setShowSynced] = useState(false);
  const slideAnim = useRef(new Animated.Value(-120)).current;

  // Show "synced" briefly after a sync batch completes.
  useEffect(() => {
    if (lastSyncCount > 0 && !isSyncing) {
      setShowSynced(true);
      const timer = setTimeout(() => setShowSynced(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [lastSyncCount, isSyncing]);

  const shouldShow =
    !isOnline || isSyncing || showSynced || syncFailedCount > 0;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: shouldShow ? 0 : -120,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [shouldShow, slideAnim]);

  // Determine banner style based on current state.
  let bg: string = Colors.secondary; // amber/orange for offline
  let message = `Offline — ${pendingCount} action${pendingCount === 1 ? "" : "s"} saved`;
  let Icon = CloudOff;

  if (isSyncing) {
    bg = Colors.primary; // blue for syncing
    message = `Syncing ${pendingCount} action${pendingCount === 1 ? "" : "s"}\u2026`;
    Icon = RefreshCw;
  } else if (syncFailedCount > 0 && isOnline) {
    bg = Colors.danger; // red for failures
    message = `${syncFailedCount} action${syncFailedCount === 1 ? "" : "s"} failed to sync`;
    Icon = AlertTriangle;
  } else if (showSynced) {
    bg = Colors.success; // green for success
    message = `Synced ${lastSyncCount} action${lastSyncCount === 1 ? "" : "s"}`;
    Icon = CheckCircle;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: bg, transform: [{ translateY: slideAnim }] },
      ]}
      pointerEvents={shouldShow ? "box-none" : "none"}
    >
      <Pressable style={styles.content} disabled>
        <Icon size={16} color={Colors.white} />
        <Text style={[styles.text, { color: Colors.white }]} numberOfLines={1}>
          {message}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingTop: 50, // clear the status bar
    paddingBottom: 10,
    paddingHorizontal: 16,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  text: {
    fontSize: 13,
    fontWeight: "600",
  },
});
