import { useNotificationsStream } from '@/hooks/useNotifications';

interface NotificationsProviderProps {
  children: React.ReactNode;
}

/** Opens SSE stream for notifications and invalidates unread-counts + list on events. */
export function NotificationsProvider({ children }: NotificationsProviderProps) {
  useNotificationsStream();
  return <>{children}</>;
}
