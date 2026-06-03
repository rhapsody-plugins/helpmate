import api from '@/lib/axios';
import { __, sprintf } from '@/lib/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { toast } from 'sonner';

export interface QdrantSyncStats {
  total: number;
  complete: number;
  legacy: number;
}

export interface QdrantPreviewDocument {
  document_id: string;
  title?: string;
  document_type?: string;
  content?: string;
}

export interface QdrantPreviewResponse {
  success: boolean;
  mysql_count: number;
  qdrant_count: number;
  stats: QdrantSyncStats;
  sample_documents: QdrantPreviewDocument[];
  can_backfill: boolean;
  warnings: string[];
}

export interface EmailTemplateResetResponse {
  success: boolean;
  message: string;
  orphaned_campaign_references?: number;
}

export interface BackfillQdrantResponse {
  success: boolean;
  updated: number;
  skipped: number;
  errors: Array<{ id: number; message: string }>;
}

export interface SyncFromQdrantResponse {
  success: boolean;
  inserted: number;
  message: string;
}

export interface DatabaseResetResponse {
  success: boolean;
  message: string;
}

interface ToolsErrorResponse {
  error: true;
  message: string;
}

function isToolsErrorResponse(data: unknown): data is ToolsErrorResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'error' in data &&
    (data as ToolsErrorResponse).error === true
  );
}

function assertToolsSuccess<T>(
  data: T | ToolsErrorResponse,
  fallbackMessage: string
): T {
  if (isToolsErrorResponse(data)) {
    throw new Error(data.message || fallbackMessage);
  }
  return data as T;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    return (
      error.response?.data?.message ||
      error.message ||
      'Request failed'
    );
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Request failed';
}

export function useTools() {
  const queryClient = useQueryClient();

  const qdrantPreviewQuery = useQuery<QdrantPreviewResponse, Error>({
    queryKey: ['tools', 'qdrant-preview'],
    queryFn: async () => {
      try {
        const response = await api.get<QdrantPreviewResponse | ToolsErrorResponse>(
          '/tools/documents/qdrant-preview'
        );
        return assertToolsSuccess(response.data, 'Failed to load preview');
      } catch (error) {
        throw new Error(getErrorMessage(error));
      }
    },
    enabled: false,
    retry: false,
  });

  const resetEmailTemplatesMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post<
        EmailTemplateResetResponse | ToolsErrorResponse
      >('/tools/reset-default-email-templates');
      return assertToolsSuccess(response.data, 'Reset failed');
    },
    onSuccess: (data) => {
      toast.success(data.message);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const backfillQdrantMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post<BackfillQdrantResponse | ToolsErrorResponse>(
        '/tools/documents/backfill-qdrant'
      );
      return assertToolsSuccess(response.data, 'Backfill failed');
    },
    onSuccess: (data) => {
      toast.success(
        sprintf(
          /* translators: %d: number of documents updated in the cloud */
          __('%d documents updated in the cloud'),
          data.updated
        )
      );
      void queryClient.invalidateQueries({ queryKey: ['tools', 'qdrant-preview'] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const syncFromQdrantMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post<SyncFromQdrantResponse | ToolsErrorResponse>(
        '/tools/documents/sync-from-qdrant'
      );
      return assertToolsSuccess(response.data, 'Sync failed');
    },
    onSuccess: (data) => {
      toast.success(data.message);
      void queryClient.invalidateQueries({ queryKey: ['tools', 'qdrant-preview'] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const resetDatabaseMutation = useMutation({
    mutationFn: async (confirmation: string) => {
      const response = await api.post<DatabaseResetResponse | ToolsErrorResponse>(
        '/tools/reset-database',
        { confirmation }
      );
      return assertToolsSuccess(response.data, 'Reset failed');
    },
    onSuccess: (data) => {
      toast.success(data.message);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  return {
    qdrantPreviewQuery,
    resetEmailTemplatesMutation,
    backfillQdrantMutation,
    syncFromQdrantMutation,
    resetDatabaseMutation,
  };
}
