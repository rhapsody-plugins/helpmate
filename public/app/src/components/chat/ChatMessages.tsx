'use client';

import { useRef, useEffect, useCallback } from 'react';
import type { ChatMessage } from '@/types';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import { Avatar } from '@/components/chat/Avatar';

interface ChatMessagesProps {
  messages: ChatMessage[];
  onQuestionClick: (question: string) => void;
  isTyping?: boolean;
}

export function ChatMessages({
  messages,
  onQuestionClick,
  isTyping = false,
}: ChatMessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Memoize the question click handler
  const handleQuestionClick = useCallback((question: string) => {
    onQuestionClick(question);
  }, [onQuestionClick]);

  return (
    <div className="overflow-y-auto p-4 pb-0 space-y-4 h-full">
      {messages.length === 0 ? (
        <div className="flex justify-center items-center pb-4 h-full text-center text-gray-500">
          <p className="text-base">Send a message to start the conversation</p>
        </div>
      ) : (
        <>
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              onQuestionClick={handleQuestionClick}
            />
          ))}
          {isTyping && (
            <div className="flex items-start gap-2.5">
              <div className="flex-shrink-0 mr-2">
                <Avatar role="assistant" />
              </div>
              <div className="max-w-[75%] p-3 rounded-md border border-white rounded-bl-[4px] rounded-tl-2xl bg-primary/10 text-gray-800">
                <TypingIndicator />
              </div>
            </div>
          )}
        </>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}
