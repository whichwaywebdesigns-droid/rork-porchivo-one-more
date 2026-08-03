import { NeighborhoodEvent } from '@/types';

const now = new Date();

function hoursAgo(h: number): string {
  return new Date(now.getTime() - h * 60 * 60 * 1000).toISOString();
}

function minutesAgo(m: number): string {
  return new Date(now.getTime() - m * 60 * 1000).toISOString();
}

function daysAgo(d: number, h = 0): string {
  return new Date(now.getTime() - (d * 24 + h) * 60 * 60 * 1000).toISOString();
}

export const mockNeighborhoodEvents: NeighborhoodEvent[] = [
  {
    id: 'ne-1',
    type: 'package_delivered',
    title: 'Package delivered on your block',
    description: 'A package was safely delivered to a neighbor on your block. The area is active with deliveries today.',
    relativeLocation: 'On your block',
    timestamp: minutesAgo(2),
    blockId: 'block-1',
  },
  {
    id: 'ne-2',
    type: 'partner_pickup',
    title: 'Porch partner picked up a package',
    description: 'A Porch Partner secured a delivery nearby. One less package sitting unattended on a porch.',
    relativeLocation: '3 houses away',
    timestamp: minutesAgo(18),
    blockId: 'block-1',
  },
  {
    id: 'ne-3',
    type: 'delivery_in_progress',
    title: 'Delivery in progress nearby',
    description: 'A carrier is making deliveries on your block right now. Keep an eye out for your neighbors.',
    relativeLocation: 'Nearby',
    timestamp: minutesAgo(35),
    blockId: 'block-1',
  },
  {
    id: 'ne-4',
    type: 'package_returned',
    title: 'Package returned to owner',
    description: 'A neighbor received their package back from a Porch Partner. Another successful handoff in your neighborhood.',
    relativeLocation: '5 houses away',
    timestamp: hoursAgo(1),
    blockId: 'block-1',
  },
  {
    id: 'ne-5',
    type: 'new_partner_joined',
    title: 'New Porch Partner on your block',
    description: 'Someone in your neighborhood just signed up as a Porch Partner. Your block is getting safer.',
    relativeLocation: 'On your block',
    timestamp: hoursAgo(3),
    blockId: 'block-1',
  },
  {
    id: 'ne-6',
    type: 'partner_pickup',
    title: 'Porch partner picked up a package',
    description: 'Another successful pickup by a Porch Partner. Neighbors looking out for each other.',
    relativeLocation: '2 houses away',
    timestamp: hoursAgo(5),
    blockId: 'block-1',
  },
  {
    id: 'ne-7',
    type: 'package_delivered',
    title: 'Package delivered on your block',
    description: 'A FedEx delivery was made on your block. Stay alert and help keep porches clear.',
    relativeLocation: '4 houses away',
    timestamp: hoursAgo(7),
    blockId: 'block-1',
  },
  {
    id: 'ne-8',
    type: 'package_returned',
    title: 'Package returned to owner',
    description: 'A neighbor picked up their package from a Porch Partner. Your block stays safe.',
    relativeLocation: 'Nearby',
    timestamp: daysAgo(1, 2),
    blockId: 'block-1',
  },
  {
    id: 'ne-9',
    type: 'package_delivered',
    title: 'Package delivered on your block',
    description: 'An Amazon delivery was dropped off nearby. The neighborhood watch is active.',
    relativeLocation: '6 houses away',
    timestamp: daysAgo(1, 5),
    blockId: 'block-1',
  },
  {
    id: 'ne-10',
    type: 'partner_pickup',
    title: 'Porch partner picked up a package',
    description: 'A Porch Partner grabbed a package before it sat too long. Teamwork makes the dream work.',
    relativeLocation: '3 houses away',
    timestamp: daysAgo(1, 8),
    blockId: 'block-1',
  },
  {
    id: 'ne-11',
    type: 'delivery_in_progress',
    title: 'Delivery in progress nearby',
    description: 'UPS is making rounds in your area. Multiple deliveries expected today.',
    relativeLocation: 'On your block',
    timestamp: daysAgo(2, 1),
    blockId: 'block-1',
  },
  {
    id: 'ne-12',
    type: 'new_partner_joined',
    title: 'New Porch Partner on your block',
    description: 'Your neighborhood is growing stronger. Another neighbor is ready to help protect deliveries.',
    relativeLocation: 'Nearby',
    timestamp: daysAgo(3),
    blockId: 'block-1',
  },
  {
    id: 'ne-13',
    type: 'package_delivered',
    title: 'Package delivered on your block',
    description: 'A USPS delivery completed on your block. Porchivo is watching.',
    relativeLocation: '2 houses away',
    timestamp: daysAgo(4, 3),
    blockId: 'block-1',
  },
  {
    id: 'ne-14',
    type: 'partner_pickup',
    title: 'Porch partner picked up a package',
    description: 'Quick pickup by a local Porch Partner. No package left behind.',
    relativeLocation: '5 houses away',
    timestamp: daysAgo(5, 6),
    blockId: 'block-1',
  },
];
