/**
 * Carrier auto-detection from tracking number format.
 * Regex patterns based on each carrier's documented tracking number formats.
 */

import { Carrier } from '@/types';

interface CarrierPattern {
  carrier: Carrier;
  pattern: RegExp;
  label: string;
}

const PATTERNS: CarrierPattern[] = [
  // UPS — starts with 1Z followed by 16 alphanumeric characters
  { carrier: 'UPS', pattern: /^1Z[0-9A-Z]{16}$/i, label: 'UPS' },
  // FedEx — various formats: 12, 15, 20, 22 digit numbers, or 96/61 prefixed
  { carrier: 'FedEx', pattern: /^(96\d{20}|61\d{18}|\d{15}|\d{12}|\d{20}|\d{22})$/, label: 'FedEx' },
  // USPS — 20-22 digit numbers, common prefixes 9400/9300/9200/9405/9270
  { carrier: 'USPS', pattern: /^(9[0-4]\d{18,20}|\d{20,22})$/, label: 'USPS' },
  // Amazon — TBA followed by 12 digits (Amazon Logistics)
  { carrier: 'Amazon', pattern: /^TBA\d{12}$/i, label: 'Amazon' },
  // DHL — 10 digit number
  { carrier: 'Other', pattern: /^\d{10}$/, label: 'DHL' },
];

/**
 * Detect carrier from a tracking number string.
 * Returns the matched carrier or 'Other' if no pattern matches.
 */
export function detectCarrier(trackingNumber: string): Carrier {
  const cleaned = trackingNumber.trim().replace(/\s+/g, '');
  if (!cleaned) return 'Other';

  for (const { carrier, pattern } of PATTERNS) {
    if (pattern.test(cleaned)) {
      return carrier;
    }
  }
  return 'Other';
}

/**
 * Get a human-readable label for a detected carrier.
 * Useful for display in the carrier chip selection.
 */
export function carrierLabel(carrier: Carrier): string {
  const labels: Record<Carrier, string> = {
    Amazon: 'Amazon',
    UPS: 'UPS',
    USPS: 'USPS',
    FedEx: 'FedEx',
    Other: 'Other',
  };
  return labels[carrier] ?? carrier;
}

/**
 * Check if a tracking number looks valid enough to attempt tracking.
 * Minimum length check — most carriers require at least 10 characters.
 */
export function isValidTrackingFormat(trackingNumber: string): boolean {
  const cleaned = trackingNumber.trim().replace(/\s+/g, '');
  return cleaned.length >= 10;
}
