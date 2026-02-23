import api from '@/lib/axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { useSettings } from './useSettings';

const restBase =
  `${(typeof window !== 'undefined' && window.helpmateApiSettings?.site_url) || (typeof window !== 'undefined' && window.location?.origin) || ''}/?rest_route=/helpmate/v1`;

export interface SocialAccount {
  id: number;
  platform: 'messenger' | 'instagram' | 'whatsapp';
  page_id: string;
  page_name: string;
  instagram_account_id?: string;
  token_expires?: number;
  status: 'active' | 'inactive' | 'expired';
  created_at: string;
  updated_at: string;
}

export interface SocialConversation {
  id: number | string; // Can be numeric ID for social chats or string (website_xxx) for website chats or string (ticket_xxx) for tickets
  account_id: number;
  account_name?: string | null;
  platform:
    | 'messenger'
    | 'instagram'
    | 'fb_comment'
    | 'ig_comment'
    | 'website'
    | 'ticket'
    | 'whatsapp';
  external_id: string;
  post_id?: string;
  post_type?: string;
  post_message?: string;
  post_image_url?: string;
  parent_comment_id?: string;
  participant_id: string;
  participant_name: string;
  participant_profile_pic?: string | null;
  contact_id?: number | null;
  contact_first_name?: string | null;
  contact_last_name?: string | null;
  contact_email?: string | null;
  contact_avatar_url?: string | null;
  status: 'open' | 'resolved' | 'archived';
  is_human_handoff: boolean;
  handoff_at?: string | null;
  unread_count: number;
  last_message_at?: string;
  created_at: string;
}

