import api from '@/lib/axios';
import { useMutation } from '@tanstack/react-query';

export interface TestChatResponse {
  error: boolean;
  reply: {
    type: string;
    text?: string;
    [key: string]: unknown;
  };
  session_id: string;
  message_ids?: {
    user_message_id: number;
    assistant_message_id: number;
  };
  rag_context?: string;
  training_instructions?: string;
  debug_info?: unknown;
}

export interface TestChatRequest {
  message: string;
  session_id: string;
  image_url?: string;
  product_id?: number | string;
  debug: boolean;
}

export const useTestChat = () => {
  const sendTestMessageMutation = useMutation<
    TestChatResponse,
    Error,
    { message: string; image_url?: string; product_id?: number | string }
  >({
    mutationFn: async ({ message, image_url = '', product_id = '' }) => {
      try {
        // Get or create test session ID with test_chat_ prefix
        let testChatSession = localStorage.getItem('test_chat_session') || '';

        if (!testChatSession) {
          testChatSession = `test_chat_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          localStorage.setItem('test_chat_session', testChatSession);
        }

        const res = await api.post<TestChatResponse>(
          '/chat',
          {
            message,
            session_id: testChatSession,
            image_url,
            product_id,
            debug: true, // Always pass debug flag for test chatbot
          },
          {
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        // Update session ID if server returns a new one
        if (res.data.session_id && res.data.session_id !== testChatSession) {
          localStorage.setItem('test_chat_session', res.data.session_id);
        }

        // Handle the response - it might already be parsed or might be a string
        let reply;
        try {
          reply =
            typeof res.data.reply === 'string'
              ? JSON.parse(res.data.reply)
              : res.data.reply;
        } catch (error) {
          console.error('Failed to parse reply:', error);
          reply = {
            type: 'text',
            text: 'Sorry, I encountered an error processing your request. Please try again or contact support if the issue persists.',
          };
        }

        return {
          ...res.data,
          reply,
        };
      } catch (error) {
        console.error('Test chat API request failed:', error);
        return {
          error: true,
          reply: {
            type: 'text',
            text: 'Sorry, I encountered an error processing your request. Please try again or contact support if the issue persists.',
          },
          session_id: localStorage.getItem('test_chat_session') || '',
        };
      }
    },
  });

  const clearTestSession = () => {
    localStorage.removeItem('test_chat_session');
    localStorage.removeItem('test_chat_messages');
  };

  return {
    sendTestMessageMutation,
    clearTestSession,
  };
};

