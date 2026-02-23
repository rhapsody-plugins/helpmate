import api from '@/lib/axios';
import {
  CrmAnalyticsData,
  DateFilter,
  AnalyticsPreferences,
  DEFAULT_VISIBLE_REPORTS,
} from '@/types/crm-analytics';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { toast } from 'sonner';

export function useCrmAnalytics() {
  const queryClient = useQueryClient();

  // Get CRM analytics data
  const useCrmAnalytics = (
    dateFilter: DateFilter = 'today',
    userId?: number | null
  ) => {
    return useQuery<CrmAnalyticsData>({
      queryKey: ['crm-analytics', dateFilter, userId],
      queryFn: async () => {
        const params: Record<string, string | number> = {
          date_filter: dateFilter,
        };
        if (userId) {
          params.user_id = userId;
        }

        const response = await api.get<{
          error: boolean;
          data: CrmAnalyticsData;
        }>('/crm/analytics', { params });

        if (response.data.error) {
          throw new Error('Failed to fetch analytics data');
        }

        return response.data.data;
      },
      refetchOnWindowFocus: false,
    });
  };

  // Get analytics preferences
  const useAnalyticsPreferences = () => {
    return useQuery<AnalyticsPreferences>({
      queryKey: ['crm-analytics-preferences'],
      queryFn: async () => {
        const response = await api.get<{
          error: boolean;
          data: AnalyticsPreferences;
        }>('/crm/analytics/preferences');

        if (response.data.error) {
          throw new Error('Failed to fetch preferences');
        }

        // Ensure visible_reports is always an array
        const preferences = response.data.data;
        if (!preferences.visible_reports || !Array.isArray(preferences.visible_reports)) {
          return {
            visible_reports: DEFAULT_VISIBLE_REPORTS,
          };
        }

        return preferences;
      },
      refetchOnWindowFocus: false,
    });
  };

  // Update analytics preferences
  const updatePreferencesMutation = useMutation({
    mutationFn: async (preferences: AnalyticsPreferences) => {
      const response = await api.post<{
        error: boolean;
        message: string;
        data: AnalyticsPreferences;
      }>('/crm/analytics/preferences', preferences);

      if (response.data.error) {
        throw new Error(response.data.message || 'Failed to save preferences');
      }

      return response.data.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['crm-analytics-preferences'], data);
      toast.success('Report preferences saved successfully');
    },
    onError: (error: AxiosError<{ message?: string }>) => {
      toast.error(
        error.response?.data?.message || 'Failed to save preferences'
      );
    },
  });

  return {
    useCrmAnalytics,
    useAnalyticsPreferences,
    updatePreferencesMutation,
  };
}

