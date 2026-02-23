import api from '@/lib/axios';
import { useQuery } from '@tanstack/react-query';
import { DateFilter } from '@/types/crm-analytics';

export interface Review {
  id: number;
  session_id: string;
  conversation_id: string;
  rating: number;
  message: string | null;
  created_at: string;
}

export interface ReviewAnalytics {
  average_rating: number;
  total_reviews: number;
  reviews_this_period: number;
  reviews_list: Review[];
}

// Convert date filter to date range
const convertDateFilterToRange = (dateFilter: DateFilter): { date_from: string; date_to: string } => {
  const now = new Date();
  let date_from: Date;
  let date_to: Date = new Date(now);

  switch (dateFilter) {
    case 'today':
      date_from = new Date(now.setHours(0, 0, 0, 0));
      break;
    case 'yesterday':
      date_from = new Date(now);
      date_from.setDate(date_from.getDate() - 1);
      date_from.setHours(0, 0, 0, 0);
      date_to = new Date(date_from);
      date_to.setHours(23, 59, 59, 999);
      break;
    case 'last_week':
      date_from = new Date(now);
      date_from.setDate(date_from.getDate() - 7);
      break;
    case 'last_month':
      date_from = new Date(now);
      date_from.setMonth(date_from.getMonth() - 1);
      break;
    case 'last_year':
      date_from = new Date(now);
      date_from.setFullYear(date_from.getFullYear() - 1);
      break;
    default:
      date_from = new Date(now);
      date_from.setDate(date_from.getDate() - 30);
  }

  return {
    date_from: date_from.toISOString().split('T')[0],
    date_to: date_to.toISOString().split('T')[0],
  };
};

export function useReviews() {
  const useReviewAnalytics = (dateFilter: DateFilter, userId?: number | null) => {
    const { date_from, date_to } = convertDateFilterToRange(dateFilter);

    return useQuery({
      queryKey: ['review-analytics', dateFilter, userId],
      queryFn: async () => {
        const params: Record<string, string | number> = {
          date_from,
          date_to,
        };
        if (userId) {
          params.user_id = userId;
        }
        const response = await api.get<{
          error: boolean;
          data: ReviewAnalytics;
        }>('/analytics/reviews', { params });
        return response.data.data;
      },
    });
  };

  return {
    useReviewAnalytics,
  };
}

