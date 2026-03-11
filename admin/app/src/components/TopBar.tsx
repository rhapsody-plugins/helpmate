import logo from '@/assets/helpmate-logo-bg-icon.svg';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useApi } from '@/hooks/useApi';
import {
  useClearAllNotifications,
  useDeleteNotification,
  useMarkNotificationRead,
  useNotificationsList,
  useUnreadCounts,
} from '@/hooks/useNotifications';
import {
  HelpmateDocsURL,
  HelpmateLoginURL,
  HelpmatePricingURL,
  HelpmateSupportURL,
} from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Icon } from '@iconify/react';
import {
  ArrowUpRight,
  Bell,
  Facebook,
  HandCoins,
  Instagram,
  MessageSquare,
  RefreshCw,
  Trash2,
  User,
  X
} from 'lucide-react';
import { useState } from 'react';

type PlatformType = 'website' | 'messenger' | 'instagram' | 'fb_comment' | 'ig_comment' | 'whatsapp';

/** Icon with platform color only (no bg); use before body text. */
function getPlatformBadge(platform?: PlatformType) {
  if (!platform) return null;

  const iconClass = 'w-3.5 h-3.5 flex-shrink-0';

  switch (platform) {
    case 'messenger':
      return (
        <span title="Messenger">
          <Icon icon="ph:messenger-logo-light" className={cn(iconClass, 'text-[#0084FF]')} />
        </span>
      );
    case 'instagram':
      return (
        <span title="Instagram">
          <Instagram className={cn(iconClass, 'text-pink-500')} />
        </span>
      );
    case 'fb_comment':
      return (
        <span title="FB Comment">
          <Facebook className={cn(iconClass, 'text-blue-600')} />
        </span>
      );
    case 'ig_comment':
      return (
        <span title="IG Comment">
          <Instagram className={cn(iconClass, 'text-purple-500')} />
        </span>
      );
    case 'whatsapp':
      return (
        <span title="WhatsApp">
          <Icon icon="mdi:whatsapp" className={cn(iconClass, 'text-green-500')} />
        </span>
      );
    case 'website':
      return (
        <span title="Website">
          <MessageSquare className={cn(iconClass, 'text-indigo-500')} />
        </span>
      );
    default:
      return null;
  }
}

function shouldShowPlatformBadge(notificationType: string): boolean {
  return ['conversation', 'social_message', 'message'].includes(notificationType);
}

