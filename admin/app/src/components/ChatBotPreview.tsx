import HelpmateIcon from '@/assets/helpmate-logo-icon.svg';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronDown, Send, Trash2, User } from 'lucide-react';
import { ChangeSvgColor } from 'svg-color-tools';

export default function ChatBotPreview({
  icon,
  position,
  loading,
  bot_name,
  bot_icon,
  icon_shape,
}: {
  icon: string;
  position: string;
  loading: boolean;
  bot_name: string;
  bot_icon: string;
  icon_shape: string;
}) {
  return (
    <>
      {loading ? (
        <div
          className={`flex flex-col gap-3 items-end w-full max-w-xs ${
            position === 'right' ? 'items-end' : 'items-start'
          }`}
        >
          <div
            className={`overflow-hidden mx-auto w-full max-w-xs border shadow-lg bg-background ${
              icon_shape === 'circle'
                ? 'rounded-lg'
                : icon_shape === 'square'
                ? 'rounded-none'
                : icon_shape === 'rounded'
                ? 'rounded-lg'
                : 'rounded-md'
            }`}
          >
            {/* Header Skeleton */}
            <div className="flex justify-between items-center p-4 bg-neutral-200">
              <div className="flex items-center">
                <Skeleton className="mr-3 w-10 h-10 rounded-full" />
                <Skeleton className="w-24 h-6" />
              </div>
              <div className="flex items-center space-x-2">
                <Skeleton className="w-8 h-8 rounded-full" />
                <Skeleton className="w-8 h-8 rounded-full" />
              </div>
            </div>

            {/* Chat messages Skeleton */}
            <div className="flex flex-col gap-3 px-4 py-4 bg-background min-h-[220px]">
              {/* User message skeleton */}
              <div className="flex justify-end">
                <div className="flex gap-2 items-start">
                  <Skeleton className="w-32 h-10 rounded-lg" />
                  <Skeleton className="w-8 h-8 rounded-full" />
                </div>
              </div>
              {/* Bot message skeleton */}
              <div className="flex gap-2 items-start">
                <Skeleton className="w-8 h-8 rounded-full" />
                <Skeleton className="w-48 h-16 rounded-lg" />
              </div>
            </div>

            {/* Input area Skeleton */}
            <div className="flex gap-2 items-center px-4 py-3 border-t bg-background">
              <div className="flex-1">
                <Skeleton className="w-full h-10" />
              </div>
              <Skeleton className="w-10 h-10 rounded-md" />
            </div>
          </div>

          <Skeleton className="w-14 h-14 rounded-full" />
        </div>
      ) : (
        <div
          className={`flex flex-col gap-3 items-end w-full max-w-xs ${
            position === 'right' ? 'items-end' : 'items-start'
          }`}
        >
          <div className="relative mx-auto w-full max-w-xs">
            <div
              className={`absolute inset-0 z-0 translate-y-2 blur-sm [background:var(--secondary-gradient)] opacity-30 ${
                icon_shape === 'circle'
                  ? 'rounded-xl'
                  : icon_shape === 'square'
                  ? 'rounded-none'
                  : icon_shape === 'rounded'
                  ? 'rounded-lg'
                  : 'rounded-md'
              }`}
            ></div>
            <div
              className={`overflow-hidden relative z-10 bg-background ${
                icon_shape === 'circle'
                  ? 'rounded-xl'
                  : icon_shape === 'square'
                  ? 'rounded-none'
                  : icon_shape === 'rounded'
                  ? 'rounded-lg'
                  : 'rounded-md'
              }`}
            >
              {/* Header */}
              <div className="[background:var(--primary-2)] text-white p-4 flex items-center justify-between">
                <div className="flex items-center">
                  <div className="[background:var(--secondary-2)] text-secondary-2-foreground p-2 rounded-full mr-3">
                    {bot_icon ? (
                      <img
                        src={bot_icon}
                        alt="Bot Icon"
                        className="w-6 h-6 rounded-full"
                      />
                    ) : (
                      <ChangeSvgColor fill="white" src={HelpmateIcon} />
                    )}
                  </div>
                  <h1 className="!text-lg !font-semibold !text-white">
                    {bot_name}
                  </h1>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="p-0 w-8 h-8 text-white rounded-full hover:bg-white"
                    title="Reset conversation"
                  >
                    <Trash2 size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="p-0 w-8 h-8 text-white rounded-full hover:bg-white"
                  >
                    <ChevronDown size={18} />
                  </Button>
                </div>
              </div>

              {/* Chat messages */}
              <div className="flex flex-col gap-3 px-4 py-4 bg-neutral-100 min-h-[220px]">
                {/* User message */}
                <div className="flex justify-end">
                  <div className="flex items-start">
                    <div
                      className="[background:var(--secondary-2)] text-white px-3 py-2 rounded-md"
                      style={{
                        fontSize: 'var(--font-size)',
                        lineHeight: '1.2',
                      }}
                    >
                      hi
                    </div>
                    {/* <Avatar role="user" /> */}
                  </div>
                </div>
                {/* Bot message */}
                <div className="flex gap-2 items-end">
                  <Avatar role="assistant" bot_icon={bot_icon} />
                  <div
                    className="bg-[var(--primary-2)]/10 px-3 py-2 rounded-md border border-white max-w-[80%]"
                    style={{ fontSize: 'var(--font-size)', lineHeight: '1.2' }}
                  >
                    Hello! How can I assist you today?
                  </div>
                </div>
              </div>

              {/* Input area (static, no functionality) */}
              <div className="flex items-center gap-2 px-4 py-3 border-t border-white bg-[var(--primary-2)]/10">
                <div className="flex-1">
                  <Input
                    type="text"
                    placeholder="Type your message..."
                    className="!rounded-md !border-input"
                  />
                </div>
                <Button size="icon" className="[background:var(--primary-2)]">
                  <Send size={16} />
                </Button>
              </div>
            </div>
          </div>

          <div
            className={`relative ${
              icon_shape === 'rectangle'
                ? 'w-auto'
                : 'h-(--icon-size) w-(--icon-size)'
            }`}
          >
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
              className={`[background:var(--primary-gradient)] relative flex items-center justify-center z-20 p-4 ${
                icon_shape === 'circle'
                  ? 'rounded-full'
                  : icon_shape === 'square'
                  ? 'rounded-none'
                  : icon_shape === 'rounded'
                  ? 'rounded-lg'
                  : 'rounded-md'
              } ${
                icon_shape === 'rectangle'
                  ? 'w-auto px-6 gap-3'
                  : 'h-(--icon-size) w-(--icon-size)'
              }`}
            >
              {icon ? (
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
                  } ${
                    icon_shape === 'rectangle' ? 'h-8 w-8' : '!w-full !h-full'
                  }`}
                />
              ) : (
                <ChangeSvgColor
                  src={HelpmateIcon}
                  fill="white"
                  style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  className={`${
                    icon_shape === 'rectangle' ? 'h-8 w-8' : '!w-full !h-full'
                  }`}
                />
              )}
              {icon_shape === 'rectangle' && (
                <span className="text-xl font-medium text-white">
                  {bot_name}
                </span>
              )}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

interface AvatarProps {
  role: 'user' | 'assistant';
  className?: string;
  bot_icon?: string;
}

function Avatar({ role, className = '', bot_icon }: AvatarProps) {
  return (
    <div
      className={`w-8 h-8 rounded-full flex items-center justify-center ${
        role === 'user'
          ? '[background:var(--primary-2)]'
          : '[background:var(--secondary-2)]'
      } ${className}`}
    >
      {role === 'user' ? (
        <User size={16} className="text-white" />
      ) : bot_icon ? (
        <img src={bot_icon} className="w-4" />
      ) : (
        <ChangeSvgColor fill="white" src={HelpmateIcon} className="w-4" />
      )}
    </div>
  );
}
