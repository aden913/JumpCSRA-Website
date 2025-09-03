import { useState } from 'react';

export function useCalendarSidebar() {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarDateRange, setCalendarDateRange] = useState<[Date | null, Date | null]>([null, null]);
  const hasValidDates = calendarDateRange[0] && calendarDateRange[1];
  return {
    calendarOpen,
    setCalendarOpen,
    calendarDateRange,
    setCalendarDateRange,
    hasValidDates,
  };
}
