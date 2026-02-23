'use client';

import { AppointmentForm } from '@/components/AppointmentForm';
import { ChatHeader } from '@/components/chat/ChatHeader';
import { ChatInput } from '@/components/chat/ChatInput';
import { ChatMessages } from '@/components/chat/ChatMessages';
import { ChatToggleButton } from '@/components/chat/ChatToggleButton';
import { ReviewForm } from '@/components/chat/ReviewForm';
import LeadCollection from '@/components/LeadCollection';
import { WelcomeMessagePopup } from '@/components/WelcomeMessagePopup';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useTheme } from '@/context/ThemeContext';
import { useAi } from '@/hooks/useAi';
import { useSettings } from '@/hooks/useSettings';
import api from '@/lib/axios';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/types';
import { isWithinBusinessHours } from '@/utils/businessHours';
import {
  clearStoredMessages,
  getStoredMessages,
  storeMessages,
} from '@/utils/message-storage';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// Helper function for sorting messages by ID
const sortMessages = (messages: ChatMessage[]) => {
  return messages.sort((a, b) => {
    const aId = a.id.startsWith('temp_') ? Number.MAX_SAFE_INTEGER : parseInt(a.id, 10);
    const bId = b.id.startsWith('temp_') ? Number.MAX_SAFE_INTEGER : parseInt(b.id, 10);
    return aId - bId;
  });
};

function buildAssistantMessage(
  msg: {
    id: number;
    message: string;
    role: string;
    timestamp: number | string;
    metadata?: Record<string, unknown>;
  },
  existing: ChatMessage | undefined
): ChatMessage {
  let content = msg.message;
  let parsedContent: { text?: string; type?: string; data?: unknown; links?: unknown } | null = null;
  try {
    parsedContent = typeof content === 'string' ? JSON.parse(content) : content;
    content = parsedContent?.text || content;
  } catch { /* no-op */ }

  const hasToolData = existing?.role === 'assistant' && existing?.type && existing?.type !== 'text';
  const mergedType =
    parsedContent?.type && parsedContent.type !== 'text'
      ? parsedContent.type
      : (hasToolData ? existing!.type : parsedContent?.type) || 'text';
  const mergedData =
    parsedContent?.data != null ? parsedContent.data : hasToolData ? existing!.data : undefined;
  const mergedLinks = parsedContent?.links ?? (hasToolData ? existing?.links : undefined);

  return {
    id: String(msg.id),
    role: 'assistant',
    content,
    type: mergedType as ChatMessage['type'],
    data: mergedData as ChatMessage['data'],
    links: mergedLinks as ChatMessage['links'],
    createdAt: new Date(
      typeof msg.timestamp === 'string' ? parseInt(msg.timestamp, 10) * 1000 : msg.timestamp * 1000
    ),
    avatarUrl: msg.metadata?.user_avatar as string | undefined,
  };
}

