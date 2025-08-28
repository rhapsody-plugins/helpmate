'use client';

import HelpmateIcon from '@/assets/helpmate-logo-icon.svg';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/context/ThemeContext';
import { useSettings } from '@/hooks/useSettings';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { ChangeSvgColor } from 'svg-color-tools';

interface ChatHeaderProps {
  isChatOpen: boolean;
  toggleChat: () => void;
  resetChat: () => void;
}

export function ChatHeader({
  isChatOpen,
  toggleChat,
  resetChat,
}: ChatHeaderProps) {
  const { icon_shape } = useTheme();
  const { getSettingsQuery } = useSettings();
  const { data: settings } = getSettingsQuery;
  const { bot_name, bot_icon } = settings.customization as {
    bot_name: string;
    bot_icon: string;
  };
  return (
    <div
      className={cn(
        'bg-primary text-white p-4 flex items-center justify-between',
        icon_shape === 'square'
          ? 'rounded-none'
          : icon_shape === 'circle'
          ? 'rounded-t-xl'
          : icon_shape === 'rounded'
          ? 'rounded-t-lg'
          : icon_shape === 'rectangle'
          ? 'rounded-t-lg'
          : 'rounded-t-xl'
      )}
    >
      <div className="flex items-center">
        <div className="p-2 mr-3 rounded-full bg-secondary">
          {bot_icon ? (
            <img
              src={bot_icon}
              alt="Bot Icon"
              className="w-6 h-6 rounded-full"
            />
          ) : (
            <ChangeSvgColor
              src={HelpmateIcon}
              fill="white"
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            />
          )}
        </div>
        <h1 className="!text-lg !font-semibold">{bot_name}</h1>
      </div>
      <div className="flex items-center space-x-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={resetChat}
          className="p-0 w-8 h-8 text-white rounded-full hover:!bg-white"
          title="Reset conversation"
        >
          <Trash2 size={16} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleChat}
          className="p-0 w-8 h-8 text-white rounded-full hover:!bg-white"
        >
          {isChatOpen ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
        </Button>
      </div>
    </div>
  );
}
