import { useUnreadCounts } from '@/hooks/useNotifications';
import { useEffect, useRef } from 'react';

const FALLBACK_BASE_TITLE = 'Helpmate';
const FLASH_TITLE = 'New notification — Helpmate';
const FLASH_INTERVAL_MS = 700;
const FLASH_ITERATIONS = 8;
const TITLE_REAPPLY_MS = 2000;

function getTitleWithCount(count: number, baseTitle: string): string {
  return count > 0 ? `(${count}) ${baseTitle}` : baseTitle;
}

function updateSidebarBadge(count: number): void {
  const el = document.querySelector(
    '#adminmenu li.toplevel_page_helpmate .wp-menu-name'
  );
  if (!el) return;
  if (count > 0) {
    el.innerHTML = `Helpmate <span class="awaiting-mod">${count}</span>`;
  } else {
    el.textContent = 'Helpmate';
  }
}

/**
 * Syncs unread notification count to document.title and WP sidebar parent menu.
 * Flashes the tab title when count increases and tab is in background.
 */
export function NotificationTitleSync() {
  const { data: unreadCounts } = useUnreadCounts();
  const total = unreadCounts?.total ?? 0;
  const baseTitleRef = useRef<string>(FALLBACK_BASE_TITLE);
  const totalRef = useRef(total);
  const prevTotalRef = useRef<number | null>(null);
  const flashIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isFlashingRef = useRef(false);
  totalRef.current = total;

  // Capture WP admin title once on mount so we can prepend count without replacing the whole title
  useEffect(() => {
    const current = document.title?.trim();
    if (current) baseTitleRef.current = current;
  }, []);

  // Document title + sidebar badge when count changes
  useEffect(() => {
    const base = baseTitleRef.current;
    const titleWithCount = getTitleWithCount(total, base);
    if (!isFlashingRef.current) {
      document.title = titleWithCount;
    }
    updateSidebarBadge(total);
  }, [total]);

  // Re-apply title periodically so we win over WordPress or other scripts that overwrite it
  useEffect(() => {
    const interval = setInterval(() => {
      if (isFlashingRef.current) return;
      const base = baseTitleRef.current;
      document.title = getTitleWithCount(total, base);
    }, TITLE_REAPPLY_MS);
    return () => clearInterval(interval);
  }, [total]);

  // Tab flash when count increases and tab is hidden
  useEffect(() => {
    const prev = prevTotalRef.current;
    prevTotalRef.current = total;

    // First load: no flash
    if (prev === null) return;
    // Count did not increase: no flash
    if (total <= prev) return;
    // Tab visible: no flash
    if (!document.hidden) return;
    // Already flashing: don't start another
    if (isFlashingRef.current) return;

    isFlashingRef.current = true;
    const normalTitle = getTitleWithCount(total, baseTitleRef.current);
    let iterations = 0;

    const interval = setInterval(() => {
      document.title =
        document.title === normalTitle ? FLASH_TITLE : normalTitle;
      iterations += 1;
      if (iterations >= FLASH_ITERATIONS) {
        if (flashIntervalRef.current) {
          clearInterval(flashIntervalRef.current);
          flashIntervalRef.current = null;
        }
        document.title = normalTitle;
        isFlashingRef.current = false;
      }
    }, FLASH_INTERVAL_MS);

    flashIntervalRef.current = interval;

    // Don't clear interval in cleanup here — it would run when `total` changes
    // and kill a running flash. Interval clears itself, visibilitychange clears it,
    // and unmount effect clears it.
  }, [total]);

  // Cancel flash and restore title when user focuses tab
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (flashIntervalRef.current) {
          clearInterval(flashIntervalRef.current);
          flashIntervalRef.current = null;
        }
        isFlashingRef.current = false;
        document.title = getTitleWithCount(
          totalRef.current,
          baseTitleRef.current
        );
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () =>
      document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  // Cleanup flash interval on unmount
  useEffect(() => {
    return () => {
      if (flashIntervalRef.current) {
        clearInterval(flashIntervalRef.current);
      }
    };
  }, []);

  return null;
}
