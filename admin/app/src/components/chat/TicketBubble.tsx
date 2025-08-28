import HelpmateIcon from '@/assets/helpmate-logo-icon.svg';
import { FormattedContent } from '@/components/chat/FormattedContent';
import type { TicketMessage } from '@/types';
import { ChangeSvgColor } from 'svg-color-tools';

interface TicketBubbleProps {
  message: TicketMessage;
}

export function TicketBubble({ message }: TicketBubbleProps) {
  return (
    <div
      className={`flex items-start gap-2 ${
        message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
      }`}
    >
      {/* Avatar */}
      <div
        className={`flex-shrink-0 ${message.role === 'user' ? 'ml-2' : 'mr-2'}`}
      >
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center ${
            message.role === 'user'
              ? '[background:var(--primary-2)]'
              : '[background:var(--secondary-2)]'
          }`}
        >
          {message.role === 'user' ? (
            (() => {
              const userName = message.metadata?.name as string;
              const userEmail = message.metadata?.email as string;
              const displayName = userName || userEmail || 'U';
              return (
                <span className="text-xs font-medium text-white">
                  {displayName.charAt(0).toUpperCase()}
                </span>
              );
            })()
          ) : (
            (() => {
              const botIcon = getComputedStyle(document.documentElement)
                .getPropertyValue('--bot-icon')
                .trim();
              return botIcon ? (
                <img src={botIcon} className="w-4" />
              ) : (
                <ChangeSvgColor
                  fill="white"
                  src={HelpmateIcon}
                  className="w-4"
                />
              );
            })()
          )}
        </div>
      </div>

      {/* Message Bubble */}
      <div className="flex flex-col max-w-[80%] items-start">
        <div
          className={`px-3 py-2 rounded-md ${
            message.role === 'user'
              ? '[background:var(--primary-2)] text-white'
              : '[background:var(--primary-2)]/10 text-gray-800'
          }`}
          style={{
            fontSize: 'var(--font-size)',
            lineHeight: '1.2',
          }}
        >
          <FormattedContent
            content={message.message}
            className={message.role === 'user' ? 'text-white' : 'text-gray-800'}
          />
          <div
            className={`text-xs mt-2 flex items-center gap-2 ${
              message.role === 'user' ? 'text-slate-300' : 'text-gray-500'
            }`}
          >
            {message.datetime}
          </div>
        </div>
      </div>
    </div>
  );
}
