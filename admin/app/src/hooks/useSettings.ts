import api from '@/lib/axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface MutationContext {
  previousSettings: Record<string, object> | undefined;
}

export function useSettings() {
  const queryClient = useQueryClient();

  const getModulesQuery = useQuery<Record<string, object>, Error, string>({
    queryKey: ['modules'],
    queryFn: async () => {
      const response = await api.get('/settings/modules');
      return response.data ?? {};
    },
    refetchOnWindowFocus: false,
  });

  const getSettingsMutation = useMutation<
    Record<string, unknown>,
    Error,
    string
  >({
    mutationFn: async (key: string) => {
      const response = await api.get(`/settings/${key}`);
      return response.data;
    },
    onError: () => {
      toast.error('Failed to fetch settings');
    },
  });

  const updateSettingsMutation = useMutation<
    { error: boolean; message: string },
    Error,
    { key: string; data: object },
    MutationContext
  >({
    mutationFn: async ({ key, data }) => {
      const response = await api.post('/settings', { [key]: data });
      return response.data;
    },
    onMutate: async ({ key, data }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['settings', key] });

      // Snapshot the previous value
      const previousSettings = queryClient.getQueryData<Record<string, object>>(
        ['settings', key]
      );

      // Optimistically update to the new value
      queryClient.setQueryData(['settings', key], data);

      return { previousSettings };
    },
    onError: (_, { key }, context) => {
      // Revert to the previous value on error
      if (context?.previousSettings) {
        queryClient.setQueryData(['settings', key], context.previousSettings);
      }
      toast.error('Failed to update settings');
    },
    onSuccess: (data) => {
      toast.success(data.message);
    },
  });

  const getProQuery = useQuery<boolean, Error>({
    queryKey: ['pro'],
    queryFn: async () => {
      const response = await api.get('/pro');
      return response.data;
    },
  });



  return {
    getModulesQuery,
    getSettingsMutation,
    updateSettingsMutation,
    getProQuery,
  };
}