export interface SocialMessage {
  id: number;
  conversation_id: number | string; // Can be numeric ID or string for website chats
  external_id?: string | null;
  direction: 'inbound' | 'outbound';
  content: string;
  message_type: 'text' | 'image' | 'comment' | 'postback' | 'system';
  sent_by: 'customer' | 'ai' | 'human' | 'system';
  user_id?: number | null;
  user_name?: string;
  user_avatar?: string;
  error_message?: string | null;
  system_event?: 'team_member_joined' | string;
  system_data?: {
    user_id?: number;
    first_name?: string;
    [key: string]: unknown;
  };
  meta_data?: {
    comment_id?: string;
    reply_id?: string;
    system_event?: string;
    feedback?: 'good' | 'bad';
    copied?: boolean;
    rag_context?: string;
    tool_type?: string;
    tool_data?: {
      products?: Array<{
        id: number;
        name: string;
        image: string;
        regular_price?: string;
        sale_price?: string;
        permalink?: string;
        currency_symbol?: string;
        [key: string]: unknown;
      }>;
      code?: string;
      discount?: string;
      validUntil?: string;
      submitted?: boolean;
      orderId?: string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  created_at: string;
}

export interface SocialChatSettings {
  app_id_set: boolean;
  app_secret_set: boolean;
  webhook_url: string;
  webhook_verify_token: string;
  enabled: boolean;
  platforms: {
    messenger: { enabled: boolean; auto_reply: boolean; comment_auto_reply?: boolean; conversation_starters_enabled?: boolean };
    instagram_dm: { enabled: boolean; auto_reply: boolean; comment_auto_reply?: boolean; conversation_starters_enabled?: boolean };
    whatsapp: { enabled: boolean; auto_reply: boolean; conversation_starters_enabled?: boolean };
    comments: { enabled: boolean };
  };
  leads_enabled?: boolean;
  conversation_starters_enabled?: boolean;
  collect_lead?: boolean;
  lead_form_fields?: string[];
}

export interface SocialLeadKeywords {
  messenger: string[];
  instagram_dm: string[];
  whatsapp: string[];
}

export interface SocialLeadCampaign {
  id: string;
  title: string;
  description: string;
  keywords: string; // Comma-separated keywords
  platform: 'facebook' | 'instagram'; // Which platform this campaign is for
  post_scope: 'specific_post';
  post_id: string; // The specific post ID (required - automation triggers only on this post)
  campaign_type: 'lead' | 'custom_message';
  collect_email: boolean;
  collect_phone: boolean;
  collect_address: boolean;
  url: string;
  comment_reply?: string;
  custom_message?: string;
  created_at: number;
}

export interface SocialPost {
  id: string;
  message?: string;
  caption?: string;
  media_url?: string;
  thumbnail_url?: string;
  full_picture?: string;
  media_type?: string;
  timestamp?: string;
  created_time?: string;
  platform: 'facebook' | 'instagram';
}

export interface SocialConversationStarter {
  id: string | number;
  text: string;
  enabled: boolean;
  is_default?: boolean; // For smart scheduling appointment starter
}

export interface SocialConversationStarters {
  messenger: SocialConversationStarter[];
  instagram_dm: SocialConversationStarter[];
  whatsapp: SocialConversationStarter[];
}

export interface SocialAnalytics {
  total_messages_inbound: number;
  total_messages_outbound: number;
  ai_responses: number;
  human_responses: number;
  total_conversations: number;
  handoff_conversations: number;
  handoff_rate: number;
  crm_linked_conversations?: number;
  crm_link_rate?: number;
  manual_responses?: number;
  manual_response_rate?: number;
  messages_by_platform: { platform: string; count: number }[];
}

export interface PendingPage {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: {
    id: string;
    username: string;
    profile_picture_url?: string;
  };
}

export function useSocialChat() {
  const queryClient = useQueryClient();
  const { getProQuery } = useSettings();
  const isPro = getProQuery.data ?? false;

  // Get accounts
  const getAccountsQuery = useQuery({
    enabled: isPro, // Only fetch if pro is active
    queryKey: ['social-accounts'],
    queryFn: async () => {
      const response = await api.get<{
        error: boolean;
        data: { accounts: SocialAccount[]; pagination: object };
      }>('/social/accounts');
      return response.data.data;
    },
    refetchOnWindowFocus: false,
  });

  // Start OAuth flow (backwards compatibility - uses all permissions)
  const connectAccountMutation = useMutation({
    mutationFn: async () => {
      if (!isPro) {
        throw new Error('Pro license required to connect social platforms');
      }
      const response = await api.post<{
        error: boolean;
        oauth_url?: string;
        authorization_url?: string; // Backwards compatibility
        message?: string;
      }>('/social/accounts/connect');
      return response.data;
    },
    onSuccess: (data) => {
      const url = data.oauth_url || data.authorization_url;
      if (url) {
        window.location.href = url;
      }
    },
    onError: (error: Error) => {
      if (error.message.includes('Pro license')) {
        toast.error('Pro license required to connect social platforms');
      } else {
        toast.error('Failed to start connection');
      }
    },
  });

  // Connect Facebook Page only
  const connectFacebookPageMutation = useMutation({
    mutationFn: async (params?: { returnTo?: string }) => {
      if (!isPro) {
        throw new Error('Pro license required to connect social platforms');
      }
      const body: { platform: string; return_to?: string } = {
        platform: 'facebook',
      };
      if (params?.returnTo) {
        body.return_to = params.returnTo;
      }
      const response = await api.post<{
        error: boolean;
        oauth_url?: string;
        authorization_url?: string;
        message?: string;
      }>('/social/accounts/connect', body);
      return response.data;
    },
    onSuccess: (data) => {
      const url = data.oauth_url || data.authorization_url;
      if (url) {
        window.location.href = url;
      }
    },
    onError: (error: Error) => {
      if (error.message.includes('Pro license')) {
        toast.error('Pro license required to connect social platforms');
      } else {
        toast.error('Failed to start Facebook Page connection');
      }
    },
  });

  // Connect Instagram Business
  const connectInstagramMutation = useMutation({
    mutationFn: async (params?: { returnTo?: string }) => {
      if (!isPro) {
        throw new Error('Pro license required to connect social platforms');
      }
      const body: { platform: string; return_to?: string } = {
        platform: 'instagram',
      };
      if (params?.returnTo) {
        body.return_to = params.returnTo;
      }
      const response = await api.post<{
        error: boolean;
        oauth_url?: string;
        authorization_url?: string;
        message?: string;
      }>('/social/accounts/connect', body);
      return response.data;
    },
    onSuccess: (data) => {
      const url = data.oauth_url || data.authorization_url;
      if (url) {
        window.location.href = url;
      }
    },
    onError: (error: Error) => {
      if (error.message.includes('Pro license')) {
        toast.error('Pro license required to connect social platforms');
      } else {
        toast.error('Failed to start Instagram Business connection');
      }
    },
  });

  // Connect WhatsApp
  const connectWhatsAppMutation = useMutation({
    mutationFn: async (params?: { returnTo?: string }) => {
      if (!isPro) {
        throw new Error('Pro license required to connect social platforms');
      }
      const body: { platform: string; return_to?: string } = {
        platform: 'whatsapp',
      };
      if (params?.returnTo) {
        body.return_to = params.returnTo;
      }
      const response = await api.post<{
        error: boolean;
        oauth_url?: string;
        authorization_url?: string;
        message?: string;
      }>('/social/accounts/connect', body);
      return response.data;
    },
    onSuccess: (data) => {
      const url = data.oauth_url || data.authorization_url;
      if (url) {
        window.location.href = url;
      }
    },
    onError: (error: Error) => {
      if (error.message.includes('Pro license')) {
        toast.error('Pro license required to connect social platforms');
      } else {
        toast.error('Failed to start WhatsApp connection');
      }
    },
  });

  // Get pending pages for selection (via license-server proxy from social-server cache)
  // Note: This query requires temp_token to be passed via queryKey or as a state variable
  // For now, we'll use a custom hook that accepts temp_token
  const usePendingPagesQuery = (temp_token: string | null) => {
    return useQuery({
      queryKey: ['social-pending-pages', temp_token],
      queryFn: async () => {
        if (!temp_token) {
          throw new Error('temp_token is required');
        }
        const response = await api.post<{
          error: boolean;
          data?: {
            pages?: PendingPage[];
            platform?: string;
            total?: number;
          };
          message?: string;
        }>('/social/fetch-pending-pages', { temp_token });
        if (response.data.error) {
          throw new Error(
            response.data.message || 'Failed to fetch pending pages'
          );
        }
        return response.data.data?.pages ?? [];
      },
      enabled: !!temp_token, // Only fetch when temp_token is provided
    });
  };

  // Keep old query for backward compatibility (will be removed)
  const getPendingPagesQuery = useQuery({
    queryKey: ['social-pending-pages'],
    queryFn: async () => [],
    enabled: false,
  });

  // Connect selected page (single page selection)
  const connectPagesMutation = useMutation({
    mutationFn: async (params: {
      temp_token: string;
      selected_page_id: string;
      platform: string;
    }) => {
      const response = await api.post<{
        error: boolean;
        message: string;
        data?: {
          account?: SocialAccount | null;
        };
      }>('/social/connect-selected-page', {
        temp_token: params.temp_token,
        selected_page_id: params.selected_page_id,
        platform: params.platform,
      });
      if (response.data.error) {
        throw new Error(response.data.message || 'Failed to connect page');
      }
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Page connected successfully');
      queryClient.invalidateQueries({ queryKey: ['social-accounts'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to connect page');
    },
  });

  // Disconnect account
  const disconnectAccountMutation = useMutation({
    mutationFn: async (accountId: number) => {
      if (!isPro) {
        throw new Error('Pro license required to disconnect social accounts');
      }
      const response = await api.post<{ error: boolean; message: string }>(
        `/social/accounts/${accountId}/disconnect`
      );
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['social-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['social-conversation-starters'] });
      queryClient.invalidateQueries({ queryKey: ['social-chat-settings'] });
    },
    onError: (error: Error) => {
      if (error.message.includes('Pro license')) {
        toast.error('Pro license required to disconnect social accounts');
      } else {
        toast.error('Failed to disconnect account');
      }
    },
  });

  // WhatsApp register retry (133005 PIN mismatch - user provides existing PIN)
  const registerRetryMutation = useMutation({
    mutationFn: async (params: { retry_token: string; pin: string }) => {
      try {
        const response = await api.post<{
          error: boolean;
          success?: boolean;
          pin?: string;
          message?: string;
          code?: string;
        }>('/social/whatsapp-register-retry', {
          retry_token: params.retry_token,
          pin: params.pin,
        });
        if (response.data.error && !response.data.success) {
          const err = new Error(response.data.message || 'Registration failed') as Error & {
            code?: string;
          };
          err.code = response.data.code;
          throw err;
        }
        return response.data;
      } catch (e: unknown) {
        const ax = e as { response?: { data?: { message?: string; code?: string } }; message?: string };
        const data = ax.response?.data;
        const err = new Error(data?.message || ax.message || 'Registration failed') as Error & {
          code?: string;
        };
        err.code = data?.code;
        throw err;
      }
    },
  });

  // Get conversations
  const useConversations = (filters?: {
    platform?: string;
    status?: string;
    is_human_handoff?: number;
    account_id?: number;
    contact_id?: number;
    page?: number;
    per_page?: number;
    search?: string;
    date_from?: string;
    date_to?: string;
  }) => {
    return useQuery({
      queryKey: ['social-conversations', filters],
      queryFn: async () => {
        const params: Record<string, string | number> = {};
        if (filters) {
          Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== '') {
              params[key] = value;
            }
          });
        }
        const response = await api.get<{
          error: boolean;
          data: { conversations: SocialConversation[]; pagination: object };
        }>('/social/conversations', { params });
        return response.data.data;
      },
      placeholderData: (previousData) => previousData, // Keep previous data during refetch; list refreshed via notifications SSE
    });
  };

  // Get messages for a conversation (refetch via realtime SSE when conversation selected, no polling)
  const useMessages = (conversationId: number | string, enabled = true) => {
    return useQuery({
      queryKey: ['social-messages', conversationId],
      queryFn: async () => {
        const response = await api.get<{
          error: boolean;
          data: {
            messages: SocialMessage[];
            pagination: object;
            is_user_typing?: boolean;
          };
        }>(`/social/conversations/${conversationId}/messages`);
        return response.data.data;
      },
      enabled,
    });
  };

  // Send manual reply
  const sendReplyMutation = useMutation({
    mutationFn: async ({
      conversationId,
      message,
    }: {
      conversationId: number | string;
      message: string;
    }) => {
      const response = await api.post<{ error: boolean; message: string }>(
        `/social/conversations/${conversationId}/reply`,
        { message }
      );
      return response.data;
    },
    onSuccess: (data, variables) => {
      toast.success(data.message);
      queryClient.invalidateQueries({
        queryKey: ['social-messages', variables.conversationId],
      });
      queryClient.invalidateQueries({ queryKey: ['social-conversations'] });
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { message?: string } } })
          ?.response?.data?.message;
      toast.error(
        message && typeof message === 'string'
          ? message
          : 'Failed to send reply'
      );
    },
  });