export default function ChatBot() {
  const { icon_shape } = useTheme();
  const [messages, setMessages] = useState<ChatMessage[]>(getStoredMessages());
  const [input, setInput] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [productId, setProductId] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [hasStartedConversation, setHasStartedConversation] = useState(false);
  const [sessionId, setSessionId] = useState(() => localStorage.getItem('chat_session') || '');
  const [collectLead, setCollectLead] = useState(
    localStorage.getItem('lead_collected') === 'true'
  );
  const [lastMessageCount, setLastMessageCount] = useState(0);
  const [hasAudioPermission, setHasAudioPermission] = useState(false);
  const [showWelcomePopup, setShowWelcomePopup] = useState(false);
  const [isProactiveSalesVisible, setIsProactiveSalesVisible] = useState(false);
  const [isExitIntentVisible, setIsExitIntentVisible] = useState(false);
  const [isHumanHandoff, setIsHumanHandoff] = useState(false);
  const [isAdminTyping, setIsAdminTyping] = useState(false);
  const [adminTypingAvatar, setAdminTypingAvatar] = useState<string | null>(null);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [showAppointmentDialog, setShowAppointmentDialog] = useState(false);
  const [showEndChatConfirm, setShowEndChatConfirm] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { getResponseMutation, endChatMutation, submitReviewMutation } = useAi();
  const { mutateAsync: getResponse, isPending: isResponseLoading } =
    getResponseMutation;
  const { getSettingsQuery } = useSettings();
  const { data: settings } = getSettingsQuery;

  const apiActive = settings?.api;
  const chatbotActive = settings?.modules?.chatbot;
  const coupon = settings?.settings?.exit_intent_coupon;

  const businessHoursEnabled = settings?.settings?.business_hours_enabled ?? false;
  const businessHours = settings?.settings?.business_hours;
  const businessHoursTimezone = settings?.settings?.business_hours_timezone ?? '';
  const isLiveAgentsAvailable = useMemo(
    () =>
      (settings?.is_pro ?? false) &&
      (!businessHoursEnabled ||
        (!!businessHours &&
          isWithinBusinessHours(businessHours, businessHoursTimezone || undefined))),
    [
      settings?.is_pro,
      businessHoursEnabled,
      businessHours,
      businessHoursTimezone,
    ]
  );

  // Memoize expensive computations
  const collectLeadSettings = useMemo(
    () => settings?.settings?.collect_lead,
    [settings?.settings?.collect_lead]
  );

  const notificationSound = useMemo(() => {
    if (settings?.customization?.sound_effect !== 'none') {
      return new Audio(
        `${window.helpmateApiSettings?.site_url}/wp-content/plugins/helpmate-ai-chatbot/public/sounds/${settings?.customization?.sound_effect}`
      );
    }
    return null;
  }, [settings?.customization?.sound_effect]);

  // Request audio permission on first user interaction
  useEffect(() => {
    const handleUserInteraction = async () => {
      if (notificationSound && !hasAudioPermission) {
        try {
          await notificationSound.play();
          notificationSound.pause();
          setHasAudioPermission(true);
        } catch (error) {
          // Silently handle the error - we'll try again on next interaction
          console.error('Error playing notification sound:', error);
        }
      }
    };

    document.addEventListener('click', handleUserInteraction, { once: true });
    document.addEventListener('keydown', handleUserInteraction, { once: true });

    return () => {
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
    };
  }, [notificationSound, hasAudioPermission]);

  // Load messages from storage on mount
  useEffect(() => {
    const storedMessages = getStoredMessages();
    if (storedMessages.length > 0) {
      setMessages(storedMessages);
      setHasStartedConversation(true);
    } else {
      // Add welcome messages as assistant messages if no conversation exists
      const welcomeMessages = settings?.settings?.welcome_message;
      if (welcomeMessages && welcomeMessages.length > 0) {
        const welcomeChatMessages: ChatMessage[] = welcomeMessages.map(
          (message, index) => ({
            id: `welcome_${index}`,
            role: 'assistant',
            content: message,
            type: 'text',
            createdAt: new Date(),
          })
        );
        setMessages(welcomeChatMessages);
      }
    }
    setLastMessageCount(storedMessages.length);
  }, [settings?.settings?.welcome_message]);

  // SSE stream for live updates (messages, handoff, ai_disabled, admin_typing, review_requested)
  useEffect(() => {
    if (!isChatOpen || !sessionId) return;

    const nonce = window.helpmateApiSettings?.nonce || '';
    if (!nonce) return;

    const base =
      `${window.helpmateApiSettings?.site_url || window.location.origin}/?rest_route=/helpmate/v1`;

    // One-time sync of current history and state when opening stream
    const syncOnce = async () => {
      try {
        const res = await api.post('/chat/history', { session_id: sessionId });
        if (res.data?.error) return;

        setIsHumanHandoff(
          res.data.is_human_handoff === true || res.data.ai_disabled === true
        );
        setIsAdminTyping(res.data.is_admin_typing === true);
        setAdminTypingAvatar(res.data.typing_user_avatar || null);

        const history = res.data.history || [];

        // Build map of messages (merge new with existing)
        setMessages(prevMessages => {
          const messageMap = new Map<string, ChatMessage>();

          // Keep existing messages
          prevMessages.forEach(msg => messageMap.set(msg.id, msg));

          // Merge in history messages
          history.forEach((msg: {
            id: number;
            message: string;
            role: string;
            timestamp: number | string;
            metadata?: {
              system_event?: string;
              user_id?: number;
              first_name?: string;
              user_avatar?: string;
              [key: string]: unknown;
            };
          }) => {
            const metadata = msg.metadata || {};

            if (msg.role === 'system') {
              messageMap.set(msg.id.toString(), {
                id: msg.id.toString(),
                role: 'system',
                content: msg.message,
                type: 'system',
                systemEvent: metadata.system_event,
                systemData: {
                  user_id: metadata.user_id,
                  first_name: metadata.first_name,
                },
                avatarUrl: metadata.user_avatar,
                createdAt: new Date(
                  typeof msg.timestamp === 'string'
                    ? parseInt(msg.timestamp, 10) * 1000
                    : msg.timestamp * 1000
                ),
              });
            } else if (msg.role === 'assistant') {
              const existing = messageMap.get(msg.id.toString());
              messageMap.set(
                msg.id.toString(),
                buildAssistantMessage({ ...msg, metadata }, existing)
              );
            } else {
              messageMap.set(msg.id.toString(), {
                id: msg.id.toString(),
                role: 'user',
                content: msg.message,
                imageUrl: (metadata.image_url ?? metadata.imageUrl) as string | undefined,
                createdAt: new Date(
                  typeof msg.timestamp === 'string'
                    ? parseInt(msg.timestamp, 10) * 1000
                    : msg.timestamp * 1000
                ),
                avatarUrl: metadata.user_avatar,
              });
            }
          });

          return sortMessages(Array.from(messageMap.values()));
        });
      } catch {/**/}
    };

    syncOnce();

    // Short polling: avoids holding a PHP worker (no long-lived SSE), so other requests (history, send, etc.) can complete
    const pollUrl = `${base}/chat/poll&session_id=${encodeURIComponent(sessionId)}&_wpnonce=${encodeURIComponent(nonce)}`;
    const applyEvent = (type: string, data: Record<string, unknown>) => {
      if (type === 'message') {
        const msg = data as {
          id: number;
          message: string;
          role: string;
          timestamp: number;
          metadata?: {
            system_event?: string;
            user_id?: number;
            first_name?: string;
            user_avatar?: string;
            [key: string]: unknown;
          };
        };

        const metadata = msg.metadata || {};

        setMessages((prev) => {
          const messageMap = new Map(prev.map(m => [m.id, m]));
          let chatMsg: ChatMessage;

          if (msg.role === 'system') {
            chatMsg = {
              id: String(msg.id),
              role: 'system',
              content: msg.message,
              type: 'system',
              systemEvent: metadata.system_event,
              systemData: {
                user_id: metadata.user_id,
                first_name: metadata.first_name,
              },
              avatarUrl: metadata.user_avatar,
              createdAt: new Date(msg.timestamp * 1000),
            };
          } else if (msg.role === 'assistant') {
            const existing = messageMap.get(String(msg.id));
            chatMsg = buildAssistantMessage(
              { ...msg, metadata, timestamp: msg.timestamp },
              existing
            );
          } else {
            chatMsg = {
              id: String(msg.id),
              role: 'user',
              content: msg.message,
              imageUrl: (metadata.image_url ?? metadata.imageUrl) as string | undefined,
              createdAt: new Date(msg.timestamp * 1000),
              avatarUrl: metadata.user_avatar,
            };
          }

          messageMap.set(chatMsg.id, chatMsg);
          return sortMessages(Array.from(messageMap.values()));
        });

        return msg.id;
      }
      if (type === 'handoff') setIsHumanHandoff((data as { is_human_handoff?: boolean }).is_human_handoff === true);
      if (type === 'ai_disabled') setIsHumanHandoff((prev) => prev || (data as { ai_disabled?: boolean }).ai_disabled === true);
      if (type === 'admin_typing') {
        const typingData = data as { is_admin_typing?: boolean; user_avatar?: string | null };
        setIsAdminTyping(typingData.is_admin_typing === true);
        setAdminTypingAvatar(typingData.user_avatar || null);
      }
      if (type === 'review_requested') setShowReviewForm(true);
      return 0;
    };

    const stateRef = { lastId: 0, lastHandoff: null as boolean | null, lastAiDisabled: null as boolean | null, lastAdminTyping: null as boolean | null, lastReview: null as boolean | null };
    const tick = async () => {
      try {
        const params = new URLSearchParams({
          last_id: String(stateRef.lastId),
          ...(stateRef.lastHandoff !== null && { last_handoff: String(stateRef.lastHandoff) }),
          ...(stateRef.lastAiDisabled !== null && { last_ai_disabled: String(stateRef.lastAiDisabled) }),
          ...(stateRef.lastAdminTyping !== null && { last_admin_typing: String(stateRef.lastAdminTyping) }),
          ...(stateRef.lastReview !== null && { last_review: String(stateRef.lastReview) }),
        });
        const res = await fetch(`${pollUrl}&${params.toString()}`);
        const json = (await res.json()) as { events?: Array<{ type: string; data: Record<string, unknown> }> };
        const events = json?.events || [];
        for (const ev of events) {
          if (ev.type === 'heartbeat') continue;
          const id = applyEvent(ev.type, ev.data || {});
          if (id && ev.type === 'message') stateRef.lastId = Math.max(stateRef.lastId, id);
          if (ev.type === 'handoff') stateRef.lastHandoff = (ev.data as { is_human_handoff?: boolean }).is_human_handoff ?? null;
          if (ev.type === 'ai_disabled') stateRef.lastAiDisabled = (ev.data as { ai_disabled?: boolean }).ai_disabled ?? null;
          if (ev.type === 'admin_typing') stateRef.lastAdminTyping = (ev.data as { is_admin_typing?: boolean }).is_admin_typing ?? null;
          if (ev.type === 'review_requested') stateRef.lastReview = true;
        }
      } catch {
        /**/
      }
    };

    // Poll for live updates (admin messages, handoff, typing, review_requested)
    // Always poll when session exists so review_requested reaches user when admin ends chat
    tick();
    const interval = setInterval(tick, 1500);
    return () => clearInterval(interval);
  }, [isChatOpen, sessionId]);

  // Show welcome popup on first load
  useEffect(() => {
    const hasSeenWelcome = sessionStorage.getItem('welcome_popup_shown');
    if (!hasSeenWelcome && settings?.settings?.welcome_message?.length > 0) {
      // Delay to ensure the page is fully loaded
      const timer = setTimeout(() => {
        setShowWelcomePopup(true);
        if (
          notificationSound &&
          hasAudioPermission &&
          settings?.settings?.welcome_message_sound
        ) {
          notificationSound.play().catch(() => {
            // Silently handle the error
          });
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [
    settings?.settings?.welcome_message,
    settings?.settings?.welcome_message_sound,
    notificationSound,
    hasAudioPermission,
  ]);

  // Listen for other popups to hide welcome popup
  useEffect(() => {
    if (!coupon) return;
    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0) {
        // Exit intent detected - hide welcome popup
        setShowWelcomePopup(false);
        setIsExitIntentVisible(true);
        // Reset exit intent visibility after animation
        setTimeout(() => {
          setIsExitIntentVisible(false);
        }, 1000);
      }
    };

    document.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [coupon]);

  // Hide welcome popup when proactive sales is active
  useEffect(() => {
    if (
      settings?.modules?.['proactive-sales'] &&
      settings?.proactive_sales_products?.length > 0
    ) {
      const proactiveSalesDelay =
        (settings.settings.proactive_sales_show_frequency as number) *
        60 *
        1000;

      const timer = setTimeout(() => {
        setShowWelcomePopup(false);
        sessionStorage.setItem('welcome_popup_shown', 'true');
        setIsProactiveSalesVisible(true);
        // Reset proactive sales visibility after animation
        setTimeout(() => {
          setIsProactiveSalesVisible(false);
        }, 1000);
      }, proactiveSalesDelay);

      return () => clearTimeout(timer);
    }
  }, [
    settings?.modules,
    settings?.proactive_sales_products,
    settings?.settings?.proactive_sales_show_frequency,
  ]);

  // Store messages whenever they change
  useEffect(() => {
    storeMessages(messages);
  }, [messages]);

  // Check if conversation has started whenever messages change
  useEffect(() => {
    // Check if there are any user messages (not just welcome messages)
    const hasUserMessages = messages.some((message) => message.role === 'user');
    if (hasUserMessages && !hasStartedConversation) {
      setHasStartedConversation(true);
    }
  }, [messages, hasStartedConversation]);

  // Play notification sound on every AI response
  useEffect(() => {
    if (
      messages.length > lastMessageCount &&
      notificationSound &&
      hasAudioPermission
    ) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'assistant' && notificationSound.src) {
        notificationSound.play().catch(() => {
          // Silently handle the error
        });
      }
      setLastMessageCount(messages.length);
    }
  }, [messages, lastMessageCount, notificationSound, hasAudioPermission]);

  // Memoize handlers to prevent unnecessary re-renders
  const toggleChat = useCallback(() => {
    setIsChatOpen(!isChatOpen);
    // Hide welcome popup when chat is opened
    if (!isChatOpen) {
      setShowWelcomePopup(false);
      sessionStorage.setItem('welcome_popup_shown', 'true');
    }
  }, [isChatOpen]);

  // Reset chat conversation
  const resetChat = useCallback(() => {
    setMessages([]);
    setSessionId('');
    setProductId('');
    setImage(null);
    setHasStartedConversation(false);
    setShowReviewForm(false);
    clearStoredMessages();
    localStorage.removeItem('chat_session');
  }, []);

  // Perform delete chat (end chat API → review form) - called from confirmation dialog
  const handleConfirmDelete = useCallback(async () => {
    const sid = localStorage.getItem('chat_session');
    if (sid) {
      try {
        await endChatMutation.mutateAsync({ session_id: sid });
      } catch {
        // Still show review form even if API call fails
      }
    }
    setMessages([]);
    clearStoredMessages();
    setShowReviewForm(true);
    setShowEndChatConfirm(false);
  }, [endChatMutation]);

  // Handle review skip (dismiss without submitting)
  const handleReviewSkip = useCallback(() => {
    resetChat();
  }, [resetChat]);

  // Handle review submit
  const handleReviewSubmit = useCallback(
    async (rating: number, message: string) => {
      const sessionId = localStorage.getItem('chat_session') || '';
      try {
        await submitReviewMutation.mutateAsync({
          session_id: sessionId,
          rating,
          message,
        });
        // Reset chat after review submission
        resetChat();
      } catch (error) {
        console.error('Failed to submit review:', error);
        // Still reset chat even if review submission fails
        resetChat();
      }
    },
    [submitReviewMutation, resetChat]
  );

  // Handle input change - optimized to prevent performance issues
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(e.target.value);

      // Send typing indicator with debouncing (only send after user stops typing for 500ms)
      const sessionId = localStorage.getItem('chat_session');
      if (sessionId && hasStartedConversation) {
        // Clear existing timeout
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }

        // Send typing status after 500ms of inactivity (debounce)
        typingTimeoutRef.current = setTimeout(() => {
          api.post('/chat/typing', { session_id: sessionId }).catch(() => {
            // Silently fail
          });
        }, 500);
      }
    },
    [hasStartedConversation]
  );

  const handleOpenChat = useCallback((id: number) => {
    setProductId(id.toString());
    setIsChatOpen(true);
  }, []);

  // Handle image change
  const handleImageChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        setImage(file);
      } else {
        setImage(null);
      }
    },
    []
  );

  const handleProductIdChange = useCallback(() => {
    setProductId('');
  }, []);

  // Handle quick option selection
  const handleQuickOptionClick = useCallback((message: string) => {
    sendMessage(message);
  }, []);

  // Handle welcome popup close
  const handleWelcomePopupClose = useCallback(() => {
    setShowWelcomePopup(false);
    sessionStorage.setItem('welcome_popup_shown', 'true');
  }, []);

  // Send a message and get a response
  const sendMessage = useCallback(
    async (
      messageText: string,
      imageUrl: string = '',
      productId: string = ''
    ) => {
      // imageUrl =
      //   'https://woocommercecore.mystagingwebsite.com/wp-content/uploads/2017/12/belt-2.jpg';

      // Add user message with temporary ID
      const userMessage: ChatMessage = {
        id: 'temp_' + Date.now().toString(),
        role: 'user',
        content: messageText,
        imageUrl: imageUrl,
        createdAt: new Date(),
      };

      setMessages((prevMessages) => [...prevMessages, userMessage]);

      const response = await getResponse({
        message: messageText,
        image_url: imageUrl,
        product_id: productId,
      });

      // NEW: Update session state so poll effect can start
      const newSessionId = localStorage.getItem('chat_session') || '';
      if (newSessionId && newSessionId !== sessionId) {
        setSessionId(newSessionId);
      }

      if (!response) {
        console.error('No response from AI');
        return;
      }

      // Update the user message with the actual ID from the response
      setMessages((prevMessages) => {
        const { reply, message_ids } = response;
        const handoff_active = response.handoff_active ?? false;
        const ai_disabled = response.ai_disabled ?? false;

        // Update handoff status
        setIsHumanHandoff(handoff_active || ai_disabled);

        const messageMap = new Map(prevMessages.map(m => [m.id, m]));

        // Replace temp user message with real ID
        const tempUserMsg = messageMap.get(userMessage.id);
        if (tempUserMsg) {
          messageMap.delete(userMessage.id);
          messageMap.set(message_ids.user.toString(), {
            ...tempUserMsg,
            id: message_ids.user.toString(),
          });
        }

        // Add assistant message if not in handoff and reply exists
        if (!handoff_active && !ai_disabled && reply && reply.text && reply.text.trim() !== '') {
          messageMap.set(message_ids.assistant.toString(), {
            id: message_ids.assistant.toString(),
            role: 'assistant',
            content: reply.text,
            links: reply.links,
            createdAt: new Date(),
            type: reply.type,
            data: reply.data,
          });
        }

        const newMessages = sortMessages(Array.from(messageMap.values()));
        storeMessages(newMessages); // Persist immediately — don't rely on useEffect
        return newMessages;
      });
    },
    [getResponse, sessionId]
  );

  // Custom submit handler for demo responses
  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      let imageUrl = '';

      if (!input.trim()) return;

      if (image) {
        console.log('Uploading image', image);
        const formData = new FormData();
        formData.append('file', image);
        const response = await api.post('/upload-image', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        if (response.status === 200) {
          const data = response.data;
          console.log('Image uploaded successfully:', data);
          imageUrl = data.url;
        } else {
          console.error('Failed to upload image');
        }
      }

      // Clear typing indicator when sending message
      const sessionId = localStorage.getItem('chat_session');
      if (sessionId) {
        // Clear typing timeout
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = null;
        }
        // Typing indicator will expire on server side, but we can stop sending it
      }

      // Send the message
      sendMessage(input, imageUrl, productId);

      // Clear input
      setInput('');
      setImage(null);
    },
    [input, image, productId, sendMessage]
  );

  /*
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │   Render                                                                    │
  └─────────────────────────────────────────────────────────────────────────────┘
 */

  if (!apiActive || !chatbotActive) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[10] flex flex-col items-end">
      {/* Chat container with animation */}
      <div
        className={cn(
          'relative mb-2 transition-all duration-300 ease-in-out',
          !isChatOpen ? 'w-16 mb-[-60px]' : 'w-80 md:w-96'
        )}
      >
        <div
          className={cn(
            'absolute inset-0 z-0 translate-y-2 blur-sm [background:var(--secondary-gradient)] opacity-30 transition-all duration-300 ease-in-out',
            isChatOpen ? 'opacity-30' : 'opacity-0',
            icon_shape === 'square'
              ? 'rounded-none'
              : icon_shape === 'circle'
              ? 'rounded-xl'
              : icon_shape === 'rounded'
              ? 'rounded-lg'
              : icon_shape === 'rectangle'
              ? 'rounded-lg'
              : 'rounded-xl'
          )}
        ></div>
        <div
          className={cn(
            'relative z-10 w-80 md:w-96 bg-background flex flex-col transition-all duration-300 ease-in-out',
            isChatOpen
              ? 'opacity-100 scale-100 translate-y-0 h-[600px]'
              : 'opacity-0 scale-95 translate-y-2 h-0 pointer-events-none',
            icon_shape === 'square' ? 'rounded-none' : 'rounded-xl'
          )}
          style={{ transformOrigin: 'bottom right' }}
        >
          {!collectLead && collectLeadSettings ? (
            <LeadCollection setCollectLead={setCollectLead} />
          ) : (
            <>
              {/* Fixed height header that's always visible */}
              <div className="flex-shrink-0">
                <ChatHeader
                  isChatOpen={isChatOpen}
                  toggleChat={toggleChat}
                  onDeleteChat={
                    hasStartedConversation
                      ? () => setShowEndChatConfirm(true)
                      : undefined
                  }
                />
              </div>

              {/* Review Form or Chat Messages/Input */}
              {showReviewForm ? (
                <div className="overflow-y-auto flex-1 bg-neutral-100">
                  <ReviewForm
                    onSubmit={handleReviewSubmit}
                    onSkip={handleReviewSkip}
                    isLoading={submitReviewMutation.isPending}
                  />
                </div>
              ) : (
                <>
                  {/* Scrollable messages area */}
                  <div className="overflow-y-auto flex-1 bg-neutral-100">
                    <ChatMessages
                      messages={messages}
                      isTyping={isResponseLoading && !isHumanHandoff}
                      isAdminTyping={isAdminTyping && isHumanHandoff}
                      adminTypingAvatar={adminTypingAvatar}
                    />
                  </div>

                  {/* Smart Scheduling Button - Fixed at bottom */}
                  {settings?.smart_scheduling?.enabled && (
                    <div className="flex-shrink-0 px-4 pb-2 bg-neutral-100">
                      <Button
                        type="button"
                        onClick={() => setShowAppointmentDialog(true)}
                        className="w-full text-white bg-primary hover:bg-primary/90"
                      >
                        {settings.smart_scheduling?.buttonText || 'Get Appointments'}
                      </Button>
                    </div>
                  )}

                  {/* Fixed height footer */}
                  <div className="flex-shrink-0">
                    <ChatInput
                      input={input}
                      image={image}
                      productId={productId}
                      handleInputChange={handleInputChange}
                      handleImageChange={handleImageChange}
                      handleProductIdChange={handleProductIdChange}
                      handleSubmit={handleSubmit}
                      isLoading={isResponseLoading}
                      isChatOpen={isChatOpen}
                      hasStartedConversation={hasStartedConversation}
                      handleQuickOptionClick={handleQuickOptionClick}
                      liveAgentsAvailable={isLiveAgentsAvailable}
                      liveAgents={settings?.live_agents ?? []}
                    />
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {settings?.is_pro &&
        window.HelpmatePro?.isPro &&
        window.HelpmatePro?.components?.ProactiveSales && (
          <window.HelpmatePro.components.ProactiveSales
            onOpenChat={(id) => handleOpenChat(id)}
            isChatOpen={isChatOpen}
          />
        )}

      {settings?.is_pro &&
        window.HelpmatePro?.isPro &&
        window.HelpmatePro?.components?.ExitIntentCoupon && (
          <window.HelpmatePro.components.ExitIntentCoupon />
        )}

      {/* End chat confirmation dialog */}
      <Dialog open={showEndChatConfirm} onOpenChange={setShowEndChatConfirm}>
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>End this chat?</DialogTitle>
            <DialogDescription>
              You'll be asked to rate your experience.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEndChatConfirm(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => handleConfirmDelete()}>
              End chat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Appointment dialog */}
      <Dialog open={showAppointmentDialog} onOpenChange={setShowAppointmentDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule an Appointment</DialogTitle>
          </DialogHeader>
          <AppointmentForm />
        </DialogContent>
      </Dialog>

      {/* Welcome Message Popup */}
      {showWelcomePopup && (
        <WelcomeMessagePopup
          onClose={handleWelcomePopupClose}
          isOtherPopupVisible={isProactiveSalesVisible || isExitIntentVisible}
        />
      )}

      {/* Chat toggle button - aligned to the right */}
      <ChatToggleButton
        toggleChat={toggleChat}
        messages={messages}
        isChatOpen={isChatOpen}
        isWelcomePopupActive={showWelcomePopup}
      />
    </div>
  );
}
