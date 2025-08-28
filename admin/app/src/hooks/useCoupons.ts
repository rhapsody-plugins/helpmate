import { useSettings } from '@/hooks/useSettings';
import api from '@/lib/axios';
import { Coupon } from '@/types';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

export default function useCoupons() {
  const { getProQuery } = useSettings();

  const getCouponsQuery = useQuery<Coupon[]>({
    queryKey: ['coupons'],
    queryFn: async () => {
      const response = await api.get('/coupons');
      if (response.data.error) {
        toast.error(response.data.message);
      }
      return response.data.coupons;
    },
    initialData: [],
    refetchOnWindowFocus: false,
    enabled: getProQuery.data,
  });

  return { getCouponsQuery };
}
