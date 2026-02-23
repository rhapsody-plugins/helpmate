import api from '@/lib/axios';
import { useQuery } from '@tanstack/react-query';

/** Shape expected by Pro components (OrderTracker, RefundReturn) */
interface BotSettingsResponse {
  api?: boolean;
  is_pro?: boolean;
  settings?: {
    order_tracker_email_required?: boolean;
    order_tracker_phone_required?: boolean;
    refund_return_reasons?: string[];
  };
}

export function useBotSettings() {
  const getSettingsQuery = useQuery<BotSettingsResponse, Error>({
    queryKey: ['bot-settings'],
    queryFn: async () => {
      const res = await api.get('/bot-settings');
      return res.data;
    },
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  return { getSettingsQuery };
}
