import { useState, useCallback, useEffect } from 'react';
import { useTestChat } from '@/hooks/useTestChat';
import { TestChatMessages } from './TestChatMessages';
import { TestChatInput } from './TestChatInput';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '@/lib/axios';
import { useSettings } from '@/hooks/useSettings';
import HelpmateIcon from '@/assets/helpmate-logo-icon.svg';
import { ChangeSvgColor } from 'svg-color-tools';

export interface TestMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  type?: string;
  data?: unknown;
  rag_context?: string;
  training_instructions?: string;
  timestamp: Date;
  metadata?: {
    edited?: boolean;
    edited_text?: string;
  };
}

export function TestChatWidget() {
  const [messages, setMessages] = useState<TestMessage[]>(() => {
    const stored = localStorage.getItem('test_chat_messages');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return parsed.map((msg: TestMessage) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        }));
      } catch {
        return [];
      }
    }
    return [];
  });
  const [input, setInput] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [botIcon, setBotIcon] = useState('');
  const [sessionId] = useState(() => {
    const stored = localStorage.getItem('test_chat_session_id');
    if (stored) {
      return stored;
    }
    const newSessionId = `test_session_${Date.now()}`;
    localStorage.setItem('test_chat_session_id', newSessionId);
    return newSessionId;
  });

  const { sendTestMessageMutation, clearTestSession } = useTestChat();
  const { mutateAsync: sendMessage, isPending: isLoading } = sendTestMessageMutation;
  const { getSettingsMutation } = useSettings();
  const { mutate: getSettings } = getSettingsMutation;

  // Save messages to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('test_chat_messages', JSON.stringify(messages));
  }, [messages]);

  // Fetch customization settings and apply styles
  useEffect(() => {
    getSettings('customization', {
      onSuccess: (data: Record<string, unknown>) => {
        if (data.bot_icon && typeof data.bot_icon === 'string') {
          setBotIcon(data.bot_icon);
        }

        // Apply CSS custom properties
        if (data.primary_color && typeof data.primary_color === 'string') {
          document.documentElement.style.setProperty('--primary-2', data.primary_color);
        }
        if (data.primary_gradient && typeof data.primary_gradient === 'string') {
          document.documentElement.style.setProperty('--primary-gradient', data.primary_gradient);
        }
        if (data.secondary_color && typeof data.secondary_color === 'string') {
          document.documentElement.style.setProperty('--secondary-2', data.secondary_color);
        }
        if (data.secondary_gradient && typeof data.secondary_gradient === 'string') {
          document.documentElement.style.setProperty('--secondary-gradient', data.secondary_gradient);
        }
        if (data.font_size && typeof data.font_size === 'string') {
          document.documentElement.style.setProperty('--font-size', data.font_size);
        }
        if (data.icon_size && typeof data.icon_size === 'string') {
          document.documentElement.style.setProperty('--icon-size', data.icon_size);
        }
        if (data.position && typeof data.position === 'string') {
          document.documentElement.style.setProperty('--position', data.position);
        }
      },
    });
  }, [getSettings]);

  const handleSendMessage = useCallback(
    async (messageText: string, imageUrl: string = '', productId: string = '') => {
      if (!messageText.trim()) return;

      // Add user message
      const userMessage: TestMessage = {
        id: `user_${Date.now()}`,
        role: 'user',
        content: messageText,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);

      try {
        // Get AI response
        const response = await sendMessage({
          message: messageText,
          image_url: imageUrl,
          product_id: productId,
        });

        // Debug: Log the response to see rag_context
        console.log('Test Chat Response:', response);
        console.log('RAG Context:', response.rag_context);
        console.log('Training Instructions:', response.training_instructions);

        // Add AI message
        const aiMessage: TestMessage = {
          id: `assistant_${Date.now()}`,
          role: 'assistant',
          content: response.reply.text || '',
          type: response.reply.type,
          data: response.reply,
          rag_context: response.rag_context || '',
          training_instructions: response.training_instructions || '',
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, aiMessage]);
      } catch (error) {
        console.error('Failed to send test message:', error);
        const errorMessage: TestMessage = {
          id: `error_${Date.now()}`,
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
          type: 'text',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    },
    [sendMessage]
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim()) return;

      let imageUrl = '';

      if (image) {
        console.log('Uploading image', image);
        const formData = new FormData();
        formData.append('file', image);
        try {
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
        } catch (error) {
          console.error('Error uploading image:', error);
        }
      }

      await handleSendMessage(input, imageUrl);

      // Clear input
      setInput('');
      setImage(null);
    },
    [input, image, handleSendMessage]
  );

  const handleNewChat = useCallback(() => {
    if (confirm('Start a new test session? This will clear the current conversation.')) {
      setMessages([]);
      clearTestSession();
      // Generate new session ID
      const newSessionId = `test_session_${Date.now()}`;
      localStorage.setItem('test_chat_session_id', newSessionId);
    }
  }, [clearTestSession]);

  const handleEditMessage = useCallback((messageId: string, metadata: { edited: boolean; edited_text: string }) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId
          ? { ...msg, metadata }
          : msg
      )
    );
  }, []);

  return (
    <>
      {/* Header - match ChatBotPreview */}
      <div className="[background:var(--primary-2)] text-white p-4 flex items-center justify-between">
        <div className="flex items-center">
          <div className="[background:var(--secondary-2)] text-secondary-2-foreground p-2 rounded-full mr-3">
            {botIcon ? (
              <img
                src={botIcon}
                alt="Bot Icon"
                className="w-6 h-6 rounded-full"
              />
            ) : (
              <ChangeSvgColor fill="white" src={HelpmateIcon} />
            )}
          </div>
          <div>
            <h1 className="!text-lg !font-semibold !text-white !m-0 !p-0">
              Test Chat
            </h1>
            <p className="!text-sm !text-white/80 !m-0 !mt-0.5">Debug</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleNewChat}
          className="p-0 w-8 h-8 text-white rounded-full hover:bg-white/20 flex items-center justify-center"
          title="New chat"
        >
          <RotateCcw size={16} />
        </Button>
      </div>

      {/* Messages */}
      <div className="overflow-y-auto flex-1 bg-neutral-100 min-h-[220px]">
        <TestChatMessages
          messages={messages}
          isLoading={isLoading}
          bot_icon={botIcon}
          onEditMessage={handleEditMessage}
          sessionId={sessionId}
        />
      </div>

      {/* Input */}
      <TestChatInput
        input={input}
        setInput={setInput}
        image={image}
        setImage={setImage}
        onSubmit={handleSubmit}
        isLoading={isLoading}
      />
    </>
  );
}

