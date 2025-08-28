import { useMutation } from '@tanstack/react-query';
import api from '@/lib/axios';

export const useAi = () => {
  const updateChatMetadataMutation = useMutation<
    { error: boolean; success: boolean },
    Error,
    { id: number; key: string; value: string | boolean }
  >({
    mutationFn: async ({ id, key, value }) => {
      const res = await api.post('/chat/metadata', { id, key, value });
      return res.data;
    },
  });

  return { updateChatMetadataMutation };
};