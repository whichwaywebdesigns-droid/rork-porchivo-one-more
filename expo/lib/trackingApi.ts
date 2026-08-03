export {
  trackShipment,
  isShip24Configured,
  milestoneToPackageStatus,
  milestoneToDeliveryStatus,
  friendlyMilestoneLabel,
} from '@/lib/ship24';

export type {
  Ship24Milestone as TrackingMilestone,
  Ship24Event as TrackingEvent,
  Ship24Shipment as TrackingShipment,
  Ship24Statistics as TrackingStatistics,
  Ship24Tracker as Tracker,
  Ship24TrackingResult as TrackingResult,
  Ship24TrackResponse as TrackResponse,
} from '@/lib/ship24';
