import { enUS } from 'date-fns/locale';

// Helper function to parse UTC date strings correctly
export function parseUTCDate(dateString: string): Date {
  // If already has timezone info (Z or +/- offset), use as-is
  if (dateString.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(dateString)) {
    return new Date(dateString);
  }
  // If it's a datetime string (has 'T' or space between date and time), treat as UTC
  // MySQL format: "YYYY-MM-DD HH:MM:SS" or ISO format: "YYYY-MM-DDTHH:MM:SS"
  if (
    dateString.includes('T') ||
    /\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/.test(dateString)
  ) {
    // Replace space with 'T' for ISO format, then append 'Z'
    const isoString = dateString.replace(' ', 'T');
    return new Date(isoString + 'Z');
  }
  // Otherwise, parse as-is (date-only strings)
  return new Date(dateString);
}

// Convert stored UTC string to datetime-local value (local time for display)
export function utcToDatetimeLocal(utcStr: string | null | undefined): string {
  if (!utcStr?.trim()) return '';
  const normalized = utcStr.trim().replace(' ', 'T');
  const date = new Date(normalized + (normalized.endsWith('Z') ? '' : 'Z'));
  if (isNaN(date.getTime())) return utcStr;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}T${h}:${min}`;
}

// Normalize MySQL/site datetime to datetime-local format (assumes stored in site/local, no TZ conversion)
export function siteToDatetimeLocal(str: string | null | undefined): string {
  if (!str?.trim()) return '';
  const normalized = str.trim().replace(' ', 'T');
  const date = new Date(normalized);
  if (isNaN(date.getTime())) return str;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}T${h}:${min}`;
}

// Get browser timezone using Intl API
export function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    // Fallback for older browsers
    const offset = -new Date().getTimezoneOffset() / 60;
    return `UTC${offset >= 0 ? '+' : ''}${offset}`;
  }
}

// Default locale for date-fns formatting (can be extended to support other locales)
export const defaultLocale = enUS;

// Helper to parse Unix timestamp (seconds) from server as UTC
export function parseUTCTimestamp(timestamp: number): Date {
  // Unix timestamp in seconds, multiply by 1000 for milliseconds
  // Server timestamps are UTC, so create Date from UTC milliseconds
  return new Date(timestamp * 1000);
}
