import { useSettings } from '@/hooks/useSettings';
import api from '@/lib/axios';
import {
  Campaign,
  CampaignStats,
  Contact,
  ContactEmail,
  ContactFilters,
  ContactNote,
  CustomField,
  EmailSequence,
  EmailSequenceStep,
  EmailTemplate,
  FailedEmail,
  ManualOrder,
  Order,
  Pagination,
  Segment,
  SegmentConditionGroup
} from '@/types/crm';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { toast } from 'sonner';

export function useCrm() {
  const queryClient = useQueryClient();
  const { getProQuery } = useSettings();
  const isPro = getProQuery.data ?? false;

  // Get contacts
  const useContacts = (filters?: ContactFilters, page = 1, perPage = 20) => {
    return useQuery({
      queryKey: ['crm-contacts', filters, page, perPage],
      queryFn: async () => {
        const params: Record<string, string | number> = {
          page,
          per_page: perPage,
        };
        if (filters) {
          Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== '') {
              params[key] = value;
            }
          });
        }
        const response = await api.get<{
          error: boolean;
          data: { contacts: Contact[]; pagination: Pagination };
        }>('/crm/contacts', { params });
        return response.data.data;
      },
      refetchOnWindowFocus: false,
    });
  };

  // Get single contact
  const useContact = (contactId: number | null, enabled = true) => {
    return useQuery({
      queryKey: ['crm-contact', contactId],
      queryFn: async () => {
        const response = await api.get<{
          error: boolean;
          data: Contact;
        }>(`/crm/contacts/${contactId}`);
        return response.data.data;
      },
      enabled: enabled && contactId !== null,
    });
  };

  // Create contact
  const createContactMutation = useMutation({
    mutationFn: async (data: Partial<Contact>) => {
      const response = await api.post<{
        error: boolean;
        contact_id: number;
        message: string;
      }>('/crm/contacts', data);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['crm-contacts'] });
    },
    onError: (error: AxiosError) => {
      toast.error((error.response?.data as { message?: string })?.message || 'Failed to create contact');
    },
  });

  // Update contact
  const updateContactMutation = useMutation({
    mutationFn: async ({
      contactId,
      data,
    }: {
      contactId: number;
      data: Partial<Contact>;
    }) => {
      const response = await api.post<{
        error: boolean;
        message: string;
      }>(`/crm/contacts/${contactId}`, data);
      return response.data;
    },
    onSuccess: (data, variables) => {
      toast.success(data.message);

      // Optimistically update the contact cache with the data we just sent
      queryClient.setQueryData<Contact>(
        ['crm-contact', variables.contactId],
        (oldData) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            ...variables.data,
          };
        }
      );

      queryClient.invalidateQueries({ queryKey: ['crm-contacts'] });
      // Still invalidate but the optimistic update prevents flicker
      queryClient.invalidateQueries({
        queryKey: ['crm-contact', variables.contactId],
      });
    },
    onError: (error: AxiosError) => {
      toast.error((error.response?.data as { message?: string })?.message || 'Failed to update contact');
    },
  });

  // Delete contact
  const deleteContactMutation = useMutation({
    mutationFn: async (contactId: number) => {
      const response = await api.post<{
        error: boolean;
        message: string;
      }>(`/crm/contacts/${contactId}/delete`);
      return response.data;
    },
    onSuccess: (data, contactId) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['crm-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['crm-contact', contactId] });
    },
    onError: () => {
      toast.error('Failed to delete contact');
    },
  });

  // Get custom fields
  // Allow reading custom fields even without pro (for default task fields)
  // Write operations (create/update/delete) still require pro
  const useCustomFields = (entityType = 'contact') => {
    return useQuery({
      queryKey: ['crm-custom-fields', entityType],
      queryFn: async () => {
        try {
          const response = await api.get<{
            error: boolean;
            data: CustomField[];
            message?: string;
          }>('/crm/custom-fields', {
            params: { entity_type: entityType },
          });
          // Handle error response - if it's a pro required error, return empty array
          // Otherwise return the data
          if (response.data.error) {
            // For task entity type, we should still get default fields even without pro
            // If we get an error, it means pro route blocked it, return empty array
            return [];
          }
          return response.data.data || [];
        } catch (error: unknown) {
          // Handle 403 or other errors gracefully
          // For task entity type, default fields should be available
          // Return empty array on error - the backend should handle providing default fields
          if ((error as unknown as AxiosError).response?.status === 403) {
            return [];
          }
          throw error;
        }
      },
      enabled: true, // Always enabled to allow reading default fields
      refetchOnWindowFocus: false,
      retry: false, // Don't retry on error to avoid unnecessary requests
    });
  };

  // Create custom field
  const createCustomFieldMutation = useMutation({
    mutationFn: async (data: Partial<CustomField>) => {
      const response = await api.post<{
        error: boolean;
        field_id: number;
        message: string;
      }>('/crm/custom-fields', data);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['crm-custom-fields'] });
    },
    onError: () => {
      toast.error('Failed to create custom field');
    },
  });

  // Update custom field
  const updateCustomFieldMutation = useMutation({
    mutationFn: async ({
      fieldId,
      data,
    }: {
      fieldId: number;
      data: Partial<CustomField>;
    }) => {
      if (!isPro) {
        throw new Error('Pro license required to update custom fields');
      }
      const response = await api.post<{
        error: boolean;
        message: string;
      }>(`/crm/custom-fields/${fieldId}`, data);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['crm-custom-fields'] });
    },
    onError: () => {
      toast.error('Failed to update custom field');
    },
  });

  // Delete custom field
  const deleteCustomFieldMutation = useMutation({
    mutationFn: async (fieldId: number) => {
      if (!isPro) {
        throw new Error('Pro license required to delete custom fields');
      }
      const response = await api.post<{
        error: boolean;
        message: string;
      }>(`/crm/custom-fields/${fieldId}/delete`);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['crm-custom-fields'] });
    },
    onError: () => {
      toast.error('Failed to delete custom field');
    },
  });

  // Get contact notes
  const useContactNotes = (
    contactId: number | null,
    page = 1,
    perPage = 50,
    enabled = true
  ) => {
    return useQuery({
      queryKey: ['crm-contact-notes', contactId, page, perPage],
      queryFn: async () => {
        const response = await api.get<{
          error: boolean;
          data: { notes: ContactNote[]; pagination: Pagination };
        }>(`/crm/contacts/${contactId}/notes`, {
          params: { page, per_page: perPage },
        });
        return response.data.data;
      },
      enabled: enabled && contactId !== null,
    });
  };

  // Create note
  const createNoteMutation = useMutation({
    mutationFn: async ({
      contactId,
      content,
    }: {
      contactId: number;
      content: string;
    }) => {
      const response = await api.post<{
        error: boolean;
        note_id: number;
        message: string;
      }>(`/crm/contacts/${contactId}/notes`, { content });
      return response.data;
    },
    onSuccess: (data, variables) => {
      toast.success(data.message);
      queryClient.invalidateQueries({
        queryKey: ['crm-contact-notes', variables.contactId],
      });
    },
    onError: () => {
      toast.error('Failed to create note');
    },
  });

  // Update note
  const updateNoteMutation = useMutation({
    mutationFn: async ({
      noteId,
      content,
    }: {
      noteId: number;
      content: string;
    }) => {
      const response = await api.post<{
        error: boolean;
        message: string;
      }>(`/crm/notes/${noteId}`, { content });
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['crm-contact-notes'] });
    },
    onError: () => {
      toast.error('Failed to update note');
    },
  });

  // Delete note
  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: number) => {
      const response = await api.post<{
        error: boolean;
        message: string;
      }>(`/crm/notes/${noteId}/delete`);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['crm-contact-notes'] });
    },
    onError: () => {
      toast.error('Failed to delete note');
    },
  });

  // Get contact orders
  const useContactOrders = (contactId: number | null, enabled = true) => {
    return useQuery({
      queryKey: ['crm-contact-orders', contactId],
      queryFn: async () => {
        const response = await api.get<{
          error: boolean;
          data: Order[];
        }>(`/crm/contacts/${contactId}/orders`);
        return response.data.data;
      },
      enabled: enabled && contactId !== null,
    });
  };

  // Create manual order
  const createManualOrderMutation = useMutation({
    mutationFn: async ({
      contactId,
      data,
    }: {
      contactId: number;
      data: Partial<ManualOrder>;
    }) => {
      const response = await api.post<{
        error: boolean;
        order_id: number;
        message: string;
      }>(`/crm/contacts/${contactId}/orders`, data);
      return response.data;
    },
    onSuccess: (data, variables) => {
      toast.success(data.message);
      queryClient.invalidateQueries({
        queryKey: ['crm-contact-orders', variables.contactId],
      });
    },
    onError: () => {
      toast.error('Failed to create order');
    },
  });

  // Update manual order
  const updateManualOrderMutation = useMutation({
    mutationFn: async ({
      orderId,
      data,
    }: {
      orderId: number;
      data: Partial<ManualOrder>;
    }) => {
      const response = await api.post<{
        error: boolean;
        message: string;
      }>(`/crm/orders/${orderId}`, data);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['crm-contact-orders'] });
    },
    onError: () => {
      toast.error('Failed to update order');
    },
  });

  // Delete manual order
  const deleteManualOrderMutation = useMutation({
    mutationFn: async (orderId: number) => {
      const response = await api.post<{
        error: boolean;
        message: string;
      }>(`/crm/orders/${orderId}/delete`);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['crm-contact-orders'] });
    },
    onError: () => {
      toast.error('Failed to delete order');
    },
  });

  // Get WooCommerce new order URL
  const useWooCommerceNewOrderUrl = () => {
    return useQuery({
      queryKey: ['woocommerce-new-order-url'],
      queryFn: async () => {
        const response = await api.get<{
          error: boolean;
          url: string;
        }>('/crm/woocommerce/new-order-url');
        if (response.data.error) {
          throw new Error('Failed to get WooCommerce new order URL');
        }
        return response.data.url;
      },
      enabled: false, // Only fetch when explicitly called
      retry: false,
    });
  };

  // Get EDD new order URL
  const useEddNewOrderUrl = () => {
    return useQuery({
      queryKey: ['edd-new-order-url'],
      queryFn: async () => {
        const response = await api.get<{
          error: boolean;
          url: string;
        }>('/crm/edd/new-order-url');
        if (response.data.error) {
          throw new Error('Failed to get EDD new order URL');
        }
        return response.data.url;
      },
      enabled: false,
      retry: false,
    });
  };

  // SureCart: admin orders hub (no separate "new order" flow in WP admin).
  const useSureCartNewOrderUrl = () => {
    return useQuery({
      queryKey: ['surecart-new-order-url'],
      queryFn: async () => {
        const response = await api.get<{
          error: boolean;
          url: string;
        }>('/crm/surecart/new-order-url');
        if (response.data.error) {
          throw new Error('Failed to get SureCart orders URL');
        }
        return response.data.url;
      },
      enabled: false,
      retry: false,
    });
  };

  // Get contact statuses
  const useContactStatuses = () => {
    return useQuery({
      queryKey: ['crm-statuses'],
      queryFn: async () => {
        const response = await api.get<{
          error: boolean;
          data: string[];
        }>('/crm/statuses');
        return response.data.data;
      },
      refetchOnWindowFocus: false,
    });
  };

  // Add custom status
  const addStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      const response = await api.post<{
        error: boolean;
        message: string;
      }>('/crm/statuses', { status });
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['crm-statuses'] });
    },
    onError: () => {
      toast.error('Failed to add status');
    },
  });

  // Remove custom status
  const removeStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      const response = await api.post<{
        error: boolean;
        message: string;
      }>(`/crm/statuses/${status}/delete`);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['crm-statuses'] });
    },
    onError: () => {
      toast.error('Failed to remove status');
    },
  });

  // Search WordPress users
  const useSearchWpUsers = (search = '') => {
    return useQuery({
      queryKey: ['crm-wp-users', search],
      queryFn: async () => {
        const response = await api.get<{
          error: boolean;
          data: Array<{
            id: number;
            username: string;
            display_name: string;
            email: string;
          }>;
        }>('/crm/users/search', {
          params: { search, limit: 50 },
        });
        return response.data.data;
      },
      enabled: true,
      refetchOnWindowFocus: false,
    });
  };

  // Get email templates
  const useEmailTemplates = () => {
    return useQuery({
      queryKey: ['crm-email-templates'],
      queryFn: async () => {
        const response = await api.get<{
          error: boolean;
          data: EmailTemplate[];
        }>('/crm/email-templates');
        return response.data.data;
      },
      refetchOnWindowFocus: false,
    });
  };

  // Create email template
  const createEmailTemplateMutation = useMutation({
    mutationFn: async (data: Partial<EmailTemplate>) => {
      const response = await api.post<{
        error: boolean;
        template_id: number;
        message: string;
      }>('/crm/email-templates', data);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['crm-email-templates'] });
    },
    onError: () => {
      toast.error('Failed to create email template');
    },
  });

  // Update email template
  const updateEmailTemplateMutation = useMutation({
    mutationFn: async ({
      templateId,
      data,
    }: {
      templateId: number;
      data: Partial<EmailTemplate>;
    }) => {
      const response = await api.post<{
        error: boolean;
        message: string;
      }>(`/crm/email-templates/${templateId}`, data);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['crm-email-templates'] });
    },
    onError: () => {
      toast.error('Failed to update email template');
    },
  });

  // Delete email template
  const deleteEmailTemplateMutation = useMutation({
    mutationFn: async (templateId: number) => {
      const response = await api.post<{
        error: boolean;
        message: string;
      }>(`/crm/email-templates/${templateId}/delete`);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['crm-email-templates'] });
    },
    onError: (error: AxiosError) => {
      const message = (error.response?.data as { message?: string })?.message || 'Failed to delete email template';
      toast.error(message);
    },
  });

  // Restore default email template
  const restoreEmailTemplateMutation = useMutation({
    mutationFn: async (templateId: number) => {
      const response = await api.post<{
        error: boolean;
        message: string;
      }>(`/crm/email-templates/${templateId}/restore`);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['crm-email-templates'] });
    },
    onError: (error: AxiosError) => {
      const message = (error.response?.data as { message?: string })?.message || 'Failed to restore email template';
      toast.error(message);
    },
  });

  // Get contact emails (email history)
  const useContactEmails = (
    contactId: number | null,
    page = 1,
    perPage = 50,
    enabled = true
  ) => {
    return useQuery({
      queryKey: ['crm-contact-emails', contactId, page, perPage],
      queryFn: async () => {
        const response = await api.get<{
          error: boolean;
          data: { emails: ContactEmail[]; pagination: Pagination };
        }>(`/crm/contacts/${contactId}/emails`, {
          params: { page, per_page: perPage },
        });
        return response.data.data;
      },
      enabled: enabled && contactId !== null,
    });
  };

  // Send email to contact
  const sendEmailMutation = useMutation({
    mutationFn: async ({
      contactId,
      templateId,
      subject,
      body,
    }: {
      contactId: number;
      templateId?: number | null;
      subject: string;
      body: string;
    }) => {
      const response = await api.post<{
        error: boolean;
        message: string;
      }>(`/crm/contacts/${contactId}/emails/send`, {
        template_id: templateId,
        subject,
        body,
      });
      return response.data;
    },
    onSuccess: (data, variables) => {
      toast.success(data.message);
      queryClient.invalidateQueries({
        queryKey: ['crm-contact-emails', variables.contactId],
      });
    },
    onError: (error: AxiosError<{ message?: string }>) => {
      toast.error(error.response?.data?.message || 'Failed to send email');
    },
  });

  // ============================================================================
  // SEGMENTS
  // ============================================================================

  const useSegments = () => {
    return useQuery({
      queryKey: ['crm-segments'],
      queryFn: async () => {
        const response = await api.get<{
          error: boolean;
          data: Segment[];
        }>('/crm/segments');
        return response.data.data;
      },
      enabled: isPro,
      refetchOnWindowFocus: false,
    });
  };

  const createSegmentMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      conditions: { logic: 'AND' | 'OR'; groups: SegmentConditionGroup[] };
    }) => {
      if (!isPro) {
        throw new Error('Pro license required to create segments');
      }
      const response = await api.post<{
        error: boolean;
        segment_id: number;
        message: string;
      }>('/crm/segments', data);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['crm-segments'] });
    },
    onError: (error: AxiosError) => {
      toast.error((error.response?.data as { message?: string })?.message || 'Failed to create segment');
    },
  });

  const updateSegmentMutation = useMutation({
    mutationFn: async ({
      segmentId,
      data,
    }: {
      segmentId: number;
      data: Partial<Segment>;
    }) => {
      if (!isPro) {
        throw new Error('Pro license required to update segments');
      }
      const response = await api.post<{
        error: boolean;
        message: string;
      }>(`/crm/segments/${segmentId}`, data);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['crm-segments'] });
    },
    onError: (error: AxiosError) => {
      toast.error((error.response?.data as { message?: string })?.message || 'Failed to update segment');
    },
  });

  const deleteSegmentMutation = useMutation({
    mutationFn: async (segmentId: number) => {
      if (!isPro) {
        throw new Error('Pro license required to delete segments');
      }
      const response = await api.post<{
        error: boolean;
        message: string;
      }>(`/crm/segments/${segmentId}/delete`);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['crm-segments'] });
    },
    onError: (error: AxiosError) => {
      toast.error((error.response?.data as { message?: string })?.message || 'Failed to delete segment');
    },
  });

  const useSegmentContacts = (
    segmentId: number | null,
    page = 1,
    perPage = 20,
    enabled = true
  ) => {
    return useQuery({
      queryKey: ['crm-segment-contacts', segmentId, page, perPage],
      queryFn: async () => {
        const response = await api.get<{
          error: boolean;
          data: { contacts: Contact[]; pagination: Pagination };
        }>(`/crm/segments/${segmentId}/contacts`, {
          params: { page, per_page: perPage },
        });
        return response.data.data;
      },
      enabled: isPro && enabled && segmentId !== null,
      refetchOnWindowFocus: false,
    });
  };

  const useSegmentPreview = (segmentId: number | null, enabled = true) => {
    return useQuery({
      queryKey: ['crm-segment-preview', segmentId],
      queryFn: async () => {
        const response = await api.get<{
          error: boolean;
          data: { contact_count: number };
        }>(`/crm/segments/${segmentId}/preview`);
        return response.data.data;
      },
      enabled: isPro && enabled && segmentId !== null,
      refetchOnWindowFocus: false,
    });
  };

  const refreshSegmentCountMutation = useMutation({
    mutationFn: async (segmentId: number) => {
      if (!isPro) {
        throw new Error('Pro license required to refresh segment counts');
      }
      const response = await api.post<{
        error: boolean;
        data: { contact_count: number };
        message: string;
      }>(`/crm/segments/${segmentId}/refresh`);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['crm-segments'] });
      queryClient.invalidateQueries({ queryKey: ['crm-segment-preview'] });
    },
    onError: (error: AxiosError) => {
      toast.error((error.response?.data as { message?: string })?.message || 'Failed to refresh segment count');
    },
  });

  // ============================================================================
  // CAMPAIGNS
  // ============================================================================

  const useCampaigns = (filters?: { status?: string }, page = 1, perPage = 20) => {
    return useQuery({
      queryKey: ['crm-campaigns', filters, page, perPage],
      queryFn: async () => {
        const params: Record<string, string | number> = {
          page,
          per_page: perPage,
        };
        if (filters?.status) {
          params.status = filters.status;
        }
        const response = await api.get<{
          error: boolean;
          data: { campaigns: Campaign[]; pagination: Pagination };
        }>('/crm/campaigns', { params });
        return response.data.data;
      },
      enabled: isPro,
      refetchOnWindowFocus: false,
    });
  };

  const createCampaignMutation = useMutation({
    mutationFn: async (data: Partial<Campaign>) => {
      if (!isPro) {
        throw new Error('Pro license required to create campaigns');
      }
      const response = await api.post<{
        error: boolean;
        campaign_id: number;
        message: string;
      }>('/crm/campaigns', data);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['crm-campaigns'] });
    },
    onError: (error: AxiosError) => {
      toast.error((error.response?.data as { message?: string })?.message || 'Failed to create campaign');
    },
  });

  const updateCampaignMutation = useMutation({
    mutationFn: async ({
      campaignId,
      data,
    }: {
      campaignId: number;
      data: Partial<Campaign>;
    }) => {
      if (!isPro) {
        throw new Error('Pro license required to update campaigns');
      }
      const response = await api.post<{
        error: boolean;
        message: string;
      }>(`/crm/campaigns/${campaignId}`, data);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['crm-campaigns'] });
    },
    onError: (error: AxiosError) => {
      toast.error((error.response?.data as { message?: string })?.message || 'Failed to update campaign');
    },
  });

  const deleteCampaignMutation = useMutation({
    mutationFn: async (campaignId: number) => {
      if (!isPro) {
        throw new Error('Pro license required to delete campaigns');
      }
      const response = await api.post<{
        error: boolean;
        message: string;
      }>(`/crm/campaigns/${campaignId}/delete`);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['crm-campaigns'] });
    },
    onError: (error: AxiosError) => {
      toast.error((error.response?.data as { message?: string })?.message || 'Failed to delete campaign');
    },
  });

  const sendCampaignMutation = useMutation({
    mutationFn: async (campaignId: number) => {
      if (!isPro) {
        throw new Error('Pro license required to send campaigns');
      }
      const response = await api.post<{
        error: boolean;
        message: string;
        job_id?: string | null;
      }>(`/crm/campaigns/${campaignId}/send`);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['crm-campaigns'] });
    },
    onError: (error: AxiosError) => {
      toast.error((error.response?.data as { message?: string })?.message || 'Failed to send campaign');
    },
  });

  const useCampaignStats = (campaignId: number | null, enabled = true) => {
    return useQuery({
      queryKey: ['crm-campaign-stats', campaignId],
      queryFn: async () => {
        const response = await api.get<{
          error: boolean;
          data: CampaignStats;
        }>(`/crm/campaigns/${campaignId}/stats`);
        return response.data.data;
      },
      enabled: isPro && enabled && campaignId !== null,
      refetchOnWindowFocus: false,
      refetchInterval: 5000, // Poll every 5 seconds when enabled
    });
  };

  const useCampaignJobStatus = (campaignId: number | null, enabled = true) => {
    return useQuery({
      queryKey: ['crm-campaign-job-status', campaignId],
      queryFn: async () => {
        const response = await api.get<{
          error: boolean;
          data: unknown;
          message?: string;
        }>(`/crm/campaigns/${campaignId}/job-status`);
        return response.data.data;
      },
      enabled: isPro && enabled && campaignId !== null,
      refetchOnWindowFocus: false,
      refetchInterval: 2000, // Poll every 2 seconds when enabled
    });
  };

  const useCampaignFailedEmails = (campaignId: number | null, enabled = true) => {
    return useQuery({
      queryKey: ['crm-campaign-failed-emails', campaignId],
      queryFn: async () => {
        const response = await api.get<{
          error: boolean;
          data: FailedEmail[];
        }>(`/crm/campaigns/${campaignId}/failed-emails`);
        return response.data.data;
      },
      enabled: isPro && enabled && campaignId !== null,
      refetchOnWindowFocus: false,
    });
  };

  // ============================================================================
  // EMAIL SEQUENCES
  // ============================================================================

  const useEmailSequences = () => {
    return useQuery({
      queryKey: ['crm-email-sequences'],
      queryFn: async () => {
        const response = await api.get<{
          error: boolean;
          data: EmailSequence[];
        }>('/crm/email-sequences');
        return response.data.data;
      },
      enabled: isPro,
      refetchOnWindowFocus: false,
    });
  };

  const createEmailSequenceMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      segment_id: number;
      is_active?: number;
      steps: Array<{
        template_id: number;
        subject_override?: string;
        body_override?: string;
        delay_days?: number;
        delay_hours?: number;
      }>;
    }) => {
      if (!isPro) {
        throw new Error('Pro license required to create email sequences');
      }
      const response = await api.post<{
        error: boolean;
        sequence_id: number;
        message: string;
      }>('/crm/email-sequences', data);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['crm-email-sequences'] });
    },
      onError: (error: AxiosError) => {
      toast.error((error.response?.data as { message?: string })?.message || 'Failed to create email sequence');
    },
  });

  const updateEmailSequenceMutation = useMutation({
    mutationFn: async ({
      sequenceId,
      data,
    }: {
      sequenceId: number;
      data: Partial<EmailSequence> & { steps?: Array<Partial<EmailSequenceStep>> };
    }) => {
      if (!isPro) {
        throw new Error('Pro license required to update email sequences');
      }
      const response = await api.post<{
        error: boolean;
        message: string;
      }>(`/crm/email-sequences/${sequenceId}`, data);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['crm-email-sequences'] });
    },
    onError: (error: AxiosError) => {
      toast.error((error.response?.data as { message?: string })?.message || 'Failed to update email sequence');
    },
  });

  const deleteEmailSequenceMutation = useMutation({
    mutationFn: async (sequenceId: number) => {
      if (!isPro) {
        throw new Error('Pro license required to delete email sequences');
      }
      const response = await api.post<{
        error: boolean;
        message: string;
      }>(`/crm/email-sequences/${sequenceId}/delete`);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['crm-email-sequences'] });
    },
    onError: (error: AxiosError) => {
      toast.error((error.response?.data as { message?: string })?.message || 'Failed to delete email sequence');
    },
  });

  const addSegmentToSequenceMutation = useMutation({
    mutationFn: async ({
      sequenceId,
      segmentId,
    }: {
      sequenceId: number;
      segmentId: number;
    }) => {
      if (!isPro) {
        throw new Error('Pro license required to add segments to sequences');
      }
      const response = await api.post<{
        error: boolean;
        data: { added: number };
        message: string;
      }>(`/crm/email-sequences/${sequenceId}/add-segment`, {
        segment_id: segmentId,
      });
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['crm-email-sequences'] });
    },
    onError: (error: AxiosError) => {
      toast.error((error.response?.data as { message?: string })?.message || 'Failed to add segment to sequence');
    },
  });

  const useSequenceFailedEmails = (sequenceId: number | null, enabled = true) => {
    return useQuery({
      queryKey: ['crm-sequence-failed-emails', sequenceId],
      queryFn: async () => {
        const response = await api.get<{
          error: boolean;
          data: FailedEmail[];
        }>(`/crm/email-sequences/${sequenceId}/failed-emails`);
        return response.data.data;
      },
      enabled: isPro && enabled && sequenceId !== null,
      refetchOnWindowFocus: false,
    });
  };

  return {
    // Contacts
    useContacts,
    useContact,
    createContactMutation,
    updateContactMutation,
    deleteContactMutation,
    // Custom Fields
    useCustomFields,
    createCustomFieldMutation,
    updateCustomFieldMutation,
    deleteCustomFieldMutation,
    // Notes
    useContactNotes,
    createNoteMutation,
    updateNoteMutation,
    deleteNoteMutation,
    // Orders
    useContactOrders,
    createManualOrderMutation,
    updateManualOrderMutation,
    deleteManualOrderMutation,
    useWooCommerceNewOrderUrl,
    useEddNewOrderUrl,
    useSureCartNewOrderUrl,
    // Statuses
    useContactStatuses,
    addStatusMutation,
    removeStatusMutation,
    // WordPress Users
    useSearchWpUsers,
    // Email Templates
    useEmailTemplates,
    createEmailTemplateMutation,
    updateEmailTemplateMutation,
    deleteEmailTemplateMutation,
    restoreEmailTemplateMutation,
    // Contact Emails
    useContactEmails,
    sendEmailMutation,
    // Segments
    useSegments,
    createSegmentMutation,
    updateSegmentMutation,
    deleteSegmentMutation,
    useSegmentContacts,
    useSegmentPreview,
    refreshSegmentCountMutation,
    // Campaigns
    useCampaigns,
    createCampaignMutation,
    updateCampaignMutation,
    deleteCampaignMutation,
    sendCampaignMutation,
    useCampaignStats,
    useCampaignJobStatus,
    useCampaignFailedEmails,
    // Email Sequences
    useEmailSequences,
    createEmailSequenceMutation,
    updateEmailSequenceMutation,
    deleteEmailSequenceMutation,
    addSegmentToSequenceMutation,
    useSequenceFailedEmails,
  };
}
