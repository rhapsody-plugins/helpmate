import api from '@/lib/axios';
import { useApi } from '@/hooks/useApi';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { toast } from 'sonner';

export interface LocalhostSource {
  install_id: string;
  site_origin: string;
  doc_count: number;
  first_seen?: string;
  last_seen?: string;
  sample_titles?: string[];
}

export interface LocalhostSourcesResponse {
  is_localhost_site?: boolean;
  migration_status?: string;
  install_id?: string;
  target_domain?: string;
  has_qdrant_general?: boolean;
  data?: {
    sources?: LocalhostSource[];
    total_docs?: number;
    error?: boolean;
    message?: string;
  };
}

export interface PromoteLocalhostResult {
  status?: string;
  moved?: number;
  skipped_dupes?: number;
  target_count_after?: number;
  error?: boolean;
  message?: string;
  code?: string;
  detail?: { code?: string; target_count?: number; message?: string };
}

export function shouldShowLocalhostMigrationStep(
  payload: LocalhostSourcesResponse | undefined
): boolean {
  if (!payload) {
    return false;
  }
  const sourceCount = payload.data?.sources?.length ?? 0;
  return (
    !payload.is_localhost_site &&
    sourceCount > 0 &&
    payload.migration_status !== 'done' &&
    payload.migration_status !== 'skipped'
  );
}

export async function fetchLocalhostSources(): Promise<LocalhostSourcesResponse> {
  const res = await api.get<LocalhostSourcesResponse>('/localhost-sources');
  return res.data;
}

/**
 * Re-check site-tenant Qdrant for a general doc; run quick train if missing.
 */
export async function ensureSiteGeneralDocument(
  runQuickTrain: () => Promise<boolean>
): Promise<boolean> {
  const payload = await fetchLocalhostSources();
  if (payload.has_qdrant_general) {
    return true;
  }
  return runQuickTrain();
}

export function useLocalhostMigration() {
  const { apiKeyQuery } = useApi();
  const queryClient = useQueryClient();
  const hasApiKey = !!apiKeyQuery.data?.api_key;

  const sourcesQuery = useQuery<LocalhostSourcesResponse>({
    queryKey: ['localhost-migration-sources'],
    queryFn: fetchLocalhostSources,
    enabled: hasApiKey,
    staleTime: 60_000,
  });

  const promoteMutation = useMutation({
    mutationFn: async (payload: {
      target_domain: string;
      install_ids: string[];
      force_merge?: boolean;
    }) => {
      const res = await api.post<PromoteLocalhostResult>('/promote-localhost', payload);
      if (res.data?.error) {
        throw Object.assign(new Error(res.data.message || 'Promotion failed'), {
          response: { data: res.data, status: res.status },
        });
      }
      return res.data;
    },
  });

  const syncFromQdrantMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ error?: boolean; message?: string; inserted?: number }>(
        '/tools/documents/sync-from-qdrant'
      );
      if (res.data?.error) {
        throw new Error(res.data.message || 'Sync failed');
      }
      return res.data;
    },
    onSuccess: (data) => {
      if (data?.message) {
        toast.success(data.message);
      }
      void queryClient.invalidateQueries({ queryKey: ['localhost-migration-sources'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-checklist'] });
      void queryClient.invalidateQueries({ queryKey: ['tools', 'qdrant-preview'] });
      void queryClient.invalidateQueries({ queryKey: ['api-key'] });
    },
  });

  const statusMutation = useMutation({
    mutationFn: async (status: 'pending' | 'done' | 'skipped') => {
      const res = await api.post('/localhost-migration-status', { status });
      return res.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['localhost-migration-sources'] });
    },
  });

  return {
    sourcesQuery,
    promoteMutation,
    syncFromQdrantMutation,
    statusMutation,
    hasApiKey,
  };
}

export function getPromoteErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as { message?: string; detail?: { message?: string } };
    return (
      data?.message ||
      data?.detail?.message ||
      error.message ||
      'Promotion failed'
    );
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Promotion failed';
}
