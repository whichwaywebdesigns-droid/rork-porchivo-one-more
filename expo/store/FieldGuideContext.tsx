/**
 * FieldGuideContext — persists which Field Guide sections the user has fully
 * read ("completed"), keyed to the signed-in user id so checkmarks survive
 * re-opens. Reading progress within a session is NOT persisted (it resets on
 * re-open by design); only completion checkmarks stick.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';

import { useApp } from '@/store/AppContext';

const keyFor = (userId: string): string => `@porchivo/field-guide/completed/${userId}`;

interface FieldGuideValue {
  /** Section ids the user has read to the bottom. */
  completed: string[];
  /** Whether AsyncStorage has hydrated for the current user. */
  hydrated: boolean;
  isCompleted: (id: string) => boolean;
  markCompleted: (id: string) => void;
  reset: () => void;
}

export const [FieldGuideProvider, useFieldGuide] = createContextHook((): FieldGuideValue => {
  const { user } = useApp();
  const userId = user?.id ?? 'anon';
  const storageKey = keyFor(userId);

  const [completed, setCompleted] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    setHydrated(false);
    AsyncStorage.getItem(storageKey)
      .then((raw) => {
        if (!active) return;
        try {
          const parsed: unknown = raw ? JSON.parse(raw) : [];
          setCompleted(Array.isArray(parsed) ? (parsed as string[]) : []);
        } catch {
          setCompleted([]);
        }
        setHydrated(true);
      })
      .catch(() => {
        if (!active) return;
        setCompleted([]);
        setHydrated(true);
      });
    return () => {
      active = false;
    };
  }, [storageKey]);

  const markCompleted = useCallback(
    (id: string): void => {
      setCompleted((prev) => {
        if (prev.includes(id)) return prev;
        const next = [...prev, id];
        AsyncStorage.setItem(storageKey, JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    [storageKey],
  );

  const reset = useCallback((): void => {
    setCompleted([]);
    AsyncStorage.removeItem(storageKey).catch(() => {});
  }, [storageKey]);

  const isCompleted = useCallback((id: string): boolean => completed.includes(id), [completed]);

  return useMemo(
    () => ({ completed, hydrated, isCompleted, markCompleted, reset }),
    [completed, hydrated, isCompleted, markCompleted, reset],
  );
});
