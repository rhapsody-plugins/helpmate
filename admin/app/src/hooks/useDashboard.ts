import api from '@/lib/axios';
import { useMutation, useQuery } from '@tanstack/react-query';

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
        total_tickets_by_source?: Record<string, number>;
        total_leads: number;
        total_leads_by_source?: Record<string, number>;
        crm_conversion_rate?: number;
        avg_messages_per_session: number;
        avg_resolution_time: number;
        comparison: {
          tickets_change: number;
          leads_change: number;
          crm_conversion_rate_change?: number;
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
      user_id?: number;
    }
  >({
    mutationFn: async ({ date_filter, user_id }) => {
      const params: Record<string, string | number> = { date_filter };
      if (user_id) {
        params.user_id = user_id;
      }
      const response = await api.get('/dashboard/statistics', { params });
      if (response.data.error) {
        throw new Error(response.data.message);
      }
      return response.data.data;
    },
  });

  const getDashboardOverviewQuery = useQuery<
    {
      total_chats: number;
      total_contacts: number;
      employee_of_month: {
        user_id: number;
        display_name: string;
        email: string;
        score: number;
      } | null;
      total_knowledge_bases: number;
    },
    Error
  >({
    queryKey: ['dashboard-overview'],
    queryFn: async () => {
      const response = await api.get('/dashboard/overview');
      if (response.data.error) {
        throw new Error(response.data.message);
      }
      return response.data.data;
    },
    refetchOnWindowFocus: false,
  });

  return { getDashboardDataMutation, getDashboardOverviewQuery };
};
