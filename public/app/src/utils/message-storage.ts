import type { ChatMessage } from '@/types';

const MESSAGES_KEY = 'chat_messages';
const SESSION_KEY = 'chat_session';

export const getStoredMessages = (): ChatMessage[] => {
  const sessionId = localStorage.getItem(SESSION_KEY);
  if (!sessionId) return [];

  const storedData = localStorage.getItem(MESSAGES_KEY);
  if (!storedData) return [];

  try {
    const messages = JSON.parse(storedData);
    return messages;
  } catch (error) {
    console.error('Error parsing stored messages:', error);
    return [];
  }
};

export const storeMessages = (messages: ChatMessage[]) => {
  const sessionId = localStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    // If no session ID, clear messages
    localStorage.removeItem(MESSAGES_KEY);
    return;
  }

  try {
    localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages));
  } catch (error) {
    console.error('Error storing messages:', error);
  }
};

export const clearStoredMessages = () => {
  localStorage.removeItem(MESSAGES_KEY);
};