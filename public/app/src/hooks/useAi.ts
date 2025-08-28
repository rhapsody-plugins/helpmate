import api from '@/lib/axios';
import { AiResponse } from '@/types';
import { useMutation } from '@tanstack/react-query';
import { clearStoredMessages } from '@/utils/message-storage';

export const useAi = () => {
  const getResponseMutation = useMutation<
    AiResponse,
    Error,
    { message: string; image_url?: string; product_id?: number | string }
  >({
    mutationFn: async ({ message, image_url = '', product_id = '' }) => {
      try {
        const localChatSession = localStorage.getItem('chat_session') || '';
        const res = await api.post(
          '/chat',
          { message, session_id: localChatSession, image_url, product_id },
          {
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        // If we get a new session ID, clear any existing messages
        if (localChatSession !== res.data.session_id) {
          clearStoredMessages();
        }

        localStorage.setItem('chat_session', res.data.session_id);

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

        const result = {
          ...res.data,
          reply,
        };
        return result;
      } catch (error) {
        console.error('API request failed:', error);
        return {
          error: true,
          reply: {
            type: 'text',
            text: 'Sorry, I encountered an error processing your request. Please try again or contact support if the issue persists.',
          },
        };
      }
    },
  });

  const updateChatMetadataMutation = useMutation<
    { error: boolean; success: boolean },
    Error,
    { id: number; key: string; value: string | boolean }
  >({
    mutationFn: async ({ id, key, value }) => {
      const res = await api.post('/chat/metadata', { id, key, value });
      return res.data;
    },
  });

  return { getResponseMutation, updateChatMetadataMutation };
};
