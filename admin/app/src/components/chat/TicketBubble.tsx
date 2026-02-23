import { FormattedContent } from '@/components/chat/FormattedContent';
import type { TicketMessage } from '@/types';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface TicketBubbleProps {
  message: TicketMessage;
}

export function TicketBubble({ message }: TicketBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div
      className={cn('flex', isUser ? 'justify-start' : 'justify-end')}
    >
      <div
        className={cn(
          'max-w-[70%] rounded-lg px-3 py-2',
          isUser ? 'bg-gray-100' : 'bg-primary text-primary-foreground'
        )}
      >
        <FormattedContent
          content={message.message}
          className={isUser ? 'text-foreground' : 'text-primary-foreground'}
        />
        <div
          className={cn(
            'text-xs mt-1',
            isUser ? 'text-muted-foreground' : 'text-primary-foreground/70'
          )}
        >
          {formatDistanceToNow(new Date(message.datetime), {
            addSuffix: true,
          })}
        </div>
      </div>
    </div>
  );
}
