import { useState, useMemo, useCallback, useEffect } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { NeighborhoodEvent } from '@/types';
import { mockNeighborhoodEvents } from '@/mocks/neighborhoodEvents';
import { useApp } from '@/store/AppContext';
import { log } from "../lib/logger";

export type FeedFilter = 'today' | 'this_week';

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function isThisWeek(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return d >= weekAgo && d <= now;
}

export const [NeighborhoodProvider, useNeighborhood] = createContextHook(() => {
  const { user } = useApp();
  const [events, setEvents] = useState<NeighborhoodEvent[]>(__DEV__ ? mockNeighborhoodEvents : []);
  const [filter, setFilter] = useState<FeedFilter>('today');
  const [selectedEvent, setSelectedEvent] = useState<NeighborhoodEvent | null>(null);

  const hasLocationConsent = user?.hasLocationConsent ?? false;
  const blockId = 'block-1';

  const filteredEvents = useMemo(() => {
    const blockEvents = events.filter(e => e.blockId === blockId);
    const filtered = filter === 'today'
      ? blockEvents.filter(e => isToday(e.timestamp))
      : blockEvents.filter(e => isThisWeek(e.timestamp));
    return filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [events, filter, blockId]);

  const todayCount = useMemo(() => {
    return events.filter(e => e.blockId === blockId && isToday(e.timestamp)).length;
  }, [events, blockId]);

  const weekCount = useMemo(() => {
    return events.filter(e => e.blockId === blockId && isThisWeek(e.timestamp)).length;
  }, [events, blockId]);

  const selectEvent = useCallback((event: NeighborhoodEvent | null) => {
    setSelectedEvent(event);
  }, []);

  const changeFilter = useCallback((f: FeedFilter) => {
    log('[NeighborhoodContext] Filter changed to:', f);
    setFilter(f);
  }, []);

  return {
    events: filteredEvents,
    filter,
    changeFilter,
    selectedEvent,
    selectEvent,
    hasLocationConsent,
    todayCount,
    weekCount,
  };
});
