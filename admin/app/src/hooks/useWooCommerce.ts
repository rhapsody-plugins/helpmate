import api from '@/lib/axios';
import { useQuery } from '@tanstack/react-query';

interface WooCommerceResponse {
  error: boolean;
  installed: boolean;
}

export function useWooCommerce() {
  const wooCommerceQuery = useQuery<WooCommerceResponse, Error>({
    queryKey: ['woocommerce'],
    queryFn: async () => {
      const response = await api.get('/check-woocommerce');
      return response.data;
    },
    refetchOnWindowFocus: false,
  });

  return {
    wooCommerceQuery,
    isWooCommerceInstalled: wooCommerceQuery.data?.installed ?? false,
    isLoading: wooCommerceQuery.isLoading,
    error: wooCommerceQuery.error,
  };
}