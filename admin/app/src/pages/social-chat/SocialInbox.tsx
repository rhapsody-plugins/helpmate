import Loading from '@/components/Loading';
import { Badge } from '@/components/ui/badge';
import PageGuard from '@/components/PageGuard';
import { ProBadge, ProBadgeInput } from '@/components/ProBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  SocialConversation,
  SocialMessage,
  useSocialChat,
} from '@/hooks/useSocialChat';
import api from '@/lib/axios';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import {
  Archive,
  ArchiveRestore,
  Bot,
  Facebook,
  Filter,
  Instagram,
  Loader2,
  MessageCircle,
  MessageSquare,
  Plus,
  Send,
  Star,
  Ticket,
  User,
  UserCheck,
  X,
} from 'lucide-react';
import { parseUTCDate } from '@/pages/crm/contacts/utils';
import { Icon } from '@iconify/react';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { InboxMessageBubble } from '@/components/chat/InboxMessageBubble';
import useActivity from '@/hooks/useActivity';
import { useMarkReadByEntity } from '@/hooks/useNotifications';
import ContactSidebar from './ContactSidebar';
import { useCrm } from '@/hooks/useCrm';
import { useSettings } from '@/hooks/useSettings';
import { useMain } from '@/contexts/MainContext';
import type { PageType } from '@/contexts/MainContext';

function getInboxPageForPlatform(
  platform: SocialConversation['platform']
): PageType {
  switch (platform) {
    case 'ticket':
      return 'inbox-tickets';
    case 'fb_comment':
    case 'ig_comment':
      return 'inbox-comments';
    case 'messenger':
    case 'instagram':
    case 'whatsapp':
      return 'inbox-social-messages';
    case 'website':
    default:
      return 'inbox-live-chat';
  }
}

export default function SocialInbox() {
  const { page, setPage } = useMain();
  const { getProQuery } = useSettings();
  const isPro = getProQuery.data ?? false;
  const showProOverlay =
    !isPro &&
    !getProQuery.isLoading &&
    (page === 'inbox-social-messages' ||
      page === 'inbox-comments' ||
      page === 'inbox-live-chat');
  const [selectedConversationId, setSelectedConversationId] = useState<
    number | string | null
  >(null);
  const [aiEnabled, setAiEnabled] = useState<boolean>(true);
  const [contactSidebarOpen, setContactSidebarOpen] = useState(false);
  const [showEndChatConfirm, setShowEndChatConfirm] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);

  const {
    useConversations,
    useMessages,
    useRealtimeMessages,
    sendReplyMutation,
    toggleHandoffMutation,
    updateStatusMutation,
    editCommentMutation,
    deleteCommentMutation,
    getAccountsQuery,
    endChatMutation,
    useReviewsQuery,
    useConversationParticipants,
  } = useSocialChat();
  const queryClient = useQueryClient();
  const { mutate: markReadByEntity } = useMarkReadByEntity();
  useRealtimeMessages(selectedConversationId);

  // Preselect conversation or ticket from URL (e.g. when clicking a notification link)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const convId = params.get('conversation_id');
    const ticketId = params.get('ticket_id');
    if (convId) {
      setSelectedConversationId(convId);
      params.delete('conversation_id');
    }
    if (ticketId) {
      openedViaTicketIdRef.current = true;
      setPage('inbox-tickets');
      setViewMode('tickets');
      // Backend uses id 'ticket_' + ticket_id for ticket conversations
      setSelectedConversationId(`ticket_${ticketId}`);
      params.delete('ticket_id');
    }
    if (convId || ticketId) {
      const newSearch = params.toString();
      const newUrl = `${window.location.pathname}${newSearch ? `?${newSearch}` : ''}`;
      window.history.replaceState({}, '', newUrl);
    }
  }, []);

  // Mark conversation notifications as read when user opens this conversation
  useEffect(() => {
    if (selectedConversationId !== null && typeof selectedConversationId === 'number') {
      markReadByEntity({ entity_type: 'conversation', entity_id: selectedConversationId });
    }
  }, [selectedConversationId, markReadByEntity]);
  const { useContact, useContacts, createContactMutation } = useCrm();
  const { createTicket } = useActivity();
  const { getSettingsMutation } = useSettings();
  const { mutate: getSettings } = getSettingsMutation;

  // Determine initial view mode based on page type
  const getViewModeFromPage = (currentPage: typeof page): 'chats' | 'tickets' | 'comments' | 'all' => {
    switch (currentPage) {
      case 'inbox-chatbot':
        return 'chats'; // Filter to chatbot conversations
      case 'inbox-live-chat':
        return 'chats'; // Filter to live chat (website, messenger, instagram)
      case 'inbox-tickets':
        return 'tickets';
      case 'inbox-social-messages':
        return 'chats'; // Filter to social messages (messenger, instagram)
      case 'inbox-comments':
        return 'comments';
      case 'inbox-archived':
        return 'all';
      case 'inbox-all':
      default:
        return 'all';
    }
  };

  const [viewMode, setViewMode] = useState<
    'chats' | 'tickets' | 'comments' | 'all'
  >(() => getViewModeFromPage(page));
  const openedViaTicketIdRef = useRef(false);

  // Update view mode when page changes (unless we just opened via ticket_id deep link)
  useEffect(() => {
    if (openedViaTicketIdRef.current) {
      openedViaTicketIdRef.current = false;
      setViewMode('tickets');
      return;
    }
    setViewMode(getViewModeFromPage(page));
  }, [page]);

  // Fetch AI settings to determine if AI is enabled
  useEffect(() => {
    const fetchAiSettings = () => {
      getSettings('ai', {
        onSuccess: (data) => {
          setAiEnabled((data as { ai_enabled?: boolean }).ai_enabled ?? true);
        },
      });
    };

    // Fetch on mount
    fetchAiSettings();

    // Refetch when page becomes visible (in case settings changed)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchAiSettings();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [getSettings]);
  const showArchived = page === 'inbox-archived';
  const [filters, setFilters] = useState({
    platform: '',
    is_human_handoff: undefined as number | undefined,
    account_id: undefined as number | undefined,
    search: '',
    date_from: '',
    date_to: '',
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [datePreset, setDatePreset] = useState<string>('');
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 20;
  const [replyText, setReplyText] = useState('');
  const [isUserTyping, setIsUserTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesScrollAreaRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isCreateTicketOpen, setIsCreateTicketOpen] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [contactPopoverOpen, setContactPopoverOpen] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<number | null>(
    null
  );

  const ticketFormSchema = z
    .object({
      subject: z.string().min(1, 'Subject is required'),
      message: z.string().min(1, 'Message is required'),
      email: z
        .string()
        .email('Invalid email address')
        .optional()
        .or(z.literal('')),
      name: z.string().optional(),
      priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
      createNewContact: z.boolean().optional(),
    })
    .refine(
      (data) => {
        // Email required if no contact selected AND not creating new contact
        if (!selectedContactId && !data.createNewContact) {
          return data.email && data.email.length > 0;
        }
        // Email required if creating new contact
        if (data.createNewContact) {
          return data.email && data.email.length > 0;
        }
        return true;
      },
      {
        message: 'Email is required when no contact is selected',
        path: ['email'],
      }
    );

  type TicketFormData = z.infer<typeof ticketFormSchema>;

  const form = useForm<TicketFormData>({
    resolver: zodResolver(ticketFormSchema),
    defaultValues: {
      subject: '',
      message: '',
      email: '',
      name: '',
      priority: 'normal',
      createNewContact: false,
    },
  });

  const { data: contactsData } = useContacts({ search: contactSearch }, 1, 50);
  const contacts = contactsData?.contacts || [];
  const selectedContact = contacts.find((c) => c.id === selectedContactId);
  const accounts = getAccountsQuery.data?.accounts ?? [];

  // Clear email validation errors when contact selection changes
  useEffect(() => {
    if (selectedContactId) {
      form.clearErrors('email');
    }
  }, [selectedContactId, form]);

  // Debounce search query
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setFilters((prev) => ({ ...prev, search: searchQuery }));
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Build filters based on view mode
  const effectiveFilters = {
    ...filters,
    page: currentPage,
    per_page: perPage,
    status: showArchived ? 'archived' : 'open',
  };

  // Override platform filter based on view mode
  if (viewMode === 'chats') {
    // In chats mode, only show chat platforms (exclude tickets and comments)
    // If specific channels are selected, use them; otherwise fetch all chats and filter client-side
    if (selectedChannels.length > 0) {
      const chatChannels = selectedChannels.filter(
        (ch) => ch !== 'ticket' && ch !== 'fb_comment' && ch !== 'ig_comment'
      );
      if (chatChannels.length > 0) {
        // For now, we'll filter client-side since API doesn't support multi-platform
        effectiveFilters.platform = '';
      } else {
        effectiveFilters.platform = '';
      }
    } else {
      effectiveFilters.platform = '';
    }
  } else if (viewMode === 'tickets') {
    // In tickets mode, only show tickets
    effectiveFilters.platform = 'ticket';
  } else if (viewMode === 'comments') {
    // In comments mode, only show comments
    if (
      selectedChannels.includes('fb_comment') ||
      selectedChannels.includes('ig_comment')
    ) {
      // If specific comment platform is selected, use it
      if (
        selectedChannels.includes('fb_comment') &&
        !selectedChannels.includes('ig_comment')
      ) {
        effectiveFilters.platform = 'fb_comment';
      } else if (
        selectedChannels.includes('ig_comment') &&
        !selectedChannels.includes('fb_comment')
      ) {
        effectiveFilters.platform = 'ig_comment';
      } else {
        effectiveFilters.platform = '';
      }
    } else {
      effectiveFilters.platform = '';
    }
  } else {
    // In 'all' mode, show everything
    // If specific channels are selected, we'll filter client-side
    if (selectedChannels.length > 0) {
      effectiveFilters.platform = '';
    } else {
      effectiveFilters.platform = '';
    }
  }

  const { data: conversationsData, isLoading: conversationsLoading } =
    useConversations(effectiveFilters);
  const pagination = conversationsData?.pagination as
    | {
        page: number;
        per_page: number;
        total: number;
        total_pages: number;
      }
    | undefined;
  let conversations = conversationsData?.conversations ?? [];

  // Client-side filtering based on view mode and page type
  if (viewMode === 'chats') {
    // Only show chat platforms (website, messenger, instagram, whatsapp)
    conversations = conversations.filter((c) =>
      ['website', 'messenger', 'instagram', 'whatsapp'].includes(c.platform)
    );

    // Apply specific filters based on page type
    if (page === 'inbox-chatbot') {
      // Filter to only chatbot conversations (website platform, not in handoff)
      conversations = conversations.filter(
        (c) => c.platform === 'website' && !c.is_human_handoff
      );
    } else if (page === 'inbox-live-chat') {
      // Filter to show all chat platforms (same as "chats" tab view)
      // This includes: website, messenger, instagram, whatsapp
      // No handoff filter - shows all chat conversations
      conversations = conversations.filter((c) =>
        ['website', 'messenger', 'instagram', 'whatsapp'].includes(c.platform)
      );
    } else if (page === 'inbox-social-messages') {
      // Filter to only social messages (messenger, instagram, whatsapp)
      conversations = conversations.filter(
        (c) =>
          ['messenger', 'instagram', 'whatsapp'].includes(c.platform)
      );
    }

    // Apply channel filter if set
    if (selectedChannels.length > 0) {
      conversations = conversations.filter((c) =>
        selectedChannels.includes(c.platform)
      );
    }
  } else if (viewMode === 'tickets') {
    // Only show tickets
    conversations = conversations.filter((c) => c.platform === 'ticket');
  } else if (viewMode === 'comments') {
    // Only show comment platforms
    conversations = conversations.filter(
      (c) => c.platform === 'fb_comment' || c.platform === 'ig_comment'
    );
    // Apply channel filter if set
    if (selectedChannels.length > 0) {
      conversations = conversations.filter((c) =>
        selectedChannels.includes(c.platform)
      );
    }
  } else {
    // 'all' mode - show everything, but apply channel filter if set
    if (selectedChannels.length > 0) {
      conversations = conversations.filter((c) =>
        selectedChannels.includes(c.platform)
      );
    }
  }

  const { data: messagesData, isLoading: messagesLoading } = useMessages(
    selectedConversationId ?? 0,
    selectedConversationId !== null
  );
  const messages = messagesData?.messages ?? [];

  // Refresh inbox counts once when messages load for the selected conversation so sidebar badges update immediately
  const lastCountsInvalidatedForRef = useRef<typeof selectedConversationId>(null);
  useEffect(() => {
    if (selectedConversationId === null) {
      lastCountsInvalidatedForRef.current = null;
      return;
    }
    if (messagesData !== undefined && lastCountsInvalidatedForRef.current !== selectedConversationId) {
      lastCountsInvalidatedForRef.current = selectedConversationId;
      queryClient.invalidateQueries({ queryKey: ['social-counts'] });
      queryClient.invalidateQueries({ queryKey: ['social-conversations'] });
    }
  }, [selectedConversationId, messagesData, queryClient]);

  // Fetch reviews for the selected conversation
  const { data: reviewsData } = useReviewsQuery(
    selectedConversationId ?? 0,
    selectedConversationId !== null
  );
  const reviews = reviewsData?.reviews ?? [];
  const userEndedChat = reviewsData?.user_ended_chat ?? false;

  // Fetch participants for the selected conversation
  const { data: participants = [] } = useConversationParticipants(
    selectedConversationId,
    selectedConversationId !== null
  );

  const selectedConversation = conversations.find(
    (c) => c.id === selectedConversationId
  );

  const isReplyProBlocked =
    !isPro && selectedConversation?.platform !== 'ticket';

  const chatEnded =
    selectedConversation?.platform === 'website' &&
    (userEndedChat || reviews.length > 0);

  // Get contact info for the selected conversation if it has a contact_id
  // This is used to display contact info in the header
  const contactId = selectedConversation?.contact_id || null;
  const { data: contact } = useContact(
    contactId,
    contactId !== null && selectedConversation !== undefined
  );

  // Apply customization styles
  useEffect(() => {
    getSettings('customization', {
      onSuccess: (data) => {
        if (data) {
          const {
            primary_color,
            primary_gradient,
            secondary_color,
            secondary_gradient,
            font_size,
            icon_size,
            position,
            bot_icon,
          } = data;
          document.documentElement.style.setProperty(
            '--primary-2',
            primary_color as unknown as string
          );
          document.documentElement.style.setProperty(
            '--primary-gradient',
            primary_gradient as unknown as string
          );
          document.documentElement.style.setProperty(
            '--secondary-2',
            secondary_color as unknown as string
          );
          document.documentElement.style.setProperty(
            '--secondary-gradient',
            secondary_gradient as unknown as string
          );
          document.documentElement.style.setProperty(
            '--font-size',
            font_size as unknown as string
          );
          document.documentElement.style.setProperty(
            '--icon-size',
            icon_size as unknown as string
          );
          document.documentElement.style.setProperty(
            '--position',
            position as unknown as string
          );
          document.documentElement.style.setProperty(
            '--bot-icon',
            bot_icon as unknown as string
          );
        }
      },
    });
  }, [getSettings]);

  // Reset sidebar state when conversation changes
  // Always start closed - user must click "Contact Details" to open
  useEffect(() => {
    setContactSidebarOpen(false);
  }, [selectedConversationId, selectedConversation]);

  // Update user typing status from messages data
  useEffect(() => {
    if (messagesData && 'is_user_typing' in messagesData) {
      setIsUserTyping(messagesData.is_user_typing === true);
    } else {
      setIsUserTyping(false);
    }
  }, [messagesData]);

  // Reset to page 1 when filters or viewMode changes
  useEffect(() => {
    setCurrentPage(1);
  }, [
    viewMode,
    filters.platform,
    filters.is_human_handoff,
    filters.search,
    filters.date_from,
    filters.date_to,
    filters.account_id,
    page,
    selectedChannels,
  ]);

  // Scroll to bottom when messages change or typing status changes
  useEffect(() => {
    if (messagesScrollAreaRef.current) {
      const viewport = messagesScrollAreaRef.current.querySelector(
        '[data-slot="scroll-area-viewport"]'
      ) as HTMLElement;
      if (viewport) {
        // Use requestAnimationFrame to ensure DOM is updated
        requestAnimationFrame(() => {
          viewport.scrollTo({
            top: viewport.scrollHeight,
            behavior: 'smooth',
          });
        });
      }
    }
  }, [messages, isUserTyping]);

  const getPlatformIcon = (platform: string, className = 'w-4 h-4') => {
    switch (platform) {
      case 'messenger':
        return (
          <Icon
            icon="ph:messenger-logo-light"
            className={cn(className, 'text-blue-500')}
          />
        );
      case 'instagram':
        return <Instagram className={cn(className, 'text-pink-500')} />;
      case 'fb_comment':
        return <Facebook className={cn(className, 'text-blue-600')} />;
      case 'ig_comment':
        return <Instagram className={cn(className, 'text-purple-500')} />;
      case 'whatsapp':
        return (
          <Icon
            icon="mdi:whatsapp"
            className={cn(className, 'text-green-500')}
          />
        );
      case 'website':
        return <MessageSquare className={cn(className, 'text-indigo-500')} />;
      case 'ticket':
        return <Ticket className={cn(className, 'text-orange-500')} />;
      default:
        return <MessageCircle className={className} />;
    }
  };

  const getPlatformLabel = (platform: string) => {
    switch (platform) {
      case 'messenger':
        return 'Messenger';
      case 'instagram':
        return 'Instagram DM';
      case 'fb_comment':
        return 'FB Comment';
      case 'ig_comment':
        return 'IG Comment';
      case 'whatsapp':
        return 'WhatsApp';
      case 'website':
        return 'Website';
      case 'ticket':
        return 'Ticket';
      default:
        return platform;
    }
  };

  // Helper function to get display name for conversation header
  // Prefers contact fields from conversation object (available immediately), then fetched contact, then participant_name
  // For tickets, shows subject
  const getConversationHeaderName = (
    conv: typeof selectedConversation,
    contactData: typeof contact
  ) => {
    if (!conv) return 'Unknown';

    // For tickets, prefer subject
    if (
      conv.platform === 'ticket' &&
      (conv as unknown as { subject: string }).subject
    ) {
      return (conv as unknown as { subject: string }).subject;
    }

    // Prefer contact name from conversation object (available immediately from JOIN)
    if (conv.contact_first_name || conv.contact_last_name) {
      const fullName = [conv.contact_first_name, conv.contact_last_name]
        .filter(Boolean)
        .join(' ');
      if (fullName) return fullName;
    }
    if (conv.contact_email) {
      return conv.contact_email;
    }

    const nameFallback =
      conv.platform === 'whatsapp' && conv.participant_id
        ? conv.participant_id
        : (conv.participant_name || 'Unknown');

    // Fallback to separately fetched contact object
    if (contactData) {
      const fullName = [contactData.first_name, contactData.last_name]
        .filter(Boolean)
        .join(' ');
      return fullName || contactData.email || nameFallback;
    }

    // Final fallback
    return nameFallback;
  };

  const getSenderIcon = (sentBy: string, userAvatar?: string) => {
    if (sentBy === 'human' && userAvatar) {
      return <img src={userAvatar} alt="" className="w-3 h-3 rounded-full" />;
    }
    switch (sentBy) {
      case 'customer':
        return <User className="w-3 h-3" />;
      case 'ai':
        return <Bot className="w-3 h-3" />;
      case 'human':
        return <UserCheck className="w-3 h-3" />;
      default:
        return null;
    }
  };

  const getSenderName = (message: SocialMessage) => {
    if (message.sent_by === 'human' && message.user_name) {
      return message.user_name;
    }
    return message.sent_by.charAt(0).toUpperCase() + message.sent_by.slice(1);
  };

  const handleSendReply = () => {
    if (!selectedConversationId || !replyText.trim()) return;

    // Clear typing indicator when sending message
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    sendReplyMutation.mutate(
      { conversationId: selectedConversationId, message: replyText },
      {
        onSuccess: () => {
          setReplyText('');
          if (showArchived && selectedConversation) {
            setPage(getInboxPageForPlatform(selectedConversation.platform));
          }
        },
      }
    );
  };

  const handleReplyTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setReplyText(e.target.value);

    // Send typing indicator with debouncing (only for website chats in handoff mode)
    // Send after user stops typing for 500ms
    if (selectedConversationId && selectedConversation?.is_human_handoff) {
      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Send typing status after 500ms of inactivity (debounce)
      typingTimeoutRef.current = setTimeout(() => {
        api
          .post(`/social/conversations/${selectedConversationId}/typing`)
          .catch(() => {
            // Silently fail
          });
      }, 500);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendReply();
    }
  };

  const handleCreateTicket = async (data: TicketFormData) => {
    try {
      let contactId = selectedContactId;

      // If checkbox is checked, create contact first
      if (data.createNewContact && data.email) {
        const nameParts = (data.name || '').trim().split(/\s+/);
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        const contactResult = await createContactMutation.mutateAsync({
          email: data.email,
          first_name: firstName,
          last_name: lastName,
          status: 'Subscribed',
        });

        if (contactResult?.contact_id) {
          contactId = contactResult.contact_id;
        }
      }

      // Get email from selected contact if contact is selected
      let email = data.email;
      if (selectedContact && !email) {
        email = selectedContact.email;
      }

      await createTicket.mutateAsync({
        subject: data.subject,
        message: data.message,
        email: email || '',
        name: data.name || '',
        priority: data.priority || 'normal',
        contact_id: contactId || undefined,
        skip_auto_create_contact: !contactId && !data.createNewContact,
      });

      form.reset();
      setIsCreateTicketOpen(false);
      setSelectedContactId(null);

      // Refresh conversations - the query will automatically refetch
    } catch {
      // Error handling is done in the mutation
    }
  };

  return (
    <PageGuard page={page}>
      <div className="relative flex h-full min-h-[600px]">
        {/* Conversation List */}
        <div
          className={cn(
            'flex overflow-hidden flex-col w-[320px] border-r',
            showProOverlay && 'opacity-50 cursor-not-allowed pointer-events-none'
          )}
        >
          <div className="flex-shrink-0 p-4 space-y-3 border-b">
            <div className="flex justify-between items-center">
              <h2 className="!text-lg !font-semibold !my-0 !mr-2">{showArchived ? 'Archived' : 'Inbox'}</h2>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreateTicketOpen(true)}
                >
                  <Plus className="w-4 h-4" />
                  Create Ticket
                </Button>
                <Popover
                  open={filterPopoverOpen}
                  onOpenChange={setFilterPopoverOpen}
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <PopoverTrigger asChild>
                        <Button
                          variant={filterPopoverOpen ? 'default' : 'outline'}
                          size="sm"
                          className="relative"
                        >
                          <Filter className="w-4 h-4" />
                          {(selectedChannels.length > 0 ||
                            filters.is_human_handoff !== undefined ||
                            filters.account_id !== undefined ||
                            filters.date_from ||
                            filters.date_to) && (
                            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                              {[
                                selectedChannels.length,
                                filters.is_human_handoff !== undefined ? 1 : 0,
                                filters.account_id !== undefined ? 1 : 0,
                                filters.date_from || filters.date_to ? 1 : 0,
                              ].reduce((a, b) => a + b, 0)}
                            </span>
                          )}
                        </Button>
                      </PopoverTrigger>
                    </TooltipTrigger>
                    <TooltipContent>Filter conversations</TooltipContent>
                  </Tooltip>
                  <PopoverContent className="w-80" align="end">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <h4 className="!font-medium !text-lg !my-0">Filters</h4>
                        {(selectedChannels.length > 0 ||
                          filters.is_human_handoff !== undefined ||
                          filters.account_id !== undefined ||
                          filters.date_from ||
                          filters.date_to) && (
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={() => {
                              setSelectedChannels([]);
                              setFilters((prev) => ({
                                ...prev,
                                is_human_handoff: undefined,
                                account_id: undefined,
                                date_from: '',
                                date_to: '',
                              }));
                              setDatePreset('');
                              setCustomDateFrom('');
                              setCustomDateTo('');
                            }}
                          >
                            Clear All
                          </Button>
                        )}
                      </div>

                      {/* Channels Filter */}
                      <div className="p-3 space-y-2 rounded-lg border border-border">
                        <div className="mb-2 text-sm font-medium">Channels</div>
                        <div className="space-y-2">
                          {[
                            { value: 'website', label: 'Website' },
                            { value: 'ticket', label: 'Tickets' },
                            { value: 'messenger', label: 'Messenger' },
                            { value: 'instagram', label: 'Instagram' },
                            { value: 'whatsapp', label: 'WhatsApp' },
                            { value: 'fb_comment', label: 'FB Comments' },
                            { value: 'ig_comment', label: 'IG Comments' },
                          ].map((channel) => (
                            <div
                              key={channel.value}
                              className="flex items-center space-x-2"
                            >
                              <Checkbox
                                id={`channel-${channel.value}`}
                                checked={selectedChannels.includes(
                                  channel.value
                                )}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedChannels([
                                      ...selectedChannels,
                                      channel.value,
                                    ]);
                                  } else {
                                    setSelectedChannels(
                                      selectedChannels.filter(
                                        (c) => c !== channel.value
                                      )
                                    );
                                  }
                                }}
                              />
                              <label
                                htmlFor={`channel-${channel.value}`}
                                className="text-sm font-normal cursor-pointer"
                              >
                                {channel.label}
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Date Range Filter */}
                      <div className="p-3 space-y-2 rounded-lg border border-border">
                        <div className="mb-2 text-sm font-medium">
                          Date Range
                        </div>
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-2">
                            {[
                              { value: '7d', label: 'Last 7 days' },
                              { value: '30d', label: 'Last 30 days' },
                              { value: '90d', label: 'Last 90 days' },
                              { value: 'this_month', label: 'This month' },
                              { value: 'last_month', label: 'Last month' },
                            ].map((preset) => (
                              <Button
                                key={preset.value}
                                variant={
                                  datePreset === preset.value
                                    ? 'default'
                                    : 'outline'
                                }
                                size="sm"
                                onClick={() => {
                                  setDatePreset(preset.value);
                                  const today = new Date();
                                  let from: Date,
                                    to: Date = today;

                                  if (preset.value === '7d') {
                                    from = new Date(
                                      today.getTime() - 7 * 24 * 60 * 60 * 1000
                                    );
                                  } else if (preset.value === '30d') {
                                    from = new Date(
                                      today.getTime() - 30 * 24 * 60 * 60 * 1000
                                    );
                                  } else if (preset.value === '90d') {
                                    from = new Date(
                                      today.getTime() - 90 * 24 * 60 * 60 * 1000
                                    );
                                  } else if (preset.value === 'this_month') {
                                    from = new Date(
                                      today.getFullYear(),
                                      today.getMonth(),
                                      1
                                    );
                                  } else if (preset.value === 'last_month') {
                                    from = new Date(
                                      today.getFullYear(),
                                      today.getMonth() - 1,
                                      1
                                    );
                                    to = new Date(
                                      today.getFullYear(),
                                      today.getMonth(),
                                      0
                                    );
                                  } else {
                                    from = today;
                                  }

                                  setFilters((prev) => ({
                                    ...prev,
                                    date_from: from.toISOString().split('T')[0],
                                    date_to: to.toISOString().split('T')[0],
                                  }));
                                  setCustomDateFrom('');
                                  setCustomDateTo('');
                                }}
                              >
                                {preset.label}
                              </Button>
                            ))}
                          </div>
                          <div className="space-y-2">
                            <div className="text-xs text-muted-foreground">
                              Custom Range
                            </div>
                            <div className="flex gap-2">
                              <Input
                                type="date"
                                placeholder="From"
                                value={customDateFrom}
                                onChange={(e) => {
                                  setCustomDateFrom(e.target.value);
                                  setDatePreset('');
                                  setFilters((prev) => ({
                                    ...prev,
                                    date_from: e.target.value,
                                  }));
                                }}
                                className="flex-1"
                              />
                              <Input
                                type="date"
                                placeholder="To"
                                value={customDateTo}
                                onChange={(e) => {
                                  setCustomDateTo(e.target.value);
                                  setDatePreset('');
                                  setFilters((prev) => ({
                                    ...prev,
                                    date_to: e.target.value,
                                  }));
                                }}
                                className="flex-1"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Handoff Status Filter */}
                      <div className="p-3 space-y-2 rounded-lg border border-border">
                        <div className="mb-2 text-sm font-medium">
                          Handoff Status
                        </div>
                        <Select
                          value={
                            filters.is_human_handoff === undefined
                              ? 'all'
                              : filters.is_human_handoff === 1
                              ? 'handoff'
                              : 'no_handoff'
                          }
                          onValueChange={(value) => {
                            setFilters((prev) => ({
                              ...prev,
                              is_human_handoff:
                                value === 'all'
                                  ? undefined
                                  : value === 'handoff'
                                  ? 1
                                  : 0,
                            }));
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            <SelectItem value="handoff">Handoff</SelectItem>
                            <SelectItem value="no_handoff">
                              No Handoff
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Account Filter */}
                      <div className="p-3 space-y-2 rounded-lg border border-border">
                        <div className="mb-2 text-sm font-medium">Account</div>
                        <Select
                          value={
                            filters.account_id === undefined
                              ? 'all'
                              : filters.account_id.toString()
                          }
                          onValueChange={(value) => {
                            setFilters((prev) => ({
                              ...prev,
                              account_id:
                                value === 'all'
                                  ? undefined
                                  : parseInt(value, 10),
                            }));
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Accounts</SelectItem>
                            {accounts.map((account) => (
                              <SelectItem
                                key={account.id}
                                value={account.id.toString()}
                              >
                                {account.page_name} ({account.platform})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            {/* Search Field */}
            <div>
              <Input
                placeholder="Search by name, email, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col flex-1 min-h-0">
            <div className="overflow-hidden flex-1 min-h-0">
              <ScrollArea className="h-full">
                {conversationsLoading ? (
                  <Loading />
                ) : conversations.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    <MessageCircle className="mx-auto mb-3 w-12 h-12 opacity-20" />
                    <p>{showArchived ? 'No archived conversations' : 'No conversations yet'}</p>
                  </div>
                ) : (
                  <div className="divide-y max-w-[350px]">
                    {conversations.map((conversation) => (
                      <ConversationItem
                        key={conversation.id}
                        conversation={conversation}
                        isSelected={selectedConversationId === conversation.id}
                        onClick={() =>
                          setSelectedConversationId(conversation.id)
                        }
                        getPlatformIcon={getPlatformIcon}
                        getPlatformLabel={getPlatformLabel}
                      />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
            {pagination && pagination.total_pages > 1 && (
              <div className="z-10 flex-shrink-0 p-2 border-t bg-background">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if (currentPage > 1) {
                            setCurrentPage(currentPage - 1);
                            e.currentTarget.blur();
                          }
                        }}
                        className={
                          currentPage === 1
                            ? 'pointer-events-none opacity-50'
                            : 'cursor-pointer'
                        }
                      />
                    </PaginationItem>
                    {currentPage > 2 && (
                      <>
                        <PaginationItem>
                          <PaginationLink
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              setCurrentPage(1);
                              e.currentTarget.blur();
                            }}
                            isActive={currentPage === 1}
                            className="cursor-pointer"
                          >
                            1
                          </PaginationLink>
                        </PaginationItem>
                        {currentPage > 3 && (
                          <PaginationItem>
                            <PaginationEllipsis />
                          </PaginationItem>
                        )}
                      </>
                    )}
                    {currentPage > 1 && (
                      <PaginationItem>
                        <PaginationLink
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            setCurrentPage(currentPage - 1);
                            e.currentTarget.blur();
                          }}
                          className="cursor-pointer"
                        >
                          {currentPage - 1}
                        </PaginationLink>
                      </PaginationItem>
                    )}
                    <PaginationItem>
                      <PaginationLink
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                        }}
                        isActive
                        className="cursor-default"
                      >
                        {currentPage}
                      </PaginationLink>
                    </PaginationItem>
                    {currentPage < pagination.total_pages && (
                      <PaginationItem>
                        <PaginationLink
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            setCurrentPage(currentPage + 1);
                            e.currentTarget.blur();
                          }}
                          className="cursor-pointer"
                        >
                          {currentPage + 1}
                        </PaginationLink>
                      </PaginationItem>
                    )}
                    {currentPage < pagination.total_pages - 1 && (
                      <>
                        {currentPage < pagination.total_pages - 2 && (
                          <PaginationItem>
                            <PaginationEllipsis />
                          </PaginationItem>
                        )}
                        <PaginationItem>
                          <PaginationLink
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              setCurrentPage(pagination.total_pages);
                              e.currentTarget.blur();
                            }}
                            isActive={currentPage === pagination.total_pages}
                            className="cursor-pointer"
                          >
                            {pagination.total_pages}
                          </PaginationLink>
                        </PaginationItem>
                      </>
                    )}
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if (currentPage < pagination.total_pages) {
                            setCurrentPage(currentPage + 1);
                            e.currentTarget.blur();
                          }
                        }}
                        className={
                          currentPage === pagination.total_pages
                            ? 'pointer-events-none opacity-50'
                            : 'cursor-pointer'
                        }
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </div>
        </div>

        {/* Messages Panel and Contact Sidebar Container */}
        <div
          className={cn(
            'flex overflow-hidden flex-1',
            showProOverlay && 'opacity-50 cursor-not-allowed pointer-events-none'
          )}
        >
          {/* Messages Panel */}
          <div className="relative flex overflow-hidden flex-col flex-1">
            {contactSidebarOpen && (
              <div
                className="absolute inset-0 z-10 bg-black/20 cursor-pointer"
                onClick={() => setContactSidebarOpen(false)}
                aria-hidden="true"
              />
            )}
            {!selectedConversation ? (
              <div className="flex flex-1 justify-center items-center text-muted-foreground">
                <div className="text-center">
                  <MessageCircle className="mx-auto mb-4 w-16 h-16 opacity-20" />
                  <p>Select a conversation to view messages</p>
                </div>
              </div>
            ) : (
              <>
                {/* Conversation Header */}
                <div className="flex flex-shrink-0 justify-between items-center p-4 border-b">
                  <div className="flex gap-3 items-center">
                    {/* Prefer contact avatar from conversation, then contact object, then participant profile pic */}
                    <div className="flex justify-center items-center w-10 h-10 bg-gray-200 rounded-full">
                      {selectedConversation.contact_avatar_url ? (
                        <img
                          src={selectedConversation.contact_avatar_url}
                          alt=""
                          className="w-10 h-10 rounded-full"
                        />
                      ) : contact?.avatar_url ? (
                        <img
                          src={contact.avatar_url}
                          alt=""
                          className="w-10 h-10 rounded-full"
                        />
                      ) : selectedConversation.participant_profile_pic ? (
                        <img
                          src={selectedConversation.participant_profile_pic}
                          alt=""
                          className="w-10 h-10 rounded-full"
                        />
                      ) : (
                        <User className="w-5 h-5 text-gray-500" />
                      )}
                    </div>
                    <div>
                      <div className="flex gap-2 items-center text-base font-medium">
                        {getConversationHeaderName(
                          selectedConversation,
                          contact || undefined
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <span className="flex gap-1 items-center text-xs">
                          {getPlatformIcon(selectedConversation.platform)}
                          {getPlatformLabel(selectedConversation.platform)}
                        </span>
                        {selectedConversation.account_name && (
                          <> · {selectedConversation.account_name}</>
                        )}
                        {participants.length > 0 && (
                          <div className="mt-1 text-xs">
                            <span className="text-muted-foreground">
                              Team members:{' '}
                            </span>
                            <span className="font-medium">
                              {participants.map((p) => p.first_name).join(', ')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 items-center">
                    {selectedConversation.platform === 'website' &&
                      reviews.length === 0 &&
                      !userEndedChat && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowEndChatConfirm(true)}
                          disabled={endChatMutation.isPending}
                          title="End chat and request review"
                        >
                          {endChatMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <X className="w-4 h-4" />
                          )}
                          End Chat
                        </Button>
                      )}
                    {contactId ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setContactSidebarOpen(!contactSidebarOpen)
                        }
                      >
                        <User className="w-4 h-4" />
                        Contact Details
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setContactSidebarOpen(true)}
                      >
                        <User className="w-4 h-4" />
                        Create Contact
                      </Button>
                    )}
                    {showArchived ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          updateStatusMutation.mutate({
                            conversationId: selectedConversation.id,
                            status: 'open',
                          })
                        }
                        disabled={updateStatusMutation.isPending}
                        title="Unarchive conversation"
                      >
                        <ArchiveRestore className="w-4 h-4" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowArchiveConfirm(true)}
                        disabled={
                          updateStatusMutation.isPending ||
                          endChatMutation.isPending
                        }
                        title="Archive conversation"
                      >
                        <Archive className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Messages */}
                <div ref={messagesScrollAreaRef} className="flex-1 min-h-0">
                  <ScrollArea className="h-full">
                    <div className="p-4">
                      {/* Post context for comments - scrolls with messages */}
                      {(selectedConversation.platform === 'fb_comment' ||
                        selectedConversation.platform === 'ig_comment') &&
                        (selectedConversation.post_image_url ||
                          selectedConversation.post_message) && (
                        <div className="-mx-4 px-4 py-3 mb-4 flex gap-3 items-start border-b bg-muted/30 -mt-4">
                          {selectedConversation.post_image_url && (
                            <img
                              src={selectedConversation.post_image_url}
                              alt="Post"
                              className="flex-shrink-0 w-16 h-16 object-cover rounded"
                            />
                          )}
                          {selectedConversation.post_message && (
                            <p className="flex-1 min-w-0 truncate line-clamp-2 text-sm text-muted-foreground">
                              {selectedConversation.post_message}
                            </p>
                          )}
                        </div>
                      )}
                      {messagesLoading ? (
                        <Loading />
                      ) : messages.length === 0 ? (
                        <div className="py-8 text-center text-muted-foreground">
                          No messages yet
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {messages.map((message, index) => {
                            // Handle system messages (join notifications)
                            if (
                              message.message_type === 'system' ||
                              message.sent_by === 'system' ||
                              message.system_event === 'team_member_joined'
                            ) {
                              const firstName =
                                message.system_data?.first_name ||
                                message.user_name ||
                                'Team member';
                              return (
                                <div
                                  key={message.id}
                                  className="flex justify-center items-center py-2"
                                >
                                  <div className="px-3 py-1.5 rounded-full bg-muted text-xs text-muted-foreground">
                                    {firstName} joined the conversation
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <InboxMessageBubble
                                key={message.id}
                                message={message}
                                messages={messages}
                                messageIndex={index}
                                conversationId={selectedConversation?.id ?? 0}
                                getSenderIcon={getSenderIcon}
                                getSenderName={getSenderName}
                                conversation={selectedConversation}
                                onEdit={(messageId, newContent) => {
                                  editCommentMutation.mutate({
                                    messageId,
                                    content: newContent,
                                  });
                                }}
                                onDelete={(messageId) => {
                                  if (
                                    confirm(
                                      'Are you sure you want to delete this comment reply?'
                                    )
                                  ) {
                                    deleteCommentMutation.mutate(messageId);
                                  }
                                }}
                              />
                            );
                          })}
                          {/* Display reviews */}
                          {reviews.map((review) => (
                            <div
                              key={review.id}
                              className="flex gap-2 items-start"
                            >
                              <div className="max-w-[70%] rounded-lg px-3 py-3 bg-yellow-50 border border-yellow-200">
                                <div className="flex gap-1 items-center mb-2">
                                  {[1, 2, 3, 4, 5].map((star) => (
                                    <Star
                                      key={star}
                                      size={16}
                                      className={
                                        star <= review.rating
                                          ? 'fill-yellow-400 text-yellow-400'
                                          : 'fill-gray-200 text-gray-200'
                                      }
                                    />
                                  ))}
                                  <span className="ml-2 text-sm font-medium text-gray-700">
                                    {review.rating}/5
                                  </span>
                                </div>
                                {review.message && (
                                  <p className="mb-1 text-sm text-gray-700">
                                    {review.message}
                                  </p>
                                )}
                                <div className="flex gap-1 items-center text-xs text-gray-500">
                                  {getSenderIcon('customer')}
                                  <span>Customer</span>
                                  <span>·</span>
                                  <span>
                                    {formatDistanceToNow(
                                      parseUTCDate(review.created_at),
                                      { addSuffix: true }
                                    )}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                          {isUserTyping &&
                            selectedConversation?.platform === 'website' && (
                              <div className="flex gap-2 items-start">
                                <div className="flex-shrink-0">
                                  {getSenderIcon('customer')}
                                </div>
                                <div className="max-w-[70%] rounded-lg px-3 py-2 bg-gray-100">
                                  <div className="flex items-center space-x-2">
                                    <div
                                      className="w-2 h-2 rounded-full animate-bounce bg-slate-400"
                                      style={{ animationDelay: '0ms' }}
                                    />
                                    <div
                                      className="w-2 h-2 rounded-full animate-bounce bg-slate-400"
                                      style={{ animationDelay: '150ms' }}
                                    />
                                    <div
                                      className="w-2 h-2 rounded-full animate-bounce bg-slate-400"
                                      style={{ animationDelay: '300ms' }}
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                          <div ref={messagesEndRef} />
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </div>

                {/* Reply Input */}
                {!chatEnded && (
                <div className="flex-shrink-0 p-4 border-t">
                  {isReplyProBlocked && (
                    <ProBadgeInput
                      message="Upgrade to Pro to reply manually."
                      className="mb-3"
                    />
                  )}
                  <div
                    className={cn(
                      'flex gap-2',
                      isReplyProBlocked && 'opacity-50 pointer-events-none'
                    )}
                  >
                    <Input
                      placeholder="Type your reply..."
                      value={replyText}
                      onChange={handleReplyTextChange}
                      onKeyPress={handleKeyPress}
                      disabled={
                        isReplyProBlocked || sendReplyMutation.isPending
                      }
                    />
                    <Button
                      onClick={handleSendReply}
                      disabled={
                        isReplyProBlocked ||
                        !replyText.trim() ||
                        sendReplyMutation.isPending
                      }
                    >
                      {sendReplyMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  {selectedConversation.platform !== 'ticket' && (selectedConversation.platform !== 'website' || aiEnabled) && (
                    <div
                      className={cn(
                        'flex justify-between items-center mt-2',
                        isReplyProBlocked && 'opacity-50 pointer-events-none'
                      )}
                    >
                      {selectedConversation.is_human_handoff ? (
                        <p className="text-xs text-muted-foreground !my-0">
                          Human handoff is active. Your reply will be sent
                          directly to the customer.
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground !my-0">
                          AI Mode is active. Your reply will disable AI and
                          switch to Human Mode.
                        </p>
                      )}
                      <div className="flex gap-2 items-center">
                        <span className="text-xs text-muted-foreground">
                          AI
                        </span>
                        <Switch
                          checked={selectedConversation.is_human_handoff}
                          onCheckedChange={(checked) =>
                            toggleHandoffMutation.mutate({
                              conversationId: selectedConversation.id,
                              handoff: checked,
                            })
                          }
                          disabled={
                            isReplyProBlocked || toggleHandoffMutation.isPending
                          }
                        />
                        <span className="text-xs text-muted-foreground">
                          Human
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                )}
              </>
            )}
            {selectedConversation && contactSidebarOpen && (
              <div className="absolute right-0 top-0 bottom-0 z-20">
                <ContactSidebar
                  conversation={selectedConversation}
                  open={contactSidebarOpen}
                  onOpenChange={setContactSidebarOpen}
                />
              </div>
            )}
          </div>
        </div>
        {showProOverlay && (
          <ProBadge
            className="z-20"
            topMessage={
              page === 'inbox-live-chat'
                ? 'Upgrade to Pro to reply manually and manage live chat conversations.'
                : 'Connect Facebook and Instagram to manage social messages and comments in one place.'
            }
            buttonText={
              page === 'inbox-live-chat' ? 'Unlock Live Chat' : 'Unlock Social Messages'
            }
          />
        )}
      </div>

      {/* Create Ticket Sheet */}
      <Sheet
        open={isCreateTicketOpen}
        onOpenChange={(open) => {
          setIsCreateTicketOpen(open);
          if (!open) {
            setSelectedContactId(null);
            form.reset();
          }
        }}
      >
        <SheetContent className="sm:!max-w-2xl flex flex-col h-full gap-0 overflow-hidden">
          <SheetHeader className="pb-4 mt-6 border-b">
            <SheetTitle className="text-lg font-bold !my-0">
              Create New Ticket
            </SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto flex-1 p-4 pt-6">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(handleCreateTicket)}
                className="space-y-6"
              >
                <FormField
                  control={form.control}
                  name="subject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subject</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter ticket subject" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {!selectedContactId && (
                  <>
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="customer@example.com"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="createNewContact"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>
                              Create new contact with this email
                            </FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />
                  </>
                )}

                {/* <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Customer name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                /> */}

                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select priority" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-2">
                  <FormLabel>Contact (Optional)</FormLabel>
                  <Popover
                    open={contactPopoverOpen}
                    onOpenChange={setContactPopoverOpen}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="justify-between w-full"
                      >
                        {selectedContact
                          ? `${selectedContact.email} (${selectedContact.first_name} ${selectedContact.last_name})`
                          : 'Select contact...'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 w-full">
                      <Command>
                        <CommandInput
                          placeholder="Search contacts..."
                          value={contactSearch}
                          onValueChange={setContactSearch}
                        />
                        <CommandEmpty>No contacts found.</CommandEmpty>
                        <CommandGroup className="overflow-y-auto max-h-64">
                          <CommandItem
                            onSelect={() => {
                              setSelectedContactId(null);
                              setContactPopoverOpen(false);
                            }}
                          >
                            <Checkbox
                              checked={selectedContactId === null}
                              className="mr-2"
                            />
                            No contact
                          </CommandItem>
                          {contacts.map((contact) => (
                            <CommandItem
                              key={contact.id}
                              onSelect={() => {
                                setSelectedContactId(contact.id);
                                setContactPopoverOpen(false);
                              }}
                            >
                              <Checkbox
                                checked={selectedContactId === contact.id}
                                className="mr-2"
                              />
                              {contact.email} ({contact.first_name}{' '}
                              {contact.last_name})
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <FormField
                  control={form.control}
                  name="message"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Message</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter ticket message"
                          rows={6}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateTicketOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createTicket.isPending}>
                    {createTicket.isPending ? 'Creating...' : 'Create Ticket'}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </SheetContent>
      </Sheet>

      {/* End chat confirmation dialog */}
      <Dialog open={showEndChatConfirm} onOpenChange={setShowEndChatConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>End this chat?</DialogTitle>
            <DialogDescription>
              The user will be asked to rate their experience.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEndChatConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (selectedConversation) {
                  endChatMutation.mutate(selectedConversation.id);
                  setShowEndChatConfirm(false);
                }
              }}
              disabled={endChatMutation.isPending}
            >
              End chat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive confirmation dialog */}
      <Dialog open={showArchiveConfirm} onOpenChange={setShowArchiveConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Archive this conversation?</DialogTitle>
            <DialogDescription>
              {selectedConversation?.platform === 'website'
                ? "The user will be asked to rate their experience."
                : "The conversation will be moved to Archived."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowArchiveConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedConversation) {
                  updateStatusMutation.mutate({
                    conversationId: selectedConversation.id,
                    status: 'archived',
                  });
                  endChatMutation.mutate(selectedConversation.id);
                  setShowArchiveConfirm(false);
                }
              }}
              disabled={
                updateStatusMutation.isPending || endChatMutation.isPending
              }
            >
              Archive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageGuard>
  );
}

interface ConversationItemProps {
  conversation: SocialConversation;
  isSelected: boolean;
  onClick: () => void;
  getPlatformIcon: (platform: string, className?: string) => React.ReactNode;
  getPlatformLabel: (platform: string) => string;
}

function ConversationItem({
  conversation,
  isSelected,
  onClick,
  getPlatformIcon,
  getPlatformLabel,
}: ConversationItemProps) {
  // const isComment =
  //   conversation.platform === 'fb_comment' ||
  //   conversation.platform === 'ig_comment';

  // Helper function to get display name from contact info or fallback to participant_name
  // For tickets, show subject if available
  const getDisplayName = () => {
    // For tickets, prefer subject
    if (
      conversation.platform === 'ticket' &&
      (conversation as unknown as { subject: string }).subject
    ) {
      return (conversation as unknown as { subject: string }).subject;
    }
    if (conversation.contact_first_name || conversation.contact_last_name) {
      const fullName = [
        conversation.contact_first_name,
        conversation.contact_last_name,
      ]
        .filter(Boolean)
        .join(' ');
      if (fullName) return fullName;
    }
    if (conversation.contact_email) {
      return conversation.contact_email;
    }
    if (
      conversation.platform === 'whatsapp' &&
      conversation.participant_id &&
      !conversation.participant_name
    ) {
      return conversation.participant_id;
    }
    return conversation.participant_name || 'Unknown';
  };

  // Prefer contact avatar over participant profile pic
  const avatarUrl =
    conversation.contact_avatar_url || conversation.participant_profile_pic;

  const isUnread = conversation.unread_count > 0;

  return (
    <div
      className={cn(
        'p-2 transition-colors cursor-pointer',
        isSelected
          ? 'bg-primary/5 hover:bg-primary/10'
          : isUnread
          ? 'bg-blue-50 hover:bg-blue-100'
          : 'hover:bg-gray-50'
      )}
      onClick={onClick}
    >
      <div className="flex gap-3 items-center">
        <div className="relative">
          <div className="flex justify-center items-center w-10 h-10 bg-gray-200 rounded-full">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-10 h-10 rounded-full" />
            ) : (
              <User className="w-5 h-5 text-gray-500" />
            )}
          </div>
          {conversation.unread_count > 0 && (
            <span className="flex absolute -top-1 -right-1 justify-center items-center w-5 h-5 text-xs text-white rounded-full bg-primary">
              {conversation.unread_count}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-center mb-1">
            <span className="font-medium truncate max-w-[120px] mr-2">{getDisplayName()}</span>
            <div className="flex flex-col items-end">
              <span className="text-xs text-muted-foreground">
                {conversation.last_message_at
                  ? formatDistanceToNow(
                      parseUTCDate(conversation.last_message_at),
                      {
                        addSuffix: true,
                      }
                    )
                  : ''}
              </span>
            </div>
          </div>
          <div className="flex gap-2 justify-between items-center">
            <div className="flex gap-1 items-center text-xs text-muted-foreground">
              {getPlatformIcon(conversation.platform, 'w-3 h-3')}
              <span className="truncate">
                {conversation.account_name ||
                  getPlatformLabel(conversation.platform)}
              </span>
            </div>
            {conversation.is_human_handoff &&
              conversation.platform !== 'ticket' && (
                <Badge
                  variant="outline"
                  className="px-1 py-0 text-xs text-amber-700 bg-amber-50 border-amber-200 mt-0.5"
                >
                  <UserCheck className="w-2.5 h-2.5 mr-0.5" /> Human
                </Badge>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}

