import { useEffect, useState, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { UserRole } from '@/types';

export type OnboardingIntent =
  | 'protect_deliveries'
  | 'help_someone'
  | 'stay_informed'
  | 'just_exploring';

export interface ChecklistProgress {
  homeAreaConfirmed: boolean;
  alertsEnabled: boolean;
  safeDropoffSet: boolean;
  finalTaskDone: boolean;
}

const STORAGE_KEYS = {
  intent: 'porchivo_ob_intent_v2',
  checklist: 'porchivo_ob_checklist_v2',
  pushHandled: 'porchivo_ob_push_handled_v2',
  currentStep: 'porchivo_ob_current_step_v2',
} as const;

const DEFAULT_CHECKLIST: ChecklistProgress = {
  homeAreaConfirmed: false,
  alertsEnabled: false,
  safeDropoffSet: false,
  finalTaskDone: false,
};

/** Maps onboarding intent to app UserRole */
export function intentToRole(intent: OnboardingIntent): UserRole {
  switch (intent) {
    case 'help_someone': return 'partner';
    case 'protect_deliveries':
    case 'stay_informed':
    case 'just_exploring':
    default:
      return 'homeowner';
  }
}

/** Returns the final checklist task label based on intent */
export function finalTaskLabel(intent: OnboardingIntent | null): string {
  switch (intent) {
    case 'protect_deliveries': return 'Add a trusted contact';
    case 'help_someone': return 'Set helper preferences';
    case 'stay_informed': return 'Explore local view';
    case 'just_exploring':
    default:
      return 'See how Porchivo works';
  }
}

/** Returns the route for the final checklist task */
export function finalTaskRoute(intent: OnboardingIntent | null): string {
  switch (intent) {
    case 'protect_deliveries': return '/invite-partner';
    case 'help_someone': return '/(tabs)/profile';
    case 'stay_informed': return '/neighborhood';
    case 'just_exploring':
    default:
      return '/intro';
  }
}

export const [OnboardingProvider, useOnboarding] = createContextHook(() => {
  const [intent, setIntentState] = useState<OnboardingIntent | null>(null);
  const [checklist, setChecklistState] = useState<ChecklistProgress>(DEFAULT_CHECKLIST);
  const [pushHandled, setPushHandledState] = useState<boolean>(false);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  // Hydrate from AsyncStorage on mount
  useEffect(() => {
    void (async () => {
      try {
        const [storedIntent, storedChecklist, storedPushHandled] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.intent),
          AsyncStorage.getItem(STORAGE_KEYS.checklist),
          AsyncStorage.getItem(STORAGE_KEYS.pushHandled),
        ]);
        if (storedIntent) setIntentState(storedIntent as OnboardingIntent);
        if (storedChecklist) {
          try {
            const parsed = JSON.parse(storedChecklist) as ChecklistProgress;
            setChecklistState(parsed);
          } catch {
            // corrupted data — ignore, use defaults
          }
        }
        if (storedPushHandled === 'true') setPushHandledState(true);
      } catch {
        // storage read failure — use defaults
      } finally {
        setIsLoaded(true);
      }
    })();
  }, []);

  const setIntent = useCallback(async (value: OnboardingIntent) => {
    setIntentState(value);
    await AsyncStorage.setItem(STORAGE_KEYS.intent, value);
  }, []);

  const updateChecklist = useCallback(async (updates: Partial<ChecklistProgress>) => {
    setChecklistState((prev) => {
      const next = { ...prev, ...updates };
      void AsyncStorage.setItem(STORAGE_KEYS.checklist, JSON.stringify(next));
      return next;
    });
  }, []);

  const setPushHandled = useCallback(async (value: boolean) => {
    setPushHandledState(value);
    await AsyncStorage.setItem(STORAGE_KEYS.pushHandled, value ? 'true' : 'false');
  }, []);

  const completedCount = useMemo(
    () => Object.values(checklist).filter(Boolean).length,
    [checklist],
  );

  /** Clears onboarding intent + checklist (not used on sign-out — progress survives auth changes). */
  const resetOnboarding = useCallback(async () => {
    setIntentState(null);
    setChecklistState(DEFAULT_CHECKLIST);
    setPushHandledState(false);
    await Promise.all([
      AsyncStorage.removeItem(STORAGE_KEYS.intent),
      AsyncStorage.removeItem(STORAGE_KEYS.checklist),
      AsyncStorage.removeItem(STORAGE_KEYS.pushHandled),
    ]);
  }, []);

  return useMemo(
    () => ({
      intent,
      checklist,
      pushHandled,
      isLoaded,
      completedCount,
      totalCount: 4 as const,
      setIntent,
      updateChecklist,
      setPushHandled,
      resetOnboarding,
    }),
    [
      intent,
      checklist,
      pushHandled,
      isLoaded,
      completedCount,
      setIntent,
      updateChecklist,
      setPushHandled,
      resetOnboarding,
    ],
  );
});
