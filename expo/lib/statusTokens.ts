import { palette } from '@/constants/theme';

export type DeliveryStatus =
  | 'ordered'
  | 'shipped'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'delivered_to_homeowner'
  | 'picked_up'
  | 'returned'
  | 'pending'
  | 'unknown';

export type StatusToken = {
  label: string;
  fg: string;
  bg: string;
  live?: boolean;
  icon: 'truck' | 'check' | 'bell' | 'box' | 'rotate' | 'clock';
};

const TOKENS: Record<DeliveryStatus, StatusToken> = {
  ordered: { label: 'Ordered', fg: palette.slate700, bg: palette.slate100, icon: 'box' },
  shipped: { label: 'Shipped', fg: palette.navySoft, bg: palette.sky, icon: 'truck' },
  in_transit: { label: 'In transit', fg: palette.navySoft, bg: palette.sky, icon: 'truck' },
  out_for_delivery: {
    label: 'Out for delivery',
    fg: palette.emberDeep,
    bg: palette.emberSoft,
    live: true,
    icon: 'bell',
  },
  delivered: { label: 'Delivered', fg: palette.sage, bg: palette.sageSoft, icon: 'check' },
  delivered_to_homeowner: {
    label: 'Delivered',
    fg: palette.sage,
    bg: palette.sageSoft,
    icon: 'check',
  },
  picked_up: { label: 'Picked up', fg: palette.navy, bg: palette.sky, icon: 'check' },
  returned: { label: 'Returned', fg: palette.rose, bg: palette.roseSoft, icon: 'rotate' },
  pending: { label: 'Pending', fg: palette.slate500, bg: palette.slate100, icon: 'clock' },
  unknown: { label: 'Awaiting tracking', fg: palette.slate500, bg: palette.slate100, icon: 'truck' },
};

export function getStatusToken(status: string | null | undefined, hasTracking: boolean = false): StatusToken {
  const key = (status ?? '') as DeliveryStatus;
  if (TOKENS[key]) return TOKENS[key];
  if (hasTracking) return { label: 'Tracking active', fg: palette.navy, bg: palette.sky, icon: 'truck' };
  return TOKENS.unknown;
}

export const statusTokens = TOKENS;
