import createContextHook from "@nkzw/create-context-hook";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, AppStateStatus } from "react-native";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { log, warn } from "@/lib/logger";

/**
 * A user action queued for later replay against Supabase when connectivity is restored.
 * The action is JSON-serializable so it can persist in AsyncStorage across app restarts.
 */
export interface QueuedAction {
  id: string;
  type: "insert" | "update" | "delete" | "rpc";
  /** Table name (for insert/update/delete) or RPC function name (for rpc). */
  target: string;
  /** Column → value map for inserts/updates, or parameter → value map for RPCs. */
  payload: Record<string, unknown>;
  /** Column → value eq-filter for updates/deletes (e.g. { id: "abc" }). */
  filter?: Record<string, unknown>;
  /** React Query key prefixes to invalidate after a successful replay. */
  queryKeysToInvalidate?: string[][];
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

/** Input for enqueue — the queue engine fills in id/timestamp/retry fields. */
export type QueuedActionInput = Omit<
  QueuedAction,
  "id" | "timestamp" | "retryCount" | "maxRetries"
>;

const STORAGE_KEY = "porchivo_offline_queue";
const MAX_RETRIES = 3;
const POLL_INTERVAL_MS = 30_000;
const PING_TIMEOUT_MS = 5_000;

function generateId(): string {
  return `action_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Lightweight connectivity probe — HEAD/GET to Supabase auth health endpoint. */
async function checkConnectivity(): Promise<boolean> {
  if (!isSupabaseConfigured) return true; // demo mode — always "online"
  try {
    const url = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? "")
      .trim()
      .replace(/^['"]|['"]$/g, "")
      .replace(/\/+$/, "");
    const key =
      process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
      "";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
    const response = await fetch(`${url}/auth/v1/health`, {
      signal: controller.signal,
      headers: { apikey: key },
    });
    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}

/** Replay a single queued action against Supabase. Returns true on success. */
async function replayAction(action: QueuedAction): Promise<boolean> {
  try {
    if (action.type === "insert") {
      const { error } = await supabase
        .from(action.target)
        .insert(action.payload);
      return !error;
    }
    if (action.type === "update") {
      let query = supabase.from(action.target).update(action.payload);
      if (action.filter) {
        for (const [key, value] of Object.entries(action.filter)) {
          query = query.eq(key, value);
        }
      }
      const { error } = await query;
      return !error;
    }
    if (action.type === "delete") {
      let query = supabase.from(action.target).delete();
      if (action.filter) {
        for (const [key, value] of Object.entries(action.filter)) {
          query = query.eq(key, value);
        }
      }
      const { error } = await query;
      return !error;
    }
    if (action.type === "rpc") {
      const { error } = await supabase.rpc(action.target, action.payload);
      return !error;
    }
    return false;
  } catch (e) {
    warn(
      "[OfflineQueue] Replay error:",
      e instanceof Error ? e.message : String(e),
    );
    return false;
  }
}

export const [OfflineQueueProvider, useOfflineQueue] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [isOnline, setIsOnline] = useState(true);
  const [pendingActions, setPendingActions] = useState<QueuedAction[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncCount, setLastSyncCount] = useState(0);
  const [syncFailedCount, setSyncFailedCount] = useState(0);

  const isSyncingRef = useRef(false);
  const wasOfflineRef = useRef(false);
  const pendingActionsRef = useRef<QueuedAction[]>([]);
  pendingActionsRef.current = pendingActions;

  const persistQueue = useCallback((actions: QueuedAction[]) => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(actions)).catch(() => {
      warn("[OfflineQueue] Failed to persist queue");
    });
  }, []);

  // ── Load queue from AsyncStorage on mount ──────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored) {
          try {
            const actions = JSON.parse(stored) as QueuedAction[];
            setPendingActions(actions);
            pendingActionsRef.current = actions;
            log("[OfflineQueue] Loaded", actions.length, "pending actions");
          } catch {
            warn("[OfflineQueue] Failed to parse stored queue");
          }
        }
      })
      .catch(() => {});
  }, []);

  // ── Process the queue: replay each action, remove on success ──────────
  const processQueue = useCallback(async () => {
    const actions = pendingActionsRef.current;
    if (isSyncingRef.current || actions.length === 0) return;

    isSyncingRef.current = true;
    setIsSyncing(true);
    setSyncFailedCount(0);

    let remaining = [...actions];
    let succeeded = 0;
    let failed = 0;
    let processed = 0;

    // Process at most `actions.length` items — prevents infinite loop when
    // an action fails and is moved to the back of the queue for retry.
    while (remaining.length > 0 && processed < actions.length) {
      const action = remaining[0];
      const ok = await replayAction(action);

      if (ok) {
        succeeded++;
        remaining = remaining.slice(1);
        persistQueue(remaining);
        setPendingActions(remaining);
        pendingActionsRef.current = remaining;
        if (action.queryKeysToInvalidate) {
          for (const key of action.queryKeysToInvalidate) {
            queryClient.invalidateQueries({ queryKey: key });
          }
        }
      } else {
        const updated: QueuedAction = {
          ...action,
          retryCount: action.retryCount + 1,
        };
        if (updated.retryCount < updated.maxRetries) {
          // Move to back of queue — will be retried on next sync cycle.
          remaining = [...remaining.slice(1), updated];
        } else {
          failed++;
          remaining = remaining.slice(1);
        }
        persistQueue(remaining);
        setPendingActions(remaining);
        pendingActionsRef.current = remaining;
      }
      processed++;
    }

    setLastSyncCount(succeeded);
    setSyncFailedCount(failed);
    setIsSyncing(false);
    isSyncingRef.current = false;

    if (succeeded > 0 || failed > 0) {
      log(
        "[OfflineQueue] Sync complete:",
        succeeded,
        "succeeded,",
        failed,
        "failed",
      );
    }
  }, [persistQueue, queryClient]);

  // Ref so effects can always call the latest processQueue without re-subscribing.
  const processQueueRef = useRef(processQueue);
  processQueueRef.current = processQueue;

  // ── Enqueue a new action ──────────────────────────────────────────────
  const enqueue = useCallback(
    (action: QueuedActionInput) => {
      const fullAction: QueuedAction = {
        ...action,
        id: generateId(),
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: MAX_RETRIES,
      };
      setPendingActions((prev) => {
        const updated = [...prev, fullAction];
        pendingActionsRef.current = updated;
        persistQueue(updated);
        return updated;
      });
      log("[OfflineQueue] Enqueued:", fullAction.type, fullAction.target);
    },
    [persistQueue],
  );

  // ── Clear the queue (called on sign-out) ───────────────────────────────
  const clearQueue = useCallback(() => {
    setPendingActions([]);
    pendingActionsRef.current = [];
    persistQueue([]);
    log("[OfflineQueue] Queue cleared");
  }, [persistQueue]);

  // ── Connectivity check + auto-sync ─────────────────────────────────────
  const runConnectivityCheck = useCallback(async () => {
    const online = await checkConnectivity();
    setIsOnline((prev) => {
      // Only log on state transition.
      if (prev !== online) {
        log("[OfflineQueue] Connectivity:", online ? "ONLINE" : "OFFLINE");
      }
      return online;
    });
    if (!online) {
      wasOfflineRef.current = true;
    } else if (
      wasOfflineRef.current &&
      pendingActionsRef.current.length > 0
    ) {
      wasOfflineRef.current = false;
      void processQueueRef.current();
    }
  }, []);

  // Initial check + periodic polling + AppState (foreground) listener.
  useEffect(() => {
    void runConnectivityCheck();

    let interval: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (interval) return;
      interval = setInterval(() => {
        void runConnectivityCheck();
      }, POLL_INTERVAL_MS);
    };

    const stopPolling = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    const subscription = AppState.addEventListener(
      "change",
      (nextState: AppStateStatus) => {
        if (nextState === "active") {
          void runConnectivityCheck();
          startPolling();
        } else {
          stopPolling();
        }
      },
    );

    startPolling();

    return () => {
      stopPolling();
      subscription.remove();
    };
  }, [runConnectivityCheck]);

  return {
    isOnline,
    pendingCount: pendingActions.length,
    isSyncing,
    lastSyncCount,
    syncFailedCount,
    enqueue,
    processQueue,
    clearQueue,
  };
});
