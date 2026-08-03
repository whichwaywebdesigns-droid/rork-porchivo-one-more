/**
 * ProfileExtensionContext
 *
 * Manages extended profile data that goes beyond the core profiles table:
 * - Separate shipping vs. billing address
 * - Role-specific delivery and partner fields
 * - Stored in AsyncStorage pending full DB migration
 *
 * All fields are optional and default to empty strings / sensible defaults.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import type {
  ProfileExtension,
  StructuredAddress,
  SafeDropPreference,
  PreferredDeliveryWindow,
  PackageSize,
} from '@/types';

const STORAGE_KEY = 'porchivo_profile_extension_v1';

const EMPTY_ADDRESS: StructuredAddress = {
  street: '',
  unit: '',
  city: '',
  state: '',
  zip: '',
  country: 'US',
};

const DEFAULT_EXTENSION: ProfileExtension = {
  // Shared
  shippingAddress: { ...EMPTY_ADDRESS },
  billingAddress: { ...EMPTY_ADDRESS },
  billingAddressSameAsShipping: true,
  emergencyContactName: '',
  emergencyContactPhone: '',

  // Homeowner
  deliveryInstructions: '',
  accessCode: '',
  safeDropPreference: 'front_porch',
  safeDropNotes: '',
  preferredDeliveryWindow: 'any',

  // Partner
  legalFirstName: '',
  legalLastName: '',
  businessName: '',
  partnerBio: '',
  serviceRadiusMiles: 1,
  acceptedPackageSizes: ['small', 'medium', 'large'],
  maxDailyHolds: 5,
  taxIdLast4: '',
  serviceHoursNotes: '',
};

export const [ProfileExtensionProvider, useProfileExtension] = createContextHook(() => {
  const [extension, setExtension] = useState<ProfileExtension>(DEFAULT_EXTENSION);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  // Load from AsyncStorage on mount
  useEffect(() => {
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<ProfileExtension>;
          setExtension((prev) => ({ ...prev, ...parsed }));
        }
      } catch {
        // Ignore parse errors — use defaults
      } finally {
        setIsLoaded(true);
      }
    })();
  }, []);

  const persist = useCallback(async (data: ProfileExtension) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Non-fatal — data lives in state regardless
    }
  }, []);

  /** Replace the entire extension object */
  const saveExtension = useCallback(
    async (updates: Partial<ProfileExtension>) => {
      setExtension((prev) => {
        const next = { ...prev, ...updates };
        void persist(next);
        return next;
      });
    },
    [persist],
  );

  /** Update just the shipping address */
  const saveShippingAddress = useCallback(
    async (addr: Partial<StructuredAddress>) => {
      setExtension((prev) => {
        const next: ProfileExtension = {
          ...prev,
          shippingAddress: { ...prev.shippingAddress, ...addr },
        };
        // Mirror to billing if same-as-shipping is on
        if (prev.billingAddressSameAsShipping) {
          next.billingAddress = { ...next.shippingAddress };
        }
        void persist(next);
        return next;
      });
    },
    [persist],
  );

  /** Update just the billing address */
  const saveBillingAddress = useCallback(
    async (addr: Partial<StructuredAddress>) => {
      setExtension((prev) => {
        const next: ProfileExtension = {
          ...prev,
          billingAddress: { ...prev.billingAddress, ...addr },
          billingAddressSameAsShipping: false,
        };
        void persist(next);
        return next;
      });
    },
    [persist],
  );

  /** Toggle billing-same-as-shipping */
  const setBillingSameAsShipping = useCallback(
    async (same: boolean) => {
      setExtension((prev) => {
        const next: ProfileExtension = {
          ...prev,
          billingAddressSameAsShipping: same,
          billingAddress: same ? { ...prev.shippingAddress } : { ...prev.billingAddress },
        };
        void persist(next);
        return next;
      });
    },
    [persist],
  );

  const setSafeDropPreference = useCallback(
    (pref: SafeDropPreference) => saveExtension({ safeDropPreference: pref }),
    [saveExtension],
  );

  const setPreferredDeliveryWindow = useCallback(
    (window: PreferredDeliveryWindow) => saveExtension({ preferredDeliveryWindow: window }),
    [saveExtension],
  );

  const toggleAcceptedPackageSize = useCallback(
    (size: PackageSize) => {
      setExtension((prev) => {
        const sizes = prev.acceptedPackageSizes ?? ['small', 'medium', 'large'];
        const next: ProfileExtension = {
          ...prev,
          acceptedPackageSizes: sizes.includes(size)
            ? sizes.filter((s) => s !== size)
            : [...sizes, size],
        };
        void persist(next);
        return next;
      });
    },
    [persist],
  );

  return useMemo(
    () => ({
      extension,
      isLoaded,
      saveExtension,
      saveShippingAddress,
      saveBillingAddress,
      setBillingSameAsShipping,
      setSafeDropPreference,
      setPreferredDeliveryWindow,
      toggleAcceptedPackageSize,
    }),
    [
      extension,
      isLoaded,
      saveExtension,
      saveShippingAddress,
      saveBillingAddress,
      setBillingSameAsShipping,
      setSafeDropPreference,
      setPreferredDeliveryWindow,
      toggleAcceptedPackageSize,
    ],
  );
});
