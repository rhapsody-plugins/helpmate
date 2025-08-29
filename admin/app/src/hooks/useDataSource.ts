import api from '@/lib/axios';
import {
  DataSource,
  DiscountedProduct,
  DocumentInput,
  PostType,
} from '@/types';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { toast } from 'sonner';

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
    void,
    Error,
    DocumentInput | DocumentInput[]
  >({
    mutationFn: async (data) => {
      // Check consent before proceeding
      const consentResponse = await api.get('/get-consent');
      const hasConsent = consentResponse.data.consent;

      if (!hasConsent) {
        throw new Error('CONSENT_REQUIRED');
      }

      await api.post('/save-documents', data);
      const documentType = Array.isArray(data)
        ? data[0].document_type
        : data.document_type;
      getSourcesMutation.mutate(documentType);
    },
    onSuccess: () => {
      toast.success('Data source(s) added successfully');
    },
    onError: (error) => {
      if (error.message === 'CONSENT_REQUIRED') {
        // Don't show error toast for consent requirement
        return;
      }
      toast.error(
        (error as AxiosError<{ message: string }>).response?.data?.message ??
          'Failed to add data source(s)'
      );
    },
  });

  const updateSourceMutation = useMutation<void, Error, DataSource>({
    mutationFn: async (data) => {
      // Check consent before proceeding
      const consentResponse = await api.get('/get-consent');
      const hasConsent = consentResponse.data.consent;

      if (!hasConsent) {
        throw new Error('CONSENT_REQUIRED');
      }

      await api.post('/update-documents', data);
      getSourcesMutation.mutate(data.document_type);
    },
    onSuccess: () => {
      toast.success('Data source updated successfully');
    },
    onError: (error) => {
      if (error.message === 'CONSENT_REQUIRED') {
        // Don't show error toast for consent requirement
        return;
      }
      toast.error(
        (error as AxiosError<{ message: string }>).response?.data?.message ??
          'Failed to update data source'
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

  const getConsentQuery = useQuery<boolean, Error>({
    queryKey: ['consent'],
    queryFn: async () => {
      const response = await api.get('/get-consent');
      return response.data.consent;
    },
  });

  const updateConsentMutation = useMutation<void, Error, boolean>({
    mutationFn: async (consent) => {
      const response = await api.post('/update-consent', { consent });
      if (!response.data.error) {
        return response.data.message;
      }
      if (response.data.error && response.data.message) {
        toast.error(response.data.message);
      }
    },
  });

  // Helper function to handle consent requirement
  const handleConsentRequired = async (): Promise<boolean> => {
    try {
      const consentResponse = await api.get('/get-consent');
      return consentResponse.data.consent;
    } catch {
      return false;
    }
  };

  return {
    getSourcesMutation,
    addSourceMutation,
    updateSourceMutation,
    removeSourceMutation,
    getPostTypesQuery,
    getPostsMutation,
    getDiscountedProductsMutation,
    getConsentQuery,
    updateConsentMutation,
    handleConsentRequired,
  };
};
