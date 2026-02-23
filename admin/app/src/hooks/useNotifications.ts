import api from '@/lib/axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

export interface NotificationItem {
  id: number;
  user_id: number;
  type: string;
  title: string;
  body: string;
  link: string;
  meta: {
    platform?: 'website' | 'messenger' | 'instagram' | 'fb_comment' | 'ig_comment' | 'whatsapp';
    conversation_id?: number | string;
    [key: string]: unknown;
  };
  read_at: string | null;
  created_at: string;
  entity_type: string | null;
  entity_id: number | null;
}

export interface UnreadCounts {
  total: number;
  by_type: Record<string, number>;
}

const NOTIFICATIONS_POLL_INTERVAL_MS = 10_000;

export function useNotificationsStream() {
  const queryClient = useQueryClient();
  const lastIdRef = { current: 0 };

  useEffect(() => {
    let mounted = true;
    const poll = async () => {
      if (!mounted) return;
      try {
        const { data } = await api.get<{
          notifications: NotificationItem[];
          last_id: number;
        }>('/notifications/poll', {
          params: { last_id: lastIdRef.current },
        });
        if (!mounted || !data?.notifications?.length) return;
        lastIdRef.current = data.last_id;
        const types = new Set(
          data.notifications.map((n) => n.type).filter(Boolean)
        );
        queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-counts'] });
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        queryClient.invalidateQueries({ queryKey: ['social-counts'] });
        if (types.has('conversation') || types.has('social_message')) {
          queryClient.invalidateQueries({ queryKey: ['social-conversations'] });
        }
      } catch {
        // ignore; next poll will retry
      }
    };

    const interval = setInterval(poll, NOTIFICATIONS_POLL_INTERVAL_MS);
    poll();

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [queryClient]);
}

export function useUnreadCounts() {
  return useQuery({
    queryKey: ['notifications', 'unread-counts'],
    queryFn: async () => {
      const { data } = await api.get<UnreadCounts>('/notifications/unread-counts');
      return data;
    },
  });
}

export function useNotificationsList(params: {
  page?: number;
  per_page?: number;
  read?: 'read' | 'unread' | null;
  type?: string | null;
}) {
  const { page = 1, per_page = 20, read = null, type = null } = params;
  return useQuery({
    queryKey: ['notifications', { page, per_page, read, type }],
    queryFn: async () => {
      const sp = new URLSearchParams();
      sp.set('page', String(page));
      sp.set('per_page', String(per_page));
      if (read) sp.set('read', read);
      if (type) sp.set('type', type);
      const { data } = await api.get<{ data: NotificationItem[]; total: number }>(
        `/notifications?${sp.toString()}`
      );
      return data;
    },
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.post(`/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-counts'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkReadByEntity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { entity_type: string; entity_id: number }) =>
      api.post('/notifications/mark-read-by-entity', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-counts'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkReadByType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (type: string) =>
      api.post('/notifications/mark-read-by-type', { type }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-counts'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/notifications/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-counts'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useClearAllNotifications() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete('/notifications/clear-all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-counts'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