  // Toggle handoff
  const toggleHandoffMutation = useMutation({
    mutationFn: async ({
      conversationId,
      handoff,
    }: {
      conversationId: number | string;
      handoff: boolean;
    }) => {
      const response = await api.post<{ error: boolean; message: string }>(
        `/social/conversations/${conversationId}/handoff`,
        { handoff }
      );
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['social-conversations'] });
    },
    onError: () => {
      toast.error('Failed to update handoff status');
    },
  });

  // Bulk toggle handoff for platform
  const bulkToggleHandoffMutation = useMutation({
    mutationFn: async ({
      platform,
      handoff,
    }: {
      platform: string;
      handoff: boolean;
    }) => {
      const response = await api.post<{
        error: boolean;
        message: string;
        updated_count: number;
      }>('/social/conversations/bulk-handoff', { platform, handoff });
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['social-conversations'] });
    },
    onError: () => {
      toast.error('Failed to update conversations');
    },
  });

  // Update conversation status
  const updateStatusMutation = useMutation({
    mutationFn: async ({
      conversationId,
      status,
    }: {
      conversationId: number | string;
      status: string;
    }) => {
      const response = await api.post<{ error: boolean; message: string }>(
        `/social/conversations/${conversationId}/status`,
        { status }
      );
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['social-conversations'] });
    },
    onError: () => {
      toast.error('Failed to update status');
    },
  });

  // Get settings
  const getSettingsQuery = useQuery({
    queryKey: ['social-chat-settings'],
    queryFn: async () => {
      const response = await api.get<{
        error: boolean;
        settings: SocialChatSettings;
      }>('/social/settings');
      return response.data.settings;
    },
    refetchOnWindowFocus: false,
  });

  // Update settings
  const updateSettingsMutation = useMutation({
    mutationFn: async (
      settings: Partial<SocialChatSettings> & {
        app_id?: string;
        app_secret?: string;
      }
    ) => {
      const response = await api.post<{ error: boolean; message: string }>(
        '/social/settings',
        settings
      );
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['social-chat-settings'] });
    },
    onError: () => {
      toast.error('Failed to update settings');
    },
  });

  // Get lead campaigns
  const getLeadCampaignsQuery = useQuery({
    queryKey: ['social-lead-campaigns'],
    queryFn: async () => {
      const response = await api.get<{
        error: boolean;
        campaigns: SocialLeadCampaign[];
      }>('/social/lead-campaigns');
      return response.data.campaigns;
    },
    refetchOnWindowFocus: false,
  });

  // Create lead campaign
  const createLeadCampaignMutation = useMutation({
    mutationFn: async (
      campaign: Omit<SocialLeadCampaign, 'id' | 'created_at'>
    ) => {
      const response = await api.post<{
        error: boolean;
        campaign: SocialLeadCampaign;
        message: string;
      }>('/social/lead-campaigns', campaign);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['social-lead-campaigns'] });
    },
    onError: () => {
      toast.error('Failed to create campaign');
    },
  });

  // Update lead campaign
  const updateLeadCampaignMutation = useMutation({
    mutationFn: async ({
      id,
      ...campaign
    }: Partial<SocialLeadCampaign> & { id: string }) => {
      const response = await api.post<{
        error: boolean;
        campaign: SocialLeadCampaign;
        message: string;
      }>(`/social/lead-campaigns/${id}`, campaign);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['social-lead-campaigns'] });
    },
    onError: () => {
      toast.error('Failed to update campaign');
    },
  });

  // Delete lead campaign
  const deleteLeadCampaignMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.post<{ error: boolean; message: string }>(
        `/social/lead-campaigns/${id}/delete`
      );
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['social-lead-campaigns'] });
    },
    onError: () => {
      toast.error('Failed to delete campaign');
    },
  });

  // Get lead keywords (deprecated - kept for backward compatibility)
  const getLeadKeywordsQuery = useQuery({
    queryKey: ['social-lead-keywords'],
    queryFn: async () => {
      const response = await api.get<{
        error: boolean;
        lead_keywords: SocialLeadKeywords;
      }>('/social/leads-settings');
      return response.data.lead_keywords;
    },
    refetchOnWindowFocus: false,
  });

  // Update lead keywords (deprecated - kept for backward compatibility)
  const updateLeadKeywordsMutation = useMutation({
    mutationFn: async (lead_keywords: SocialLeadKeywords) => {
      const response = await api.post<{ error: boolean; message: string }>(
        '/social/leads-settings',
        { lead_keywords }
      );
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['social-lead-keywords'] });
    },
    onError: () => {
      toast.error('Failed to update lead keywords');
    },
  });

  // Get conversation starters
  const getConversationStartersQuery = useQuery({
    queryKey: ['social-conversation-starters'],
    queryFn: async () => {
      const response = await api.get<{
        error: boolean;
        conversation_starters: SocialConversationStarters;
        smart_scheduling?: {
          enabled: boolean;
          page_url?: string;
          button_text?: string;
        };
      }>('/social/conversation-starters');
      return response.data;
    },
    refetchOnWindowFocus: false,
  });

  // Update conversation starters
  const updateConversationStartersMutation = useMutation({
    mutationFn: async (conversation_starters: SocialConversationStarters) => {
      const response = await api.post<{ error: boolean; message: string }>(
        '/social/conversation-starters',
        { conversation_starters }
      );
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({
        queryKey: ['social-conversation-starters'],
      });
      queryClient.invalidateQueries({
        queryKey: ['social-chat-settings'],
      });
    },
    onError: () => {
      toast.error('Failed to update conversation starters');
    },
  });

  // End chat (triggers review form for website conversations)
  const endChatMutation = useMutation({
    mutationFn: async (conversationId: number | string) => {
      const response = await api.post<{ error: boolean; message: string }>(
        `/social/conversations/${conversationId}/end-chat`
      );
      return response.data;
    },
    onSuccess: (data, conversationId) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['social-conversations'] });
      queryClient.invalidateQueries({
        queryKey: ['social-reviews', conversationId],
      });
    },
    onError: () => {
      toast.error('Failed to end chat');
    },
  });

  // Get reviews for a conversation
  const useReviewsQuery = (conversationId: number | string, enabled = true) => {
    return useQuery({
      queryKey: ['social-reviews', conversationId],
      queryFn: async () => {
        const response = await api.get<{
          error: boolean;
          data: {
            reviews: Array<{
              id: number;
              session_id: string;
              conversation_id: string;
              rating: number;
              message: string | null;
              created_at: string;
              updated_at: string;
            }>;
            user_ended_chat?: boolean;
          };
        }>(`/social/conversations/${conversationId}/reviews`);
        return response.data.data;
      },
      enabled,
    });
  };

  // Get posts for a platform/account
  const useSocialPostsQuery = (
    platform: 'facebook' | 'instagram',
    accountId: number | null,
    limit = 3,
    cursor: string | null = null,
    enabled = true
  ) => {
    return useQuery({
      queryKey: ['social-posts', platform, accountId, limit, cursor],
      queryFn: async () => {
        const params: Record<string, string | number> = {
          platform,
          limit,
        };
        if (accountId) {
          params.account_id = accountId;
        }
        if (cursor) {
          params.cursor = cursor;
        }
        const response = await api.get<{
          error: boolean;
          posts: SocialPost[];
          next_cursor?: string | null;
        }>('/social/posts', { params });
        if (response.data.error) {
          throw new Error('Failed to fetch posts');
        }
        return {
          posts: response.data.posts,
          nextCursor: response.data.next_cursor ?? null,
        };
      },
      enabled: enabled && !!accountId,
      refetchOnWindowFocus: false,
    });
  };

  // Get analytics
  const useAnalytics = (dateFilter = '30d', userId?: number | null) => {
    return useQuery({
      queryKey: ['social-analytics', dateFilter, userId],
      queryFn: async () => {
        const params: Record<string, string | number> = { date_filter: dateFilter };
        if (userId) {
          params.user_id = userId;
        }
        const response = await api.get<{
          error: boolean;
          data: SocialAnalytics;
        }>('/social/analytics', { params });
        return response.data.data;
      },
    });
  };

  // Get counts for badge (SSE-driven: notifications stream invalidates; Social badge uses notification unread-counts by type)
  const getCountsQuery = useQuery({
    queryKey: ['social-counts'],
    queryFn: async () => {
      const response = await api.get<{
        error: boolean;
        unread: number;
        handoff_pending: number;
      }>('/social/counts');
      return response.data;
    },
  });

  // Edit comment reply
  const editCommentMutation = useMutation({
    mutationFn: async ({
      messageId,
      content,
    }: {
      messageId: number;
      content: string;
    }) => {
      const response = await api.post<{ error: boolean; message: string }>(
        `/social/messages/${messageId}/edit`,
        { content }
      );
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({
        queryKey: ['social-messages'],
      });
    },
    onError: () => {
      toast.error('Failed to edit comment');
    },
  });

  // Delete comment reply
  const deleteCommentMutation = useMutation({
    mutationFn: async (messageId: number) => {
      const response = await api.post<{ error: boolean; message: string }>(
        `/social/messages/${messageId}/delete`
      );
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({
        queryKey: ['social-messages'],
      });
    },
    onError: () => {
      toast.error('Failed to delete comment');
    },
  });

  // Link contact to conversation
  const linkContactMutation = useMutation({
    mutationFn: async ({
      conversationId,
      contactId,
    }: {
      conversationId: number | string;
      contactId: number;
    }) => {
      const response = await api.post<{ error: boolean; message: string }>(
        `/social/conversations/${conversationId}/link-contact`,
        { contact_id: contactId }
      );
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['social-conversations'] });
    },
    onError: () => {
      toast.error('Failed to link contact');
    },
  });

  // Unlink contact from conversation
  const unlinkContactMutation = useMutation({
    mutationFn: async (conversationId: number | string) => {
      const response = await api.post<{ error: boolean; message: string }>(
        `/social/conversations/${conversationId}/unlink-contact`
      );
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['social-conversations'] });
    },
    onError: () => {
      toast.error('Failed to unlink contact');
    },
  });

  // Get contact for conversation
  const useConversationContact = (
    conversationId: number | string | null,
    enabled = true
  ) => {
    return useQuery({
      queryKey: ['social-conversation-contact', conversationId],
      queryFn: async () => {
        if (!conversationId) {
          return null;
        }
        const response = await api.get<{
          error: boolean;
          data: {
            contact_id: number;
            contact_first_name: string;
            contact_last_name: string;
            contact_email: string;
            contact_avatar_url: string;
          } | null;
        }>(`/social/conversations/${conversationId}/contact`);
        return response.data.data;
      },
      enabled: enabled && conversationId !== null,
      refetchOnWindowFocus: false,
    });
  };

  // Get conversation participants (team members who joined)
  const useConversationParticipants = (
    conversationId: number | string | null,
    enabled = true
  ) => {
    return useQuery({
      queryKey: ['social-conversation-participants', conversationId],
      queryFn: async () => {
        if (!conversationId) {
          return [];
        }
        const response = await api.get<{
          error: boolean;
          data: Array<{
            user_id: number;
            first_name: string;
            last_name: string;
            display_name: string;
            joined_at: string;
          }>;
        }>(`/social/conversations/${conversationId}/participants`);
        return response.data.data;
      },
      enabled: enabled && conversationId !== null,
      placeholderData: (previousData) => previousData,
    });
  };

  // Short polling for realtime messages (avoids holding PHP worker; other requests no longer stay pending)
  const useRealtimeMessages = (conversationId: number | string | null) => {
    const qc = useQueryClient();
    useEffect(() => {
      if (conversationId === null || conversationId === undefined) return;
      const tick = async () => {
        try {
          const cached = qc.getQueryData<{ messages?: { id: number }[] }>(['social-messages', conversationId]);
          const lastId = cached?.messages?.length
            ? Math.max(0, ...cached.messages.map((m) => m.id))
            : 0;
          const res = await api.get<{ messages?: unknown[] }>(`${restBase}/realtime/messages/poll`, {
            params: { conversation_id: String(conversationId), last_id: lastId },
          });
          if (res.data?.messages?.length) {
            qc.invalidateQueries({ queryKey: ['social-messages', conversationId] });
          }
        } catch {
          /**/
        }
      };
      tick();
      const interval = setInterval(tick, 2000);
      return () => clearInterval(interval);
    }, [conversationId, qc]);
  };

  return {
    // Accounts
    getAccountsQuery,
    connectAccountMutation, // Backwards compatibility
    connectFacebookPageMutation,
    connectInstagramMutation,
    connectWhatsAppMutation,
    getPendingPagesQuery,
    usePendingPagesQuery,
    connectPagesMutation,
    disconnectAccountMutation,
    registerRetryMutation,
    // Conversations
    useConversations,
    useMessages,
    sendReplyMutation,
    toggleHandoffMutation,
    bulkToggleHandoffMutation,
    updateStatusMutation,
    // Settings
    getSettingsQuery,
    updateSettingsMutation,
    // Lead Keywords
    getLeadCampaignsQuery,
    createLeadCampaignMutation,
    updateLeadCampaignMutation,
    deleteLeadCampaignMutation,
    getLeadKeywordsQuery,
    updateLeadKeywordsMutation,
    // Conversation Starters
    getConversationStartersQuery,
    updateConversationStartersMutation,
    // Analytics
    useAnalytics,
    // Counts
    getCountsQuery,
    // Comment editing
    editCommentMutation,
    // Comment deletion
    deleteCommentMutation,
    // Contact linking
    linkContactMutation,
    unlinkContactMutation,
    useConversationContact,
    // Participants
    useConversationParticipants,
    useRealtimeMessages,
    // Reviews
    endChatMutation,
    useReviewsQuery,
    // Posts
    useSocialPostsQuery,
  };
}
