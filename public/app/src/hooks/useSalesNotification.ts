import api from '@/lib/axios';
import type { RecentSaleNotification } from '@/types';
import { useQuery } from '@tanstack/react-query';
import { useSettings } from '@/hooks/useSettings';

export const useSalesNotification = () => {
  const { getSettingsQuery } = useSettings();
  const { data: settings } = getSettingsQuery;
  const salesNotifications = settings?.modules?.['sales-notifications'] ?? false;
  const showFrequency =
    Number(settings?.settings?.sales_notification_show_frequency) || 8;
  const refetchIntervalMs = Math.max(3000, showFrequency * 1000);

  const getRecentSaleNotification = useQuery<RecentSaleNotification | null>({
    queryKey: ['sales-notification'],
    queryFn: async () => {
      const res = await api.get('/sales-notification');
      const data = res.data;
      if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
        return null;
      }
      return data as RecentSaleNotification;
    },
    enabled:
      Boolean(salesNotifications) &&
      Boolean(
        settings?.sales_notification_commerce_active ??
          settings?.is_woocommerce_active
      ),
    refetchOnWindowFocus: false,
    initialData: null,
    staleTime: 0,
    refetchInterval: refetchIntervalMs,
  });

  return { getRecentSaleNotification };
};
