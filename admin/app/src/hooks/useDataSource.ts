import api from '@/lib/axios';
import {
  DataSource,
  DiscountedProduct,
  DocumentInput,
  PostType,
} from '@/types';
import { BulkJob } from '@/types/bulkJob';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { toast } from 'sonner';

interface BulkJobStatus {
  job: BulkJob;
  timestamp: string;
}

interface BackgroundProcessingStatus {
  available: boolean;
  action_scheduler_available: boolean;
  message: string;
}

interface BulkJobResponse {
  job_id: string;
  total_documents: number;
  status: string;
}

interface BulkDocumentInput {
  document_type: string;
  post_id: number;
  post_type: string;
  title: string;
}

export const useDataSource = () => {
  const getSourcesMutation = useMutation<DataSource[], Error, string>({
    mutationFn: async (type: string) => {
      const response = await api.get('/get-documents', {
        params: { document_type: type },
      });
      return response.data.documents;
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const addSourceMutation = useMutation<
    void | BulkJobResponse,
    Error,
    DocumentInput | DocumentInput[] | BulkDocumentInput[]
  >({
    mutationFn: async (data) => {
      const response = await api.post('/save-documents', data);

      // Check if this is a bulk operation
      if (Array.isArray(data) && data.length > 1 && response.data.job_id) {
        // This is a bulk operation that was scheduled for background processing
        return response.data;
      }

      // Single document or immediate processing
      const documentType = Array.isArray(data)
        ? data[0].document_type
        : data.document_type;
      getSourcesMutation.mutate(documentType);
    },
    onSuccess: (data, variables) => {
      // Check if this was a bulk operation
      if (Array.isArray(variables) && variables.length > 1 && data?.job_id) {
        toast.success(
          `Bulk processing started for ${variables.length} documents. You'll be notified when complete.`
        );
        return;
      }

      toast.success('Data source(s) added successfully');
    },
    onError: (error, data) => {
      toast.error(
        (error as AxiosError<{ message: string }>).response?.data?.message ??
          'Failed to add data source(s). Try again.'
      );
      const documentType = Array.isArray(data)
        ? data[0].document_type
        : data.document_type;
      getSourcesMutation.mutate(documentType);
    },
  });

  const updateSourceMutation = useMutation<void, Error, DataSource>({
    mutationFn: async (data) => {
      await api.post('/update-documents', data);
      getSourcesMutation.mutate(data.document_type);
    },
    onSuccess: () => {
      toast.success('Data source updated successfully');
    },
    onError: (error) => {
      toast.error(
        (error as AxiosError<{ message: string }>).response?.data?.message ??
          'Failed to update data source. Try again.'
      );
    },
  });

  const removeSourceMutation = useMutation<
    void,
    Error,
    { ids: number[]; type: string }
  >({
    mutationFn: async ({ ids, type }) => {
      await api.post('/remove-documents', { ids });
      getSourcesMutation.mutate(type);
    },
    onSuccess: () => {
      toast.success('Data source removed successfully');
    },
    onError: (error) => {
      toast.error(
        (error as AxiosError<{ message: string }>).response?.data?.message ??
          'Failed to remove data source'
      );
    },
  });

  const getPostTypesQuery = useQuery<PostType[], Error>({
    queryKey: ['post-types'],
    queryFn: async () => {
      const response = await api.get('/post-types');
      if (!response.data.error) {
        return response.data.post_types;
      }
      return [];
    },
    initialData: [],
    refetchOnWindowFocus: false,
  });

  const getPostsMutation = useMutation<
    Array<{
      id: number;
      title: string;
      type: string;
      status: string;
      date: string;
      author: string;
    }>,
    Error,
    string
  >({
    mutationFn: async (type: string) => {
      const response = await api.get('/posts', {
        params: { post_type: type === 'all' ? '' : type },
      });
      return response.data;
    },
    onError: (error) => {
      toast.error(
        (error as AxiosError<{ message: string }>).response?.data?.message ??
          'Failed to fetch posts'
      );
    },
  });

  const getDiscountedProductsMutation = useMutation<DiscountedProduct[], Error>(
    {
      mutationFn: async () => {
        const response = await api.get('/discounted-products');
        if (!response.data.error) {
          return response.data.products;
        }
        if (response.data.error && response.data.message) {
          toast.error(response.data.message);
        }
        return [];
      },
    }
  );

  // Bulk job management hooks
  const getBulkJobStatusMutation = useMutation<BulkJobStatus, Error, string>({
    mutationFn: async (jobId: string) => {
      const response = await api.get(`/bulk-job-status/${jobId}`);
      return response.data;
    },
    onSuccess: () => {
      // Invalidate bulk jobs query to get fresh data
      getBulkJobsQuery.refetch();
    },
  });

  const cancelBulkJobMutation = useMutation<void, Error, string>({
    mutationFn: async (jobId: string) => {
      await api.post(`/bulk-job-cancel/${jobId}`);
    },
    onSuccess: () => {
      toast.success('Bulk job cancelled successfully');
      // Invalidate bulk jobs query to get fresh data
      getBulkJobsQuery.refetch();
    },
    onError: (error) => {
      toast.error(
        (error as AxiosError<{ message: string }>).response?.data?.message ??
          'Failed to cancel bulk job'
      );
    },
  });

  const deleteBulkJobMutation = useMutation<void, Error, string>({
    mutationFn: async (jobId: string) => {
      await api.post(`/bulk-job-delete/${jobId}`);
    },
    onSuccess: () => {
      // Invalidate bulk jobs query to get fresh data
      getBulkJobsQuery.refetch();
    },
    onError: (error) => {
      toast.error(
        (error as AxiosError<{ message: string }>).response?.data?.message ??
          'Failed to delete bulk job'
      );
    },
  });

  const getBulkJobsQuery = useQuery<BulkJob[], Error>({
    queryKey: ['bulk-jobs'],
    queryFn: async () => {
      const response = await api.get('/bulk-jobs');
      return response.data.jobs;
    },
    refetchInterval: (query) => {
      // Only refetch if there are active jobs (processing or scheduled)
      const data = query.state.data;
      const hasActiveJobs = data?.some(
        (job: BulkJob) =>
          job.status === 'processing' || job.status === 'scheduled'
      );
      return hasActiveJobs ? 2000 : false; // 2 seconds for active jobs, no polling when no active jobs
    },
    refetchIntervalInBackground: true,
    staleTime: 0, // Always consider data stale
    gcTime: 2000, // Very short cache time (renamed from cacheTime in newer versions)
    enabled: true, // Always enabled to start polling immediately
  });

  const getBackgroundProcessingStatusQuery = useQuery<
    BackgroundProcessingStatus,
    Error
  >({
    queryKey: ['background-processing-status'],
    queryFn: async () => {
      const response = await api.get('/background-processing-status');
      return response.data;
    },
    refetchOnWindowFocus: false,
  });

  return {
    getSourcesMutation,
    addSourceMutation,
    updateSourceMutation,
    removeSourceMutation,
    getPostTypesQuery,
    getPostsMutation,
    getDiscountedProductsMutation,
    // Bulk job management
    getBulkJobStatusMutation,
    cancelBulkJobMutation,
    deleteBulkJobMutation,
    getBulkJobsQuery,
    getBackgroundProcessingStatusQuery,
    // Manual refetch function
    refetchBulkJobs: () => getBulkJobsQuery.refetch(),
  };
};
