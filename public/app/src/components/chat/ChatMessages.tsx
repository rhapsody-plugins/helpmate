'use client';

import { Avatar } from '@/components/chat/Avatar';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import type { ChatMessage } from '@/types';
import { useEffect, useRef } from 'react';

interface ChatMessagesProps {
  messages: ChatMessage[];
  isTyping?: boolean;
  isAdminTyping?: boolean;
  adminTypingAvatar?: string | null;
}

export function ChatMessages({
  messages,
  isTyping = false,
  isAdminTyping = false,
  adminTypingAvatar = null,
}: ChatMessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive or typing indicators change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, isAdminTyping]);

  return (
    <div className="overflow-y-auto p-4 pb-0 space-y-4 h-full">
      {messages.length === 0 ? (
        <div className="flex justify-center items-center pb-4 h-full text-center text-gray-500">
          <p className="text-base">Send a message to start the conversation</p>
        </div>
      ) : (
        <>
          {messages.map((message) => {
            // Render system messages (join notifications, etc.)
            if (message.role === 'system' || message.type === 'system') {
              const firstName = message.systemData?.first_name || 'Team member';
              return (
                <div
                  key={message.id}
                  className="flex justify-center items-center py-2"
                >
                  <div className="px-3 py-1.5 rounded-full bg-primary/10 text-xs text-gray-600">
                    {firstName} joined the conversation
                  </div>
                </div>
              );
            }
            return <MessageBubble key={message.id} message={message} />;
          })}
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
          {isAdminTyping && (
            <div className="flex items-start gap-2.5">
              <div className="flex-shrink-0 mr-2">
                <Avatar role="assistant" avatarUrl={adminTypingAvatar} />
              </div>
              <div className="max-w-[75%] p-3 rounded-md border border-white rounded-bl-[4px] rounded-tl-2xl bg-gray-100 text-gray-800">
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
