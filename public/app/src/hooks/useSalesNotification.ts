import api from '@/lib/axios';
import { useQuery } from '@tanstack/react-query';
import { RecentSaleNotification } from '../types';
import { useSettings } from '@/hooks/useSettings';

export const useSalesNotification = () => {
  const { getSettingsQuery } = useSettings();
  const { data: settings } = getSettingsQuery;
  const { 'sales-notifications': salesNotifications = false } =
    settings.modules;

  const getRecentSaleNotification = useQuery<RecentSaleNotification | null>({
    queryKey: ['sales-notification'],
    queryFn: async () => {
      const res = await api.get('/sales-notification');
      return res.data;
    },
    enabled: salesNotifications && settings.is_woocommerce_active,
    refetchOnWindowFocus: false,
    initialData: null,
    staleTime: 0,
    refetchInterval:
      (settings.settings.sales_notification_show_frequency as number) *
      60 *
      1000,
  });

  return { getRecentSaleNotification };
};
