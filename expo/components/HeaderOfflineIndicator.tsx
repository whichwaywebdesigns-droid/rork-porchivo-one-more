import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { CloudOff } from "lucide-react-native";
import { useOfflineQueue } from "@/store/OfflineQueueContext";
import { useColors } from "@/constants/colors";

/** Formats a sync timestamp as a short time (plus the date when not today). */
function formatSyncTime(ts: number): string {
  const date = new Date(ts);
  const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (date.toDateString() === new Date().toDateString()) return time;
  return `${date.toLocaleDateString([], { month: "short", day: "numeric" })}, ${time}`;
}

/**
 * Compact header pill shown only while the device is offline, displaying the
 * time of the last successful background sync. Mount via `headerRight` so it
 * appears in every native navigation header without extra wiring.
 */
export const HeaderOfflineIndicator = memo(function HeaderOfflineIndicator() {
  const { isOnline, lastSyncedAt } = useOfflineQueue();
  const Colors = useColors();

  if (isOnline) return null;

  return (
    <View
      style={[styles.pill, { backgroundColor: Colors.secondary }]}
      accessibilityRole="text"
      accessibilityLabel={
        lastSyncedAt != null
          ? `Offline. Last sync ${formatSyncTime(lastSyncedAt)}.`
          : "Offline."
      }
    >
      <CloudOff size={11} color={Colors.white} />
      <Text style={[styles.offline, { color: Colors.white }]}>Offline</Text>
      {lastSyncedAt != null && (
        <Text style={[styles.synced, { color: Colors.white }]} numberOfLines={1}>
          {formatSyncTime(lastSyncedAt)}
        </Text>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    paddingLeft: 8,
    paddingRight: 10,
    paddingVertical: 5,
    marginRight: 4,
  },
  offline: {
    fontSize: 11,
    fontWeight: "700" as const,
    letterSpacing: 0.2,
  },
  synced: {
    fontSize: 10,
    fontWeight: "500" as const,
    opacity: 0.85,
    maxWidth: 90,
  },
});
