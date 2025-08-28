import api from '@/lib/axios';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { toast } from 'sonner';

interface LicenseData {
  license_key: string;
  local_credits: {
    feature_slug: string;
    credits: number;
    usages: number;
  }[];
  last_sync: number;
  product_slug: string;
  social_credits: boolean;
  signup_credits: boolean;
  customer_id: string;
}

export function useLicense() {
  const licenseQuery = useQuery<LicenseData, Error>({
    queryKey: ['license'],
    queryFn: async () => {
      const response = await api.get('/license');
      if (response.data.error) {
        toast.error(response.data.message);
        return null;
      }
      return response.data;
    },
  });

  const syncCreditsMutation = useMutation({
    mutationFn: async () => {
      const response = await api.get('/feature-usage');
      return response.data;
    },
    onSuccess: () => {
      licenseQuery.refetch();
    },
  });

  const activateLicenseMutation = useMutation({
    mutationFn: async (licenseKey: string) => {
      const response = await api.post('/activate-license', {
        license_key: licenseKey,
      });
      if (response.data.success) {
        toast.success(response.data.message);
        licenseQuery.refetch();
        return response.data;
      } else {
        toast.error(response.data.error);
      }
    },
    onError: (error: unknown) => {
      if (error instanceof AxiosError) {
        toast.error(error.response?.data.error);
      } else {
        toast.error('An error occurred while activating the license');
      }
    },
  });

  const claimCreditsMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/claim-credits');
      return response.data;
    },
    onSuccess: () => {
      licenseQuery.refetch();
    },
    onError: (error: unknown) => {
      if (error instanceof AxiosError) {
        toast.error(error.response?.data.error);
      } else {
        toast.error('An error occurred while claiming credits');
      }
    },
  });

  return {
    licenseQuery,
    syncCreditsMutation,
    activateLicenseMutation,
    claimCreditsMutation,
  };
}
