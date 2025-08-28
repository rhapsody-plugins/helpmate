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

export default function useAbandonedCart() {
  const { getProQuery } = useSettings();

  const getAbandonedCarts = useQuery<AbandonedCartType[]>({
    queryKey: ['abandoned-carts'],
    queryFn: async () => {
      const response = await api.get('/get-abandoned-carts');
      if (!response.data.error) {
        return response.data.abandoned_carts;
      }
      return [];
    },
    initialData: [],
    enabled: getProQuery.data,
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
      cart_data: string;
    }) => {
      const response = await api.post('/abandoned-cart/send-email', data);
      return response.data;
    },
    onSuccess: () => {
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
      const response = await api.delete(`/email-templates/${id}`);
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
