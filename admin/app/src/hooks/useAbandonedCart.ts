import { useSettings } from '@/hooks/useSettings';
import api from '@/lib/axios';
import { AbandonedCartType } from '@/types';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

interface AbandonedCartAnalytics {
  total_abandoned_count: number;
  total_abandoned_amount: number;
  total_retrieved_count: number;
  total_retrieved_amount: number;
  recovery_rate?: number;
  avg_recovery_time?: number;
}

export interface AbandonedCartsPagination {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

export interface AbandonedCartsListResult {
  carts: AbandonedCartType[];
  pagination: AbandonedCartsPagination;
}

export interface UseAbandonedCartListParams {
  page?: number;
  perPage?: number;
  search?: string;
  /** When false, list query does not run (e.g. contact tab before email is known). */
  listEnabled?: boolean;
}

export default function useAbandonedCart(
  listParams: UseAbandonedCartListParams = {}
) {
  const { getProQuery } = useSettings();
  const page = listParams.page ?? 1;
  const perPage = listParams.perPage ?? 50;
  const search = listParams.search ?? '';
  const listEnabled = listParams.listEnabled ?? true;

  const getAbandonedCarts = useQuery<AbandonedCartsListResult>({
    queryKey: ['abandoned-carts', page, perPage, search],
    queryFn: async () => {
      const response = await api.get('/get-abandoned-carts', {
        params: {
          page,
          per_page: perPage,
          ...(search.trim() ? { search: search.trim() } : {}),
        },
      });
      if (!response.data.error) {
        const p = response.data.pagination;
        return {
          carts: (response.data.abandoned_carts ?? []) as AbandonedCartType[],
          pagination: {
            page: p?.page ?? page,
            per_page: p?.per_page ?? perPage,
            total: p?.total ?? 0,
            total_pages: p?.total_pages ?? 1,
          },
        };
      }
      return {
        carts: [],
        pagination: {
          page: 1,
          per_page: perPage,
          total: 0,
          total_pages: 1,
        },
      };
    },
    initialData: {
      carts: [],
      pagination: {
        page: 1,
        per_page: perPage,
        total: 0,
        total_pages: 1,
      },
    },
    enabled: Boolean(getProQuery.data && listEnabled),
  });

  const getAnalytics = useQuery<AbandonedCartAnalytics>({
    queryKey: ['abandoned-cart-analytics'],
    queryFn: async () => {
      const response = await api.get('/abandoned-cart/analytics');
      if (!response.data.error) {
        return response.data.analytics;
      }
      return {
        total_abandoned_count: 0,
        total_abandoned_amount: 0,
        total_retrieved_count: 0,
        total_retrieved_amount: 0,
        recovery_rate: 0,
        avg_recovery_time: 0,
      };
    },
    enabled: getProQuery.data,
  });

  const sendEmail = useMutation({
    mutationFn: async (data: {
      id: number;
      user_id: number;
      template_id: number;
      cart_data: unknown;
      to_email?: string;
      to_name?: string;
    }) => {
      const response = await api.post('/abandoned-cart/send-email', {
        id: data.id,
        user_id: data.user_id,
        template_id: data.template_id,
        cart_data: data.cart_data,
        ...(data.to_email ? { to_email: data.to_email } : {}),
        ...(data.to_name ? { to_name: data.to_name } : {}),
      });
      return response.data;
    },
    onSuccess: (res: { error?: boolean }) => {
      if (res?.error) {
        toast.error('Failed to send email');
        return;
      }
      toast.success('Email sent successfully');
      getAbandonedCarts.refetch();
    },
    onError: () => {
      toast.error('Failed to send email');
    },
  });

  const saveEmailTemplate = useMutation({
    mutationFn: async (data: {
      template_name: string;
      email_subject: string;
      email_body: string;
    }) => {
      const response = await api.post('/email-templates/save', data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Email template saved successfully');
      getAbandonedCarts.refetch();
    },
  });

  const updateEmailTemplate = useMutation({
    mutationFn: async (data: {
      id: number;
      template_name: string;
      email_subject: string;
      email_body: string;
    }) => {
      const response = await api.post(`/email-templates/${data.id}`, data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Email template updated successfully');
      getAbandonedCarts.refetch();
    },
    onError: () => {
      toast.error('Failed to update email template');
    },
  });
  const deleteEmailTemplate = useMutation({
    mutationFn: async (id: number) => {
      const response = await api.post(`/email-templates/${id}/delete`);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Email template deleted successfully');
      getAbandonedCarts.refetch();
    },
    onError: () => {
      toast.error('Failed to delete email template');
    },
  });

  return {
    getAbandonedCarts,
    getAnalytics,
    sendEmail,
    saveEmailTemplate,
    updateEmailTemplate,
    deleteEmailTemplate,
  };
}
