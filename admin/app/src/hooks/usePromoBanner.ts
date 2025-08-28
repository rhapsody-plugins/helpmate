import api from '@/lib/axios';
import {
  PaginationParams,
  PaginationResponse,
  PromoBanner,
  PromoBannerInput,
} from '@/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export interface PromoBannerTemplate {
  name: string;
  description: string;
  background_color: string;
  text_color: string;
  button_background_color: string;
  button_text_color: string;
  button_icon?: string;
  button_icon_position?: string;
  countdown_background_color: string;
  countdown_text_color: string;
  close_button_color: string;
  text_font_size: string;
  button_text_font_size: string;
  countdown_text_font_size: string;
  position: string;
  sticky_bar: boolean;
  display_close_button: boolean;
  mobile_visibility: boolean;
  countdown_enabled: boolean;
  title?: string;
  text?: string;
  button_text?: string;
  button_url?: string;
}

export const usePromoBanner = () => {
  const queryClient = useQueryClient();

  const getPromoBanners = useQuery<
    { items: PromoBanner[]; pagination: PaginationResponse },
    Error,
    { items: PromoBanner[]; pagination: PaginationResponse },
    [string, PaginationParams]
  >({
    queryKey: ['promo-banners', { page: 1, per_page: 10 }],
    queryFn: async ({ queryKey }) => {
      const [, params] = queryKey;
      const response = await api.get('/promo-banners', {
        params: { page: params.page, per_page: params.per_page },
      });
      if (!response.data.error) {
        return response.data;
      }
      return {
        items: [],
        pagination: {
          total: 0,
          per_page: 10,
          current_page: 1,
          total_pages: 0,
        },
      };
    },
    enabled: false, // Disable automatic fetching
  });

  // Function to refetch with specific pagination params
  const refetchPromoBanners = (params: PaginationParams) => {
    return queryClient.fetchQuery({
      queryKey: ['promo-banners', params],
      queryFn: async () => {
        const response = await api.get('/promo-banners', {
          params: { page: params.page, per_page: params.per_page },
        });
        if (!response.data.error) {
          return response.data;
        }
        return {
          items: [],
          pagination: {
            total: 0,
            per_page: 10,
            current_page: 1,
            total_pages: 0,
          },
        };
      },
    });
  };

  const createPromoBanner = useMutation<
    { item: PromoBanner },
    Error,
    PromoBannerInput
  >({
    mutationFn: async (promoBannerInput) => {
      const response = await api.post('/promo-banners', promoBannerInput);
      if (!response.data.error) {
        return response.data;
      }
      return null;
    },
    onSuccess: () => {
      toast.success('Promo banner created successfully');
      // Invalidate and refetch promo banners
      queryClient.invalidateQueries({ queryKey: ['promo-banners'] });
    },
    onError: () => {
      toast.error('Failed to create promo banner');
    },
  });

  const updatePromoBanner = useMutation<
    { item: PromoBanner },
    Error,
    { id: number } & PromoBannerInput
  >({
    mutationFn: async (promoBannerInput) => {
      const response = await api.post(
        `/promo-banners/${promoBannerInput.id}`,
        promoBannerInput
      );
      if (!response.data.error) {
        return response.data;
      }
      return null;
    },
    onSuccess: () => {
      toast.success('Promo banner updated successfully');
      // Invalidate and refetch promo banners
      queryClient.invalidateQueries({ queryKey: ['promo-banners'] });
    },
    onError: () => {
      toast.error('Failed to update promo banner');
    },
  });

  const deletePromoBanner = useMutation<
    { message: string },
    Error,
    { id: number }
  >({
    mutationFn: async ({ id }) => {
      const response = await api.post(`/promo-banners/${id}/delete`);
      if (!response.data.error) {
        return response.data;
      }
      return null;
    },
    onSuccess: () => {
      toast.success('Promo banner deleted successfully');
      // Invalidate and refetch promo banners
      queryClient.invalidateQueries({ queryKey: ['promo-banners'] });
    },
    onError: () => {
      toast.error('Failed to delete promo banner');
    },
  });

  const getTemplates = useQuery<Record<string, PromoBannerTemplate>>({
    queryKey: ['promo-banner-templates'],
    queryFn: async () => {
      const response = await api.get('/promo-banner-templates');
      if (!response.data.error) {
        return response.data.templates;
      }
      return {};
    },
  });

  const getTemplate = useQuery<PromoBannerTemplate>({
    queryKey: ['promo-banner-template'],
    queryFn: async () => {
      const response = await api.get('/promo-banner-templates/1');
      if (!response.data.error) {
        return response.data.template;
      }
      return null;
    },
    enabled: false,
  });

  return {
    getPromoBanners,
    refetchPromoBanners,
    createPromoBanner,
    updatePromoBanner,
    deletePromoBanner,
    getTemplates,
    getTemplate,
  };
};
