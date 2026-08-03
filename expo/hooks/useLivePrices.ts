/**
 * useLivePrices — exposes the live, store-authoritative prices from RevenueCat.
 *
 * The store (App Store / Play Store) is the single source of truth for price.
 * This hook fetches the localized price for every product in the current
 * RevenueCat offering, keyed by both package id and store product id, so the
 * paywall can display the REAL price the user will be charged — correct for
 * their region and currency — instead of a hardcoded label.
 *
 * Falls back to an empty map in Expo Go / web preview (SDK unavailable);
 * callers should then use their static `config/app.ts` display labels.
 *
 *   import { useLivePrices } from '@/hooks/useLivePrices';
 *   const { priceFor } = useLivePrices();
 *   const label = priceFor(plan.id) ?? plan.priceLabel;
 */
import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getLivePrices, formatCurrency, type LivePrice } from '@/lib/revenueCat';

export interface UseLivePrices {
  /** Map of product/package id → live localized price. Empty when unavailable. */
  prices: Record<string, LivePrice>;
  isLoading: boolean;
  /** Localized total price for a plan id (e.g. "$99.99"), or undefined. */
  priceFor: (id: string) => string | undefined;
  /** Localized per-month equivalent of an annual plan (e.g. "$8.33/mo"), or undefined. */
  perMonthFor: (id: string) => string | undefined;
}

export function useLivePrices(): UseLivePrices {
  const { data: prices = {}, isLoading } = useQuery<Record<string, LivePrice>>({
    queryKey: ['live-prices'],
    queryFn: getLivePrices,
    // Prices change rarely; cache aggressively to keep the paywall instant.
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
    retry: 1,
  });

  const priceFor = useCallback(
    (id: string): string | undefined => prices[id]?.priceString || undefined,
    [prices],
  );

  const perMonthFor = useCallback(
    (id: string): string | undefined => {
      const entry = prices[id];
      if (!entry || !entry.price) return undefined;
      const monthly = entry.price / 12;
      return `${formatCurrency(monthly, entry.currencyCode)}/mo`;
    },
    [prices],
  );

  return { prices, isLoading, priceFor, perMonthFor };
}
