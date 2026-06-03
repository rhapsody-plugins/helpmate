import api from '@/lib/axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { toast } from 'sonner';

interface ApiKeyData {
  api_key: string;
  local_credits: {
    feature_slug: string;
    credits: number;
    usages: number;
  }[];
  last_sync: number;
  product_slug: string;
  customer_id: string;
}

export interface ApiKeyDocumentsResult {
  action: 'synced_all' | 'none';
  imported: number;
  skipped_quick_train: boolean;
  error?: string;
}

export interface ApiKeyActivationResponse {
  success: boolean;
  message?: string;
  error?: string;
  documents?: ApiKeyDocumentsResult;
}

function invalidateAfterDocumentSync(
  queryClient: ReturnType<typeof useQueryClient>,
  documents?: ApiKeyDocumentsResult
) {
  if (documents?.action !== 'synced_all') {
    return;
  }
  void queryClient.invalidateQueries({ queryKey: ['dashboard-checklist'] });
  void queryClient.invalidateQueries({ queryKey: ['tools', 'qdrant-preview'] });
  void queryClient.invalidateQueries({ queryKey: ['api-key'] });
}

function invalidateAfterApiKeySaved(
  queryClient: ReturnType<typeof useQueryClient>,
  documents?: ApiKeyDocumentsResult
) {
  void queryClient.invalidateQueries({ queryKey: ['localhost-migration-sources'] });
  invalidateAfterDocumentSync(queryClient, documents);
}

export function useApi() {
  const queryClient = useQueryClient();

  const apiKeyQuery = useQuery<ApiKeyData, Error>({
    queryKey: ['api-key'],
    queryFn: async () => {
      const response = await api.get('/api-key');
      if (response.data.error) {
        toast.error(response.data.message);
        return null;
      }
      return response.data;
    },
    staleTime: 1000 * 60 * 5,
  });

  const getFreeApiKeyMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const response = await api.post<ApiKeyActivationResponse>('/get-free-api-key', {
        email,
        password,
      });
      if (!response.data.success) {
        toast.error(response.data.message);
        throw new Error(response.data.message || 'Failed to get free API key');
      }
      apiKeyQuery.refetch();
      toast.success(response.data.message);
      invalidateAfterApiKeySaved(queryClient, response.data.documents);
      if (response.data.documents?.error) {
        toast.error(response.data.documents.error);
      }
      return response.data;
    },
  });

  const activateApiKeyMutation = useMutation({
    mutationFn: async (apiKey: string) => {
      const response = await api.post<ApiKeyActivationResponse>('/activate-api-key', {
        api_key: apiKey,
      });
      if (response.data.success) {
        toast.success(response.data.message);
        apiKeyQuery.refetch();
        invalidateAfterApiKeySaved(queryClient, response.data.documents);
        if (response.data.documents?.error) {
          toast.error(response.data.documents.error);
        }
        return response.data;
      }
      toast.error(response.data.error);
      throw new Error(response.data.error || 'Failed to activate api key');
    },
    onError: (error: unknown) => {
      if (error instanceof AxiosError) {
        toast.error(error.response?.data.error);
      } else if (error instanceof Error && error.message) {
        toast.error(error.message);
      } else {
        toast.error('An error occurred while activating the api key');
      }
    },
  });

  const syncCreditsMutation = useMutation({
    mutationFn: async () => {
      const response = await api.get('/feature-usage');
      return response.data;
    },
    onSuccess: () => {
      apiKeyQuery.refetch();
    },
  });

  const saveOpenAiKeyMutation = useMutation({
    mutationFn: async (openaiKey: string) => {
      const response = await api.post('/save-openai-key', {
        openai_key: openaiKey,
      });
      if (response.data.success) {
        toast.success(response.data.message);
        return response.data;
      } else {
        toast.error(response.data.message || 'Failed to save OpenAI API key');
        throw new Error(response.data.message || 'Failed to save OpenAI API key');
      }
    },
    onError: (error: unknown) => {
      if (error instanceof AxiosError) {
        toast.error(error.response?.data?.message || 'Failed to save OpenAI API key');
      } else {
        toast.error('An error occurred while saving the OpenAI API key');
      }
    },
  });

  const openAiKeyQuery = useQuery<
    { openai_key: string | null; key_prefix?: string | null },
    Error
  >({
    queryKey: ['openai-key'],
    queryFn: async () => {
      const response = await api.get('/get-openai-key');
      return response.data;
    },
    staleTime: 1000 * 60 * 5,
  });

  const deleteOpenAiKeyMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/delete-openai-key');
      return response.data;
    },
    onSuccess: (data) => {
      openAiKeyQuery.refetch();
      if (data?.success) {
        toast.success(data.message || 'OpenAI API key removed');
      }
    },
    onError: (error: unknown) => {
      if (error instanceof AxiosError) {
        toast.error(error.response?.data?.message || 'Failed to remove OpenAI API key');
      } else {
        toast.error('An error occurred while removing the OpenAI API key');
      }
    },
  });

  return {
    apiKeyQuery,
    getFreeApiKeyMutation,
    activateApiKeyMutation,
    syncCreditsMutation,
    saveOpenAiKeyMutation,
    deleteOpenAiKeyMutation,
    openAiKeyQuery,
  };
}
