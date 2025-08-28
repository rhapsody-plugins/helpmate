'use client';

import { Button } from '@/components/ui/button';
import { useTheme } from '@/context/ThemeContext';
import type { ChatMessage } from '@/types';
import { ArrowDownRight } from 'lucide-react';
import { ChangeSvgColor } from 'svg-color-tools';
import HelpmateIcon from '@/assets/helpmate-logo-icon.svg';

interface ChatToggleButtonProps {
  toggleChat: () => void;
  messages: ChatMessage[];
  isChatOpen: boolean;
  isWelcomePopupActive?: boolean;
}

export function ChatToggleButton({
  toggleChat,
  messages,
  isChatOpen,
  isWelcomePopupActive = false,
}: ChatToggleButtonProps) {
  const { icon, icon_shape, bot_name } = useTheme();
  return (
    <div
      className={`relative ${
        icon_shape === 'rectangle'
          ? 'w-auto'
          : 'h-(--icon-size) w-(--icon-size)'
      }`}
    >
      {/* Ripple effect underneath */}
      {isWelcomePopupActive && (
        <div
          className={`absolute inset-0 z-0 animate-ping bg-blue-400 rounded-full opacity-75 ${
            icon_shape === 'circle'
              ? 'rounded-full'
              : icon_shape === 'square'
              ? 'rounded-none'
              : icon_shape === 'rounded'
              ? 'rounded-lg'
              : 'rounded-md'
          }`}
        ></div>
      )}
      <div
        className={`absolute inset-0 z-0 translate-y-2 blur-sm [background:var(--secondary-gradient)] opacity-30 ${
          icon_shape === 'circle'
            ? 'rounded-full'
            : icon_shape === 'square'
            ? 'rounded-none'
            : icon_shape === 'rounded'
            ? 'rounded-lg'
            : 'rounded-md'
        }`}
      ></div>
      <Button
        onClick={toggleChat}
        className={`[background:var(--primary-gradient)] relative flex items-center justify-center h-auto z-20 p-4 ${
          icon_shape === 'circle'
            ? 'rounded-full'
            : icon_shape === 'square'
            ? 'rounded-none'
            : icon_shape === 'rounded'
            ? 'rounded-lg'
            : 'rounded-md'
        } ${
          icon_shape === 'rectangle'
            ? 'px-6 gap-3'
            : 'h-(--icon-size) w-(--icon-size)'
        }`}
      >
        {isChatOpen ? (
          <ArrowDownRight
            className={`${
              icon_shape === 'rectangle' ? 'h-8 w-8' : '!w-full !h-full'
            }`}
          />
        ) : icon ? (
          <img
            src={icon}
            alt="Icon"
            className={`${
              icon_shape === 'circle'
                ? 'rounded-full'
                : icon_shape === 'square'
                ? 'rounded-none'
                : icon_shape === 'rounded'
                ? 'rounded-lg'
                : 'rounded-md'
            } ${icon_shape === 'rectangle' ? 'h-8 w-8' : '!w-full !h-full'}`}
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
            className={`${
              icon_shape === 'rectangle' ? 'h-8 w-8' : '!w-full !h-full'
            }`}
          />
        )}
        {icon_shape === 'rectangle' && (
          <span className="font-medium text-white">{bot_name}</span>
        )}
        {messages.length > 0 && !isChatOpen && (
          <span className="flex absolute top-0 right-0 justify-center items-center w-5 h-5 text-xs text-white bg-red-500 rounded-full">
            {messages.filter((m) => m.role === 'assistant').length}
          </span>
        )}
      </Button>
    </div>
  );
}
