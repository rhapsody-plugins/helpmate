import api from '@/lib/axios';
import { PaginationParams, PaginationResponse, RefundReturnType } from '@/types';
import { useMutation } from '@tanstack/react-query';

export default function useRefundReturn() {
  const getRefundReturns = useMutation<
    { items: RefundReturnType[]; pagination: PaginationResponse },
    Error,
    PaginationParams
  >({
    mutationFn: async ({ page, per_page }: PaginationParams) => {
      const response = await api.get('/refund-return/all', {
        params: { page, per_page },
      });
      if (!response.data.error) {
        return response.data;
      }
      return {
        items: [],
        pagination: {
          total: 0,
          per_page: 10,
          current_page: 1,
          total_pages: 0,
        },
      };
    },
  });

  const updateRefundReturn = useMutation<
    { error: boolean; message: string },
    Error,
    { id: string; status: string; template_id?: number }
  >({
    mutationFn: async ({ id, status, template_id }) => {
      const response = await api.post(`/refund-return/${id}`, { status, template_id });
      if (response.data.error) {
        throw new Error(response.data.message);
      }
      return response.data;
    },
  });

  return { getRefundReturns, updateRefundReturn };
}
