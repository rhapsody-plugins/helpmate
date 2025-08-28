import api from '@/lib/axios';
import { useMutation } from '@tanstack/react-query';

export const useDashboard = () => {
  const getDashboardDataMutation = useMutation<
    {
      orders: {
        total_orders: number;
        total_chat_sessions: number;
        conversion_rate: number;
        comparison: {
          orders_change: number;
          sessions_change: number;
          conversion_change: number;
        };
      };
      sales: {
        roi: number;
        aov: number;
        comparison: {
          roi_change: number;
          aov_change: number;
        };
      };
      revenue: {
        total: number;
        chart_data: Record<string, number>;
        comparison: {
          revenue_change: number;
        };
      };
      statistics: {
        total_tickets: number;
        total_leads: number;
        avg_messages_per_session: number;
        avg_resolution_time: number;
        comparison: {
          tickets_change: number;
          leads_change: number;
          avg_messages_change: number;
          resolution_time_change: number;
        };
      };
    },
    Error,
    {
      date_filter:
        | 'today'
        | 'yesterday'
        | 'last_week'
        | 'last_month'
        | 'last_year';
    }
  >({
    mutationFn: async ({ date_filter }) => {
      const response = await api.get('/dashboard/statistics', {
        params: {
          date_filter,
        },
      });
      if (response.data.error) {
        throw new Error(response.data.message);
      }
      return response.data.data;
    },
  });

  return { getDashboardDataMutation };
};
