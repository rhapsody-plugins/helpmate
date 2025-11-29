import { useEffect, useRef } from 'react';
import { TestMessage } from './TestChatWidget';
import { TestMessageBubble } from './TestMessageBubble';
import { Loader2 } from 'lucide-react';

interface TestChatMessagesProps {
  messages: TestMessage[];
  isLoading?: boolean;
  bot_icon?: string;
  onEditMessage: (messageId: string, metadata: { edited: boolean; edited_text: string }) => void;
  sessionId: string;
}

export function TestChatMessages({
  messages,
  isLoading,
  bot_icon,
  onEditMessage,
  sessionId
}: TestChatMessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div className="p-4 space-y-4">
      {messages.length === 0 ? (
        <div className="flex items-center justify-center h-full min-h-[400px]">
          <div className="text-center text-gray-500">
            <p className="text-base">Send a message to start testing</p>
            <p className="mt-2 text-sm">All conversations are marked as debug sessions</p>
          </div>
        </div>
      ) : (
        <>
          {messages.map((message, index) => (
            <TestMessageBubble
              key={message.id}
              message={message}
              bot_icon={bot_icon}
              messages={messages}
              messageIndex={index}
              onEdit={onEditMessage}
              sessionId={sessionId}
            />
          ))}
          {isLoading && (
            <div className="flex gap-2 items-center text-gray-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">AI is thinking...</span>
            </div>
          )}
        </>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}

