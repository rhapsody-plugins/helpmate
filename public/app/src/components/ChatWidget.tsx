'use client';

import { ChatHeader } from '@/components/chat/ChatHeader';
import { ChatInput } from '@/components/chat/ChatInput';
import { ChatMessages } from '@/components/chat/ChatMessages';
import { ChatToggleButton } from '@/components/chat/ChatToggleButton';
import LeadCollection from '@/components/LeadCollection';
import { WelcomeMessagePopup } from '@/components/WelcomeMessagePopup';
import { useTheme } from '@/context/ThemeContext';
import { useAi } from '@/hooks/useAi';
import { useSettings } from '@/hooks/useSettings';
import api from '@/lib/axios';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/types';
import {
  clearStoredMessages,
  getStoredMessages,
  storeMessages,
} from '@/utils/message-storage';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

export default function ChatBot() {
  const { icon_shape } = useTheme();
  const [messages, setMessages] = useState<ChatMessage[]>(getStoredMessages());
  const [input, setInput] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [productId, setProductId] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [hasStartedConversation, setHasStartedConversation] = useState(false);
  const [collectLead, setCollectLead] = useState(
    localStorage.getItem('lead_collected') === 'true'
  );
  const [lastMessageCount, setLastMessageCount] = useState(0);
  const [hasAudioPermission, setHasAudioPermission] = useState(false);
  const [showWelcomePopup, setShowWelcomePopup] = useState(false);
  const [isProactiveSalesVisible, setIsProactiveSalesVisible] = useState(false);
  const [isExitIntentVisible, setIsExitIntentVisible] = useState(false);

  const { getResponseMutation } = useAi();
  const { mutateAsync: getResponse, isPending: isResponseLoading } =
    getResponseMutation;
  const { getSettingsQuery } = useSettings();
  const { data: settings } = getSettingsQuery;

  const coupon = settings?.settings?.exit_intent_coupon;

  // Memoize expensive computations
  const collectLeadSettings = useMemo(
    () => settings?.settings?.collect_lead,
    [settings?.settings?.collect_lead]
  );

  const notificationSound = useMemo(() => {
    if (settings?.customization?.sound_effect !== 'none') {
      return new Audio(
        `${window.helpmateApiSettings?.site_url}/wp-content/plugins/helpmate/public/sounds/${settings?.customization?.sound_effect}`
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
    if (hasUserMessages) {
      setHasStartedConversation(true);
    }
  }, [messages]);

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
    setProductId('');
    setImage(null);
    setHasStartedConversation(false);
    clearStoredMessages();
    localStorage.removeItem('chat_session');
  }, []);

  // Handle input change - optimized to prevent performance issues
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(e.target.value);
    },
    []
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

      if (!response) {
        console.error('No response from AI');
        return;
      }

      // Update the user message with the actual ID from the response
      setMessages((prevMessages) => {
        const { reply, message_ids } = response;
        const updatedMessages = prevMessages.map((msg) => {
          if (msg.id === userMessage.id) {
            return {
              ...msg,
              id: message_ids.user.toString(),
            };
          }
          return msg;
        });

        // Add the AI message with its actual ID
        const aiMessage: ChatMessage = {
          id: message_ids.assistant.toString(),
          role: 'assistant',
          content: reply.text,
          links: reply.links,
          createdAt: new Date(),
          type: reply.type,
          data: reply.data,
        };

        return [...updatedMessages, aiMessage];
      });
    },
    [getResponse]
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
                  resetChat={resetChat}
                />
              </div>

              {/* Scrollable messages area */}
              <div className="overflow-y-auto flex-1 bg-neutral-100">
                <ChatMessages
                  messages={messages}
                  isTyping={isResponseLoading}
                />
              </div>

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
                />
              </div>
            </>
          )}
        </div>
      </div>

      {settings?.is_pro &&
        window.HelpMatePro?.isPro &&
        window.HelpMatePro?.components?.ProactiveSales && (
          <window.HelpMatePro.components.ProactiveSales
            onOpenChat={(id) => handleOpenChat(id)}
            isChatOpen={isChatOpen}
          />
        )}

      {settings?.is_pro &&
        window.HelpMatePro?.isPro &&
        window.HelpMatePro?.components?.ExitIntentCoupon && (
          <window.HelpMatePro.components.ExitIntentCoupon />
        )}

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
