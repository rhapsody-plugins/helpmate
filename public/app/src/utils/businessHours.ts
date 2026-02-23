const DAY_KEYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

export type BusinessHours = Record<
  string,
  { enabled: boolean; startTime: string; endTime: string }
>;

/** Weekday short names as returned by Intl (en-US) for mapping to day index 0–6 (Sun–Sat). */
const WEEKDAY_SHORT: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/**
 * Returns true if the current time (in browser local time or given timezone) falls
 * within any enabled day's startTime–endTime range.
 * @param businessHours Per-day config (enabled, startTime, endTime).
 * @param timezone Optional IANA timezone (e.g. 'America/New_York'). When set, "now" is evaluated in this timezone so the widget matches the server.
 */
export function isWithinBusinessHours(
  businessHours: BusinessHours | undefined,
  timezone?: string
): boolean {
  if (!businessHours || typeof businessHours !== 'object') {
    return false;
  }

  const tz = timezone?.trim();
  let dayIndex: number;
  let currentMinutes: number;

  if (tz) {
    try {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hour: 'numeric',
        minute: 'numeric',
        hour12: false,
        weekday: 'short',
      });
      const parts = formatter.formatToParts(now);
      let hour = 0;
      let minute = 0;
      let weekday = 'Sun';
      for (const p of parts) {
        if (p.type === 'hour') hour = parseInt(p.value, 10);
        if (p.type === 'minute') minute = parseInt(p.value, 10);
        if (p.type === 'weekday') weekday = p.value;
      }
      dayIndex = WEEKDAY_SHORT[weekday] ?? 0;
      currentMinutes = hour * 60 + minute;
    } catch {
      const now = new Date();
      dayIndex = now.getDay();
      currentMinutes = now.getHours() * 60 + now.getMinutes();
    }
  } else {
    const now = new Date();
    dayIndex = now.getDay();
    currentMinutes = now.getHours() * 60 + now.getMinutes();
  }

  const dayKey = DAY_KEYS[dayIndex];
  const dayConfig = businessHours[dayKey];

  if (!dayConfig?.enabled) {
    return false;
  }

  const [startH, startM] = (dayConfig.startTime || '09:00').split(':').map(Number);
  const [endH, endM] = (dayConfig.endTime || '17:00').split(':').map(Number);

  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}