export default function TopBar() {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { apiKeyQuery, syncCreditsMutation, openAiKeyQuery } = useApi();
  const { data: apiKeyData } = apiKeyQuery;
  const { data: openAiKeyData } = openAiKeyQuery;
  const { mutate: syncCredits, isPending: isSyncing } = syncCreditsMutation;
  const { data: unreadCounts } = useUnreadCounts();
  const { data: notificationsData } = useNotificationsList({
    page: 1,
    per_page: 15,
    read: null,
  });
  const { mutate: markRead } = useMarkNotificationRead();
  const { mutate: deleteNotification } = useDeleteNotification();
  const { mutate: clearAll, isPending: isClearing } = useClearAllNotifications();

  const totalUnread = unreadCounts?.total ?? 0;
  const notifications = notificationsData?.data ?? [];

  const total_credits =
    apiKeyData?.local_credits
      ?.filter(
        (credit) =>
          (credit.feature_slug &&
            credit.feature_slug.includes('ai_response')) ||
          credit.feature_slug === 'extra_credits'
      )
      .reduce((acc, credit) => acc + Number(credit.credits), 0) ?? 0;

  const total_spent_credits =
    apiKeyData?.local_credits
      ?.filter(
        (credit) =>
          (credit.feature_slug &&
            credit.feature_slug.includes('ai_response')) ||
          credit.feature_slug === 'extra_credits'
      )
      .reduce((acc, credit) => acc + Number(credit.usages), 0) ?? 0;

  const percent = total_credits > 0
    ? Math.min(100, Math.round((total_spent_credits / total_credits) * 100))
    : 0;

  return (
    <Card className="p-3 mb-3 bg-primary-800">
      <div className="flex gap-2 justify-between items-center">
        <div className="flex gap-3 items-center">
          <h1 className="!text-2xl !font-normal !text-white !my-0 !py-0 !flex items-center gap-2">
            <img src={logo} alt="Helpmate" className="w-8 h-8" />
            Helpmate
          </h1>
          <div className="h-6 w-px bg-white/20" />
          <Popover open={notificationsOpen} onOpenChange={setNotificationsOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative text-white bg-white/5 hover:bg-white/15 hover:text-white"
              >
                <Bell className="w-5 h-5" />
                {totalUnread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-medium rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
                    {totalUnread > 99 ? '99+' : totalUnread}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="start">
              <div className="p-2 border-b flex justify-between items-center">
                <span className="font-medium text-sm">Notifications</span>
                {notifications.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => clearAll()}
                    disabled={isClearing}
                  >
                    Clear all
                  </Button>
                )}
              </div>
              <ScrollArea className="h-[280px]">
                {notifications.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground text-center">
                    No notifications
                  </p>
                ) : (
                  <ul className="py-1 divide-y divide-border">
                    {notifications.map((n) => {
                      const isUnread = !n.read_at;
                      const platform = n.meta?.platform as PlatformType | undefined;
                      const showPlatformBadge = shouldShowPlatformBadge(n.type) && platform;

                      return (
                        <li
                          key={n.id}
                          className={`group flex gap-2 px-3 py-2.5 hover:bg-muted/50 items-start !mb-0 transition-colors ${isUnread ? 'bg-blue-50/50 border-l-2 border-l-blue-500' : ''
                            }`}
                        >
                          {isUnread && (
                            <div className="mt-1.5">
                              <div className="w-2 h-2 bg-blue-500 rounded-full" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <a
                              href={n.link}
                              className={`text-sm block truncate ${isUnread ? 'font-semibold text-gray-900' : 'font-medium'
                                }`}
                              onClick={() => {
                                if (isUnread) markRead(n.id);
                                setNotificationsOpen(false);
                              }}
                            >
                              {n.title}
                            </a>
                            {n.body && (
                              <p className="flex items-center gap-1.5 text-xs text-muted-foreground truncate !mt-0.5 !mb-0">
                                {showPlatformBadge && getPlatformBadge(platform)}
                                <span className="min-w-0 truncate">{n.body}</span>
                              </p>
                            )}
                          </div>
                          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 flex-shrink-0">
                            {isUnread && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                                onClick={() => markRead(n.id)}
                                title="Mark as read"
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={() => deleteNotification(n.id)}
                              title="Delete"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </ScrollArea>
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex gap-3 items-center">
          <Button
            variant="link"
            size="sm"
            className="!p-0 h-auto text-white"
            onClick={() => {
              window.open(HelpmateSupportURL, '_blank');
            }}
          >
            Support <ArrowUpRight className="!w-3" />
          </Button>
          <Button
            variant="link"
            size="sm"
            className="!p-0 h-auto text-white"
            onClick={() => {
              window.open(HelpmateDocsURL, '_blank');
            }}
          >
            Docs <ArrowUpRight className="!w-3" />
          </Button>
          {apiKeyData?.api_key && (
            <div className="flex gap-2 items-center px-2 py-1 bg-white rounded-sm">
              <div className="flex flex-col">
                <div
                  className={cn(
                    'min-w-[80px]',
                    !openAiKeyData?.openai_key && 'mb-1'
                  )}
                >
                  <div className="flex gap-1 items-center text-xs leading-none">
                    {openAiKeyData?.openai_key ? (
                      <>
                        Chat Credits: <span className="text-green-600">Unlimited</span>
                      </>
                    ) : (
                      <>
                        Free Chat Credits: {total_spent_credits}/{total_credits}
                        <button
                          className="p-0.5 text-gray-400 hover:text-primary-600 disabled:opacity-50"
                          title="Sync Credits"
                          onClick={() => syncCredits()}
                          disabled={isSyncing}
                          style={{ lineHeight: 0 }}
                        >
                          <RefreshCw
                            className={
                              isSyncing ? 'w-3 h-3 animate-spin' : 'w-3 h-3'
                            }
                          />
                        </button>
                      </>
                    )}
                  </div>
                  {!openAiKeyData?.openai_key && (
                    <div className="mt-0.5 w-full h-1 bg-gray-200 rounded">
                      <div
                        className="h-1 rounded"
                        style={{
                          width: `${percent}%`,
                          background:
                            'linear-gradient(90deg, #3b82f6 0%, #9333ea 100%)',
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
              {apiKeyData?.product_slug === 'helpmate-free' ? (
                <Button
                  size="sm"
                  className="py-1 h-auto !font-medium !text-xs -mr-0.5"
                  onClick={() => {
                    if (apiKeyData?.product_slug !== 'helpmate-free') {
                      window.open(HelpmateLoginURL, '_blank');
                    } else {
                      window.open(HelpmatePricingURL, '_blank');
                    }
                  }}
                >
                  Get Pro
                  <HandCoins className="!w-3" />
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="py-1 h-auto !font-medium !text-xs -mr-0.5"
                  onClick={() => {
                    window.open(HelpmateLoginURL, '_blank');
                  }}
                >
                  My Account
                  <User className="!w-3" />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
