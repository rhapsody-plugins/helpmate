import { getAdminUrlForPage, PageType } from '@/contexts/MainContext';
import PageGuard from '@/components/PageGuard';
import PageHeader from '@/components/PageHeader';
import { ProBadge } from '@/components/ProBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { useSettings } from '@/hooks/useSettings';
import {
  PendingPage,
  SocialAccount,
  SocialConversationStarter,
  SocialConversationStarters,
  useSocialChat,
} from '@/hooks/useSocialChat';
import { cn } from '@/lib/utils';
import { Icon } from '@iconify/react';
import { toast } from 'sonner';
import {
  AlertCircle,
  Copy,
  ExternalLink,
  Facebook,
  Instagram,
  Loader2,
  Lock,
  MessageSquare,
  Plus,
  Smartphone,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

export type SocialChatPlatform = 'facebook' | 'instagram' | 'whatsapp' | 'tiktok';

export interface SocialChatSettingsProps {
  page?: PageType;
  platform?: SocialChatPlatform;
}

export default function SocialChatSettings({ page, platform }: SocialChatSettingsProps) {
  const { getProQuery } = useSettings();
  const isPro = getProQuery.data ?? false;
  const {
    getAccountsQuery,
    connectFacebookPageMutation,
    connectInstagramMutation,
    connectWhatsAppMutation,
    usePendingPagesQuery,
    connectPagesMutation,
    disconnectAccountMutation,
    registerRetryMutation,
    getSettingsQuery,
    updateSettingsMutation,
    getConversationStartersQuery,
    updateConversationStartersMutation,
  } = useSocialChat();

  const [showPageSelector, setShowPageSelector] = useState(false);
  const [selectedPage, setSelectedPage] = useState<string>('');
  const [tempToken, setTempToken] = useState<string>('');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('facebook');
  const [returnTo, setReturnTo] = useState<string | null>(null);

  // Use pending pages query with temp_token
  const pendingPagesQuery = usePendingPagesQuery(tempToken || null);
  const [localSettings, setLocalSettings] = useState({
    enabled: false,
    platforms: {
      messenger: { enabled: true, auto_reply: true, comment_auto_reply: true, conversation_starters_enabled: false },
      instagram_dm: { enabled: true, auto_reply: true, comment_auto_reply: true, conversation_starters_enabled: false },
      whatsapp: { enabled: true, auto_reply: true, conversation_starters_enabled: false },
      comments: { enabled: true },
    },
    leads_enabled: false,
  });
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<{
    open: boolean;
    account: SocialAccount | null;
  }>({ open: false, account: null });
  const [showLocalhostWarning, setShowLocalhostWarning] = useState(false);
  const [whatsappRegisterDialog, setWhatsappRegisterDialog] = useState<{
    open: boolean;
    success: boolean;
    pin?: string;
    pins?: string[];
    errorCode?: string;
    errorMessage?: string;
    retryToken?: string;
    wrongPinMessage?: string;
  } | null>(null);
  const [retryPinInput, setRetryPinInput] = useState('');

  // Check if running on localhost
  const isLocalhost = useMemo(() => {
    if (import.meta.env.VITE_ENVIRONMENT === 'dev') {
      return false;
    }
    return (
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.startsWith('192.168.') ||
      window.location.hostname.startsWith('10.') ||
      window.location.hostname.startsWith('172.')
    );
  }, []);

  const settings = getSettingsQuery.data;
  const accounts = getAccountsQuery.data?.accounts ?? [];
  const pendingPages = pendingPagesQuery.data ?? [];

  // Note: The old getPendingPagesQuery is kept for backward compatibility but not used

  // Smart scheduling - get from conversation starters response instead
  // Conversation starters
  const conversationStartersData = getConversationStartersQuery.data;
  const [conversationStartersInput, setConversationStartersInput] =
    useState<SocialConversationStarters>({
      messenger: [],
      instagram_dm: [],
      whatsapp: [],
    });
  const prevConversationStartersRef = useRef<string>('');

  // Check if accounts exist for each platform
  const hasFacebookPage = accounts.some((acc) => acc.platform === 'messenger');
  const hasInstagram = accounts.some((acc) => acc.platform === 'instagram');
  const hasWhatsApp = accounts.some((acc) => acc.platform === 'whatsapp');

  // Check URL params for page selection mode (select_mode=1 with temp_token)
  useEffect(() => {
    const urlParams = new URLSearchParams(
      window.location.search || window.location.hash.split('?')[1] || ''
    );
    const selectMode = urlParams.get('select_mode');
    const token = urlParams.get('temp_token');
    const platformParam = urlParams.get('platform') || 'facebook';
    const returnToParam = urlParams.get('return_to');

    if (selectMode === '1' && token) {
      setTempToken(token);
      setSelectedPlatform(platformParam);
      if (returnToParam) {
        setReturnTo(returnToParam);
      }
      setShowPageSelector(true);

      // Clear URL params after reading
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('select_mode');
      newUrl.searchParams.delete('temp_token');
      newUrl.searchParams.delete('platform');
      newUrl.searchParams.delete('return_to');
      window.history.replaceState(null, '', newUrl.toString());
    }
  }, []);

  // Check URL for WhatsApp register result (success or error) after connection
  useEffect(() => {
    const search = window.location.search || window.location.hash.split('?')[1] || '';
    const params = new URLSearchParams(search);
    const connected = params.get('connected');
    const registerSuccess = params.get('register_success');
    const registerError = params.get('register_error');
    const pin = params.get('pin');
    const pins = params.get('pins');
    const errorCode = params.get('error_code');
    const errorMessage = params.get('error_message');
    const retryToken = params.get('retry_token');
    const subtab = params.get('subtab');

    const isWhatsAppContext =
      platform === 'whatsapp' || subtab === 'whatsapp' || (!platform && !subtab);

    if (
      connected === '1' &&
      isWhatsAppContext &&
      (registerSuccess === '1' || registerError === '1')
    ) {
      setWhatsappRegisterDialog({
        open: true,
        success: registerSuccess === '1',
        pin: pin || undefined,
        pins: pins ? pins.split(',') : undefined,
        errorCode: errorCode || undefined,
        errorMessage: errorMessage ? decodeURIComponent(errorMessage) : undefined,
        retryToken: retryToken || undefined,
      });

      const url = new URL(window.location.href);
      url.searchParams.delete('connected');
      url.searchParams.delete('register_success');
      url.searchParams.delete('register_error');
      url.searchParams.delete('pin');
      url.searchParams.delete('pins');
      url.searchParams.delete('error_code');
      url.searchParams.delete('error_message');
      url.searchParams.delete('retry_token');
      window.history.replaceState(null, '', url.toString());
    }
  }, [platform]);

  // Sync local settings with fetched settings
  useEffect(() => {
    if (settings && !updateSettingsMutation.isPending) {
      // Use per-platform conversation_starters_enabled, fallback to global for backward compat
      const getConversationStartersEnabled = (platformKey: 'messenger' | 'instagram_dm' | 'whatsapp') =>
        settings.platforms?.[platformKey]?.conversation_starters_enabled ??
        settings.conversation_starters_enabled ??
        false;

      setLocalSettings({
        enabled: settings.enabled,
        platforms: {
          messenger: {
            enabled: settings.platforms.messenger?.enabled ?? true,
            auto_reply: settings.platforms.messenger?.auto_reply ?? true,
            comment_auto_reply: settings.platforms.messenger?.comment_auto_reply ?? true,
            conversation_starters_enabled: getConversationStartersEnabled('messenger'),
          },
          instagram_dm: {
            enabled: settings.platforms.instagram_dm?.enabled ?? true,
            auto_reply: settings.platforms.instagram_dm?.auto_reply ?? true,
            comment_auto_reply: settings.platforms.instagram_dm?.comment_auto_reply ?? true,
            conversation_starters_enabled: getConversationStartersEnabled('instagram_dm'),
          },
          whatsapp: {
            enabled: settings.platforms.whatsapp?.enabled ?? true,
            auto_reply: settings.platforms.whatsapp?.auto_reply ?? true,
            conversation_starters_enabled: getConversationStartersEnabled('whatsapp'),
          },
          comments: {
            enabled: settings.platforms.comments?.enabled ?? true,
          },
        },
        leads_enabled: settings.leads_enabled ?? false,
      });
    }
  }, [settings, updateSettingsMutation.isPending]);

  // Sync conversation starters with fetched data
  useEffect(() => {
    if (conversationStartersData?.conversation_starters) {
      const newString = JSON.stringify(
        conversationStartersData.conversation_starters
      );
      // Only update if the data actually changed (prevent infinite loop)
      if (prevConversationStartersRef.current !== newString) {
        prevConversationStartersRef.current = newString;
        setConversationStartersInput(
          conversationStartersData.conversation_starters
        );
      }
    }
  }, [conversationStartersData]);

  const handleAutoSaveSettings = (updatedSettings: typeof localSettings) => {
    updateSettingsMutation.mutate(updatedSettings);
  };

  const handleAddConversationStarter = (
    platform: keyof SocialConversationStarters
  ) => {
    const newStarter: SocialConversationStarter = {
      id: `starter_${Date.now()}`,
      text: '',
      enabled: true,
      is_default: false,
    };
    setConversationStartersInput((prev) => ({
      ...prev,
      [platform]: [...(prev[platform] || []), newStarter],
    }));
  };

  const handleUpdateConversationStarter = (
    platform: keyof SocialConversationStarters,
    index: number,
    updates: Partial<SocialConversationStarter>
  ) => {
    setConversationStartersInput((prev) => {
      const updated = [...(prev[platform] || [])];
      updated[index] = { ...updated[index], ...updates };
      return { ...prev, [platform]: updated };
    });
  };

  const handleDeleteConversationStarter = (
    platform: keyof SocialConversationStarters,
    index: number
  ) => {
    setConversationStartersInput((prev) => {
      const updated = [...(prev[platform] || [])];
      // Don't allow deleting default appointment starter
      if (updated[index]?.is_default) {
        return prev;
      }
      updated.splice(index, 1);
      return { ...prev, [platform]: updated };
    });
  };

  const handleSavePlatformStarters = () => {
    updateConversationStartersMutation.mutate(conversationStartersInput);
  };

  const handleNavigateToSchedulingPage = () => {
    const pageUrl = conversationStartersData?.smart_scheduling?.page_url;
    if (pageUrl) {
      window.open(pageUrl, '_blank');
    }
  };

  const handleConnectPages = () => {
    if (!selectedPage || !tempToken) {
      return;
    }

    connectPagesMutation.mutate(
      {
        temp_token: tempToken,
        selected_page_id: selectedPage,
        platform: selectedPlatform,
      },
      {
        onSuccess: () => {
          setShowPageSelector(false);
          setSelectedPage('');
          setTempToken('');
          setSelectedPlatform('facebook');
          // Refresh accounts list
          getAccountsQuery.refetch();
          // Redirect back to origin page if returnTo was set (use location for guaranteed navigation)
          if (returnTo) {
            const targetPage = returnTo as PageType;
            setReturnTo(null);
            window.location.assign(getAdminUrlForPage(targetPage));
          }
        },
      }
    );
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'messenger':
        return <Icon icon="ph:messenger-logo-light" className="w-4 h-4" />;
      case 'instagram':
        return <Instagram className="w-4 h-4" />;
      case 'whatsapp':
        return <Icon icon="mdi:whatsapp" className="w-4 h-4" />;
      default:
        return <Facebook className="w-4 h-4" />;
    }
  };

  const handleDeleteClick = (account: SocialAccount) => {
    setDeleteConfirmDialog({ open: true, account });
  };

  const handleDeleteConfirm = () => {
    if (deleteConfirmDialog.account) {
      disconnectAccountMutation.mutate(deleteConfirmDialog.account.id, {
        onSuccess: () => {
          setDeleteConfirmDialog({ open: false, account: null });
        },
      });
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmDialog({ open: false, account: null });
  };

  const handleConnectFacebook = () => {
    if (isLocalhost) {
      setShowLocalhostWarning(true);
      return;
    }
    connectFacebookPageMutation.mutate(
      page ? { returnTo: page } : undefined
    );
  };

  const handleConnectInstagram = () => {
    if (isLocalhost) {
      setShowLocalhostWarning(true);
      return;
    }
    connectInstagramMutation.mutate(
      page ? { returnTo: page } : undefined
    );
  };

  const handleConnectWhatsApp = () => {
    if (isLocalhost) {
      setShowLocalhostWarning(true);
      return;
    }
    connectWhatsAppMutation.mutate(
      page ? { returnTo: page } : undefined
    );
  };

  const getWhatsAppRegisterErrorMessage = (code?: string, fallback?: string) => {
    const messages: Record<string, string> = {
      '133016':
        'Too many registration attempts. Wait up to 72 hours before trying again, or use a different phone number. Avoid repeated failed attempts.',
      '133015':
        'Phone number was recently removed. Wait at least 5 minutes, then try connecting again.',
      '133006':
        'Phone number needs re-verification. Go to Meta Business Suite → WhatsApp → Phone numbers, and complete verification.',
      '133012':
        'Account is already linked with another service. Unlink from Meta Business Suite first.',
      '131031': 'Business account is locked. Contact Meta support.',
      '131014': 'Temporary error. Try again in a few minutes.',
      '200':
        'Permission issue. Ensure the app has whatsapp_business_management permission and try reconnecting.',
      '100':
        'Invalid request. Verify your WhatsApp Business Account setup in Meta Business Suite.',
    };
    return code ? messages[code] : fallback;
  };

  const handleCopyPin = (pin: string) => {
    navigator.clipboard.writeText(pin);
    toast.success('PIN copied to clipboard');
  };

  const handleRegisterRetry = () => {
    if (!whatsappRegisterDialog?.retryToken || !retryPinInput.trim()) return;
    const pin = retryPinInput.replace(/\D/g, '').slice(0, 6);
    if (pin.length !== 6) {
      setWhatsappRegisterDialog((d) =>
        d ? { ...d, wrongPinMessage: 'PIN must be 6 digits' } : d
      );
      return;
    }
    registerRetryMutation.mutate(
      { retry_token: whatsappRegisterDialog.retryToken, pin },
      {
        onSuccess: (data) => {
          setWhatsappRegisterDialog({
            open: true,
            success: true,
            pin: data.pin,
          });
          setRetryPinInput('');
        },
        onError: (err: Error & { code?: string }) => {
          if (err.code === 'EXPIRED') {
            setWhatsappRegisterDialog({
              open: true,
              success: false,
              errorCode: 'EXPIRED',
              errorMessage:
                'Your session has expired. Please disconnect and reconnect WhatsApp to try again.',
            });
            setRetryPinInput('');
          } else if (err.code === '133005') {
            setWhatsappRegisterDialog((d) =>
              d ? { ...d, wrongPinMessage: 'Wrong PIN. Please try again.' } : d
            );
          } else {
            setWhatsappRegisterDialog((d) =>
              d
                ? {
                    ...d,
                    errorMessage: err.message,
                    errorCode: err.code,
                  }
                : d
            );
          }
        },
      }
    );
  };

  const pageTitle =
    platform === 'facebook'
      ? 'Facebook'
      : platform === 'instagram'
        ? 'Instagram'
        : platform === 'whatsapp'
          ? 'WhatsApp'
          : platform === 'tiktok'
            ? 'TikTok'
            : 'Social Chat Settings';

  // TikTok: minimal "Coming soon" view only
  if (platform === 'tiktok') {
    return (
      <PageGuard page={page ?? 'social-chat-tiktok'}>
        <div className="gap-0">
          <PageHeader title={pageTitle} />
          <div className="flex flex-col gap-6 p-6">
            <Card className="py-0">
              <CardContent className="p-6">
                <div className="flex flex-col gap-4 justify-center items-center p-4 py-4 h-full rounded-lg border opacity-60 cursor-not-allowed">
                  <div className="flex justify-center items-center w-12 h-12 bg-black rounded-full opacity-50">
                    <Icon
                      icon="ph:tiktok-logo-thin"
                      className="w-6 h-6 text-white [&_path]:stroke-[1.5] [&_path]:fill-none [&_path]:stroke-white"
                    />
                  </div>
                  <div className="text-center">
                    <div className="font-medium">TikTok</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Connect your TikTok Business account
                    </div>
                  </div>
                  <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-muted text-muted-foreground">
                    Coming Soon
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </PageGuard>
    );
  }

  return (
    <PageGuard page={page ?? 'social-chat'}>
      <div className="gap-0">
        <PageHeader title={pageTitle} />

        <div className="flex flex-col gap-6 p-6">
          {/* Social Chat Platforms */}
          <div className="relative">
            {!isPro && (
              <ProBadge
                topMessage="Connect Facebook, Instagram, and WhatsApp to manage all your social conversations in one place."
                buttonText="Unlock Social Connections"
                tooltipMessage={null}
              />
            )}
            <Card
              className={cn(
                !isPro && 'opacity-50 cursor-not-allowed pointer-events-none',
                'gap-0 py-0'
              )}
            >
              <CardContent className="relative p-6 space-y-6">
                {updateSettingsMutation.isPending && (
                  <div className="flex absolute inset-0 z-10 justify-center items-center h-full rounded-lg backdrop-blur-sm bg-background/50">
                    <div className="flex gap-2 items-center">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      <p className="text-sm text-muted-foreground">
                        Saving settings...
                      </p>
                    </div>
                  </div>
                )}

                {localSettings.enabled && (
                  <div className={cn('grid gap-4', platform ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2')}>
                    {(!platform || platform === 'facebook') && (
                      <div className={cn('rounded-lg border', platform ? 'p-6 space-y-4' : 'p-4 space-y-4')}>
                        {!hasFacebookPage ? (
                          <div className="flex flex-col gap-4 justify-center items-center py-4">
                            <div className="flex justify-center items-center w-12 h-12 bg-blue-500 rounded-full">
                              <Facebook className="w-6 h-6 text-white" />
                            </div>
                            <div className="text-center">
                              <div className="font-medium">Facebook</div>
                              <div className="mt-1 text-sm text-muted-foreground">
                                Connect your Facebook Page
                              </div>
                            </div>
                            <Button
                              onClick={handleConnectFacebook}
                              disabled={
                                !isPro ||
                                connectFacebookPageMutation.isPending ||
                                updateSettingsMutation.isPending
                              }
                              variant="outline"
                              size="sm"
                            >
                              {connectFacebookPageMutation.isPending ? (
                                <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                              ) : (
                                <Facebook className="mr-2 w-4 h-4" />
                              )}
                              Connect
                            </Button>
                          </div>
                        ) : (
                          <>
                            <div className="flex justify-between items-center">
                              <div className="flex flex-1 gap-3 items-center">
                                <div className="flex justify-center items-center w-10 h-10 bg-blue-500 rounded-full">
                                  <Facebook className="w-5 h-5 text-white" />
                                </div>
                                <div className="flex-1">
                                  <div className="font-medium">Facebook</div>
                                  <div className="text-sm text-muted-foreground">
                                    {accounts.find(
                                      (acc) => acc.platform === 'messenger'
                                    )?.page_name || 'Connected'}
                                  </div>
                                </div>
                              </div>
                              <div className="flex gap-3 items-center">
                                <Button
                                  variant={
                                    localSettings.platforms.messenger.enabled
                                      ? 'outline'
                                      : 'default'
                                  }
                                  size="sm"
                                  disabled={updateSettingsMutation.isPending}
                                  onClick={() => {
                                    const updated = {
                                      ...localSettings,
                                      platforms: {
                                        ...localSettings.platforms,
                                        messenger: {
                                          ...localSettings.platforms.messenger,
                                          enabled:
                                            !localSettings.platforms.messenger
                                              .enabled,
                                        },
                                      },
                                    };
                                    setLocalSettings(updated);
                                    handleAutoSaveSettings(updated);
                                  }}
                                >
                                  {updateSettingsMutation.isPending && (
                                    <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                                  )}
                                  {localSettings.platforms.messenger.enabled
                                    ? 'Disable Facebook'
                                    : 'Enable Facebook'}
                                </Button>
                                {accounts
                                  .filter((acc) => acc.platform === 'messenger')
                                  .map((account) => (
                                    <Button
                                      key={account.id}
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleDeleteClick(account)}
                                      disabled={
                                        disconnectAccountMutation.isPending ||
                                        updateSettingsMutation.isPending
                                      }
                                    >
                                      <Trash2 className="w-4 h-4 text-destructive" />
                                    </Button>
                                  ))}
                              </div>
                            </div>

                            <div className="flex justify-between items-center pt-4 border-t">
                              <div className="flex gap-2 items-center">
                                <MessageSquare className="w-4 h-4 text-muted-foreground" />
                                <Label className="text-sm">Quick Messages</Label>
                              </div>
                              <Switch
                                checked={localSettings.platforms.messenger.conversation_starters_enabled}
                                disabled={updateSettingsMutation.isPending || !isPro}
                                onCheckedChange={(checked) => {
                                  const updated = {
                                    ...localSettings,
                                    platforms: {
                                      ...localSettings.platforms,
                                      messenger: {
                                        ...localSettings.platforms.messenger,
                                        conversation_starters_enabled: checked,
                                      },
                                    },
                                  };
                                  setLocalSettings(updated);
                                  handleAutoSaveSettings(updated);
                                }}
                              />
                            </div>

                            {localSettings.platforms.messenger.conversation_starters_enabled && (
                              <div className="flex gap-3 flex-col">
                                <p className="text-sm text-muted-foreground">
                                  Users will see these options when starting a conversation (max 4, 20 characters each)
                                </p>
                                <div className="space-y-2">
                                  {conversationStartersInput.messenger.map(
                                    (starter, index) => (
                                      <div
                                        key={starter.id}
                                        className="flex gap-2 items-center p-3 rounded-lg border bg-muted/30"
                                      >
                                        {starter.is_default && (
                                          <Lock className="flex-shrink-0 w-4 h-4 text-muted-foreground" />
                                        )}
                                        <Input
                                          placeholder="Enter conversation starter..."
                                          value={starter.text}
                                          onChange={(e) =>
                                            handleUpdateConversationStarter(
                                              'messenger',
                                              index,
                                              { text: e.target.value }
                                            )
                                          }
                                          disabled={
                                            !isPro ||
                                            updateConversationStartersMutation.isPending
                                          }
                                          maxLength={20}
                                          className="flex-1"
                                        />
                                        <Switch
                                          checked={starter.enabled}
                                          onCheckedChange={(checked) =>
                                            handleUpdateConversationStarter(
                                              'messenger',
                                              index,
                                              { enabled: checked }
                                            )
                                          }
                                          disabled={
                                            !isPro ||
                                            updateConversationStartersMutation.isPending
                                          }
                                        />
                                        {starter.is_default &&
                                          conversationStartersData?.smart_scheduling
                                            ?.page_url && (
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={handleNavigateToSchedulingPage}
                                              disabled={
                                                !isPro ||
                                                updateConversationStartersMutation.isPending
                                              }
                                            >
                                              <ExternalLink className="w-4 h-4" />
                                              Visit Page
                                            </Button>
                                          )}
                                        {!starter.is_default && (
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() =>
                                              handleDeleteConversationStarter(
                                                'messenger',
                                                index
                                              )
                                            }
                                            disabled={
                                              !isPro ||
                                              updateConversationStartersMutation.isPending
                                            }
                                          >
                                            <Trash2 className="w-4 h-4 text-destructive" />
                                          </Button>
                                        )}
                                      </div>
                                    )
                                  )}
                                  {conversationStartersInput.messenger.length < 4 && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        handleAddConversationStarter('messenger')
                                      }
                                      disabled={
                                        !isPro ||
                                        updateConversationStartersMutation.isPending
                                      }
                                      className="w-full"
                                    >
                                      <Plus className="w-4 h-4" />
                                      Add Starter
                                    </Button>
                                  )}
                                </div>
                                <Button
                                  onClick={handleSavePlatformStarters}
                                  disabled={
                                    !isPro || updateConversationStartersMutation.isPending
                                  }
                                  className="w-full"
                                >
                                  {updateConversationStartersMutation.isPending && (
                                    <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                                  )}
                                  Save Starters
                                </Button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {(!platform || platform === 'instagram') && (
                      <div className={cn('rounded-lg border', platform ? 'p-6 space-y-4' : 'p-4 space-y-4')}>
                        {!hasInstagram ? (
                          <div className="flex flex-col gap-4 justify-center items-center py-4 h-full">
                            <div className="flex justify-center items-center w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full">
                              <Instagram className="w-6 h-6 text-white" />
                            </div>
                            <div className="text-center">
                              <div className="font-medium">Instagram</div>
                              <div className="mt-1 text-sm text-muted-foreground">
                                Connect your Instagram Business account
                              </div>
                            </div>
                            <Button
                              onClick={handleConnectInstagram}
                              disabled={
                                !isPro ||
                                connectInstagramMutation.isPending ||
                                updateSettingsMutation.isPending
                              }
                              variant="outline"
                              size="sm"
                            >
                              {connectInstagramMutation.isPending ? (
                                <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                              ) : (
                                <Instagram className="mr-2 w-4 h-4" />
                              )}
                              Connect
                            </Button>
                          </div>
                        ) : (
                          <>
                            <div className="flex justify-between items-center">
                              <div className="flex flex-1 gap-3 items-center">
                                <div className="flex justify-center items-center w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full">
                                  <Instagram className="w-5 h-5 text-white" />
                                </div>
                                <div className="flex-1">
                                  <div className="font-medium">Instagram</div>
                                  <div className="text-sm text-muted-foreground">
                                    {accounts.find(
                                      (acc) => acc.platform === 'instagram'
                                    )?.page_name || 'Connected'}
                                  </div>
                                </div>
                              </div>
                              <div className="flex gap-3 items-center">
                                <Button
                                  variant={
                                    localSettings.platforms.instagram_dm.enabled
                                      ? 'outline'
                                      : 'default'
                                  }
                                  size="sm"
                                  disabled={updateSettingsMutation.isPending}
                                  onClick={() => {
                                    const updated = {
                                      ...localSettings,
                                      platforms: {
                                        ...localSettings.platforms,
                                        instagram_dm: {
                                          ...localSettings.platforms.instagram_dm,
                                          enabled:
                                            !localSettings.platforms.instagram_dm
                                              .enabled,
                                        },
                                      },
                                    };
                                    setLocalSettings(updated);
                                    handleAutoSaveSettings(updated);
                                  }}
                                >
                                  {updateSettingsMutation.isPending && (
                                    <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                                  )}
                                  {localSettings.platforms.instagram_dm.enabled
                                    ? 'Disable Instagram'
                                    : 'Enable Instagram'}
                                </Button>
                                {accounts
                                  .filter((acc) => acc.platform === 'instagram')
                                  .map((account) => (
                                    <Button
                                      key={account.id}
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleDeleteClick(account)}
                                      disabled={
                                        disconnectAccountMutation.isPending ||
                                        updateSettingsMutation.isPending
                                      }
                                    >
                                      <Trash2 className="w-4 h-4 text-destructive" />
                                    </Button>
                                  ))}
                              </div>
                            </div>

                            <div className="flex justify-between items-center pt-4 border-t">
                              <div className="flex gap-2 items-center">
                                <MessageSquare className="w-4 h-4 text-muted-foreground" />
                                <Label className="text-sm">Quick Messages</Label>
                              </div>
                              <Switch
                                checked={localSettings.platforms.instagram_dm.conversation_starters_enabled}
                                disabled={updateSettingsMutation.isPending || !isPro}
                                onCheckedChange={(checked) => {
                                  const updated = {
                                    ...localSettings,
                                    platforms: {
                                      ...localSettings.platforms,
                                      instagram_dm: {
                                        ...localSettings.platforms.instagram_dm,
                                        conversation_starters_enabled: checked,
                                      },
                                    },
                                  };
                                  setLocalSettings(updated);
                                  handleAutoSaveSettings(updated);
                                }}
                              />
                            </div>

                            {localSettings.platforms.instagram_dm.conversation_starters_enabled && (
                              <div className="flex gap-3 flex-col">
                                <p className="text-sm text-muted-foreground">
                                  Users will see these options when starting a conversation (max 4, 20 characters each). Only visible in the Instagram mobile app, not on instagram.com.
                                </p>
                                <div className="space-y-2">
                                  {conversationStartersInput.instagram_dm.map(
                                    (starter, index) => (
                                      <div
                                        key={starter.id}
                                        className="flex gap-2 items-center p-3 rounded-lg border bg-muted/30"
                                      >
                                        {starter.is_default && (
                                          <Lock className="flex-shrink-0 w-4 h-4 text-muted-foreground" />
                                        )}
                                        <Input
                                          placeholder="Enter conversation starter..."
                                          value={starter.text}
                                          onChange={(e) =>
                                            handleUpdateConversationStarter(
                                              'instagram_dm',
                                              index,
                                              { text: e.target.value }
                                            )
                                          }
                                          disabled={
                                            !isPro ||
                                            updateConversationStartersMutation.isPending
                                          }
                                          maxLength={20}
                                          className="flex-1"
                                        />
                                        <Switch
                                          checked={starter.enabled}
                                          onCheckedChange={(checked) =>
                                            handleUpdateConversationStarter(
                                              'instagram_dm',
                                              index,
                                              { enabled: checked }
                                            )
                                          }
                                          disabled={
                                            !isPro ||
                                            updateConversationStartersMutation.isPending
                                          }
                                        />
                                        {starter.is_default &&
                                          conversationStartersData?.smart_scheduling
                                            ?.page_url && (
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={handleNavigateToSchedulingPage}
                                              disabled={
                                                !isPro ||
                                                updateConversationStartersMutation.isPending
                                              }
                                            >
                                              <ExternalLink className="w-4 h-4" />
                                              Visit Page
                                            </Button>
                                          )}
                                        {!starter.is_default && (
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() =>
                                              handleDeleteConversationStarter(
                                                'instagram_dm',
                                                index
                                              )
                                            }
                                            disabled={
                                              !isPro ||
                                              updateConversationStartersMutation.isPending
                                            }
                                          >
                                            <Trash2 className="w-4 h-4 text-destructive" />
                                          </Button>
                                        )}
                                      </div>
                                    )
                                  )}
                                  {conversationStartersInput.instagram_dm.length < 4 && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        handleAddConversationStarter('instagram_dm')
                                      }
                                      disabled={
                                        !isPro ||
                                        updateConversationStartersMutation.isPending
                                      }
                                      className="w-full"
                                    >
                                      <Plus className="w-4 h-4" />
                                      Add Starter
                                    </Button>
                                  )}
                                </div>
                                <Button
                                  onClick={handleSavePlatformStarters}
                                  disabled={
                                    !isPro || updateConversationStartersMutation.isPending
                                  }
                                  className="w-full"
                                >
                                  {updateConversationStartersMutation.isPending && (
                                    <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                                  )}
                                  Save Starters
                                </Button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {(!platform || platform === 'whatsapp') && (
                      <div className={cn('rounded-lg border', platform ? 'p-6 space-y-4' : 'p-4 space-y-4')}>
                        {!hasWhatsApp ? (
                          <div className="flex flex-col gap-6">
                            <div className="flex flex-col gap-4 justify-center items-center py-4">
                              <div className="flex justify-center items-center w-12 h-12 bg-green-500 rounded-full">
                                <Icon
                                  icon="mdi:whatsapp"
                                  className="w-6 h-6 text-white"
                                />
                              </div>
                              <div className="text-center">
                                <div className="font-medium">WhatsApp</div>
                                <div className="mt-1 text-sm text-muted-foreground">
                                  Connect your WhatsApp Business account
                                </div>
                              </div>
                              <Button
                                onClick={handleConnectWhatsApp}
                                disabled={
                                  !isPro ||
                                  connectWhatsAppMutation.isPending ||
                                  updateSettingsMutation.isPending
                                }
                                variant="outline"
                                size="sm"
                              >
                                {connectWhatsAppMutation.isPending ? (
                                  <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                                ) : (
                                  <Icon
                                    icon="mdi:whatsapp"
                                    className="mr-2 w-4 h-4"
                                  />
                                )}
                                Connect
                              </Button>
                            </div>
                            <div className="pt-4 border-t space-y-3">
                              <h4 className="text-sm font-medium text-foreground !mb-2">
                                Before you connect
                              </h4>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="flex gap-3 p-3 rounded-lg border bg-muted/40">
                                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                  <p className="text-sm text-muted-foreground">
                                    After clicking Connect, you'll be redirected to a new screen where a popup window will open to complete the connection. Some browsers (e.g., Microsoft Edge) block popups by default. If the connection does not complete, allow popups for this site in your browser settings and try again.
                                  </p>
                                </div>
                                <div className="flex gap-3 p-3 rounded-lg border bg-muted/40">
                                  <Smartphone className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                                  <p className="text-sm text-muted-foreground">
                                    If the phone number you want to connect is already registered with WhatsApp or WhatsApp Business on another device or app, you must remove it from that app first. A phone number can only be linked to one WhatsApp account at a time.
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex justify-between items-center">
                              <div className="flex flex-1 gap-3 items-center">
                                <div className="flex justify-center items-center w-10 h-10 bg-green-500 rounded-full">
                                  <Icon
                                    icon="mdi:whatsapp"
                                    className="w-5 h-5 text-white"
                                  />
                                </div>
                                <div className="flex-1">
                                  <div className="font-medium">WhatsApp</div>
                                  <div className="text-sm text-muted-foreground">
                                    {accounts.find(
                                      (acc) => acc.platform === 'whatsapp'
                                    )?.page_name || 'Connected'}
                                  </div>
                                </div>
                              </div>
                              <div className="flex gap-3 items-center">
                                <Button
                                  variant={
                                    localSettings.platforms.whatsapp.enabled
                                      ? 'outline'
                                      : 'default'
                                  }
                                  size="sm"
                                  disabled={updateSettingsMutation.isPending}
                                  onClick={() => {
                                    const updated = {
                                      ...localSettings,
                                      platforms: {
                                        ...localSettings.platforms,
                                        whatsapp: {
                                          ...localSettings.platforms.whatsapp,
                                          enabled:
                                            !localSettings.platforms.whatsapp
                                              .enabled,
                                        },
                                      },
                                    };
                                    setLocalSettings(updated);
                                    handleAutoSaveSettings(updated);
                                  }}
                                >
                                  {updateSettingsMutation.isPending && (
                                    <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                                  )}
                                  {localSettings.platforms.whatsapp.enabled
                                    ? 'Disable WhatsApp'
                                    : 'Enable WhatsApp'}
                                </Button>
                                {accounts
                                  .filter((acc) => acc.platform === 'whatsapp')
                                  .map((account) => (
                                    <Button
                                      key={account.id}
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleDeleteClick(account)}
                                      disabled={
                                        disconnectAccountMutation.isPending ||
                                        updateSettingsMutation.isPending
                                      }
                                    >
                                      <Trash2 className="w-4 h-4 text-destructive" />
                                    </Button>
                                  ))}
                              </div>
                            </div>

                            <div className="flex justify-between items-center pt-4 border-t">
                              <div className="flex gap-2 items-center">
                                <MessageSquare className="w-4 h-4 text-muted-foreground" />
                                <Label className="text-sm">Quick Messages</Label>
                              </div>
                              <Switch
                                checked={localSettings.platforms.whatsapp.conversation_starters_enabled}
                                disabled={updateSettingsMutation.isPending || !isPro}
                                onCheckedChange={(checked) => {
                                  const updated = {
                                    ...localSettings,
                                    platforms: {
                                      ...localSettings.platforms,
                                      whatsapp: {
                                        ...localSettings.platforms.whatsapp,
                                        conversation_starters_enabled: checked,
                                      },
                                    },
                                  };
                                  setLocalSettings(updated);
                                  handleAutoSaveSettings(updated);
                                }}
                              />
                            </div>

                            {localSettings.platforms.whatsapp.conversation_starters_enabled && (
                              <div className="flex gap-3 flex-col">
                                <p className="text-sm text-muted-foreground">
                                  Up to 3 quick reply buttons shown below each AI response when customers message you. Unlike Messenger/Instagram, these appear as tappable buttons with your AI reply rather than before the user types.
                                </p>
                                <div className="space-y-2">
                                  {conversationStartersInput.whatsapp.map(
                                    (starter, index) => (
                                      <div
                                        key={starter.id}
                                        className="flex gap-2 items-center p-3 rounded-lg border bg-muted/30"
                                      >
                                        {starter.is_default && (
                                          <Lock className="flex-shrink-0 w-4 h-4 text-muted-foreground" />
                                        )}
                                        <Input
                                          placeholder="Enter conversation starter..."
                                          value={starter.text}
                                          onChange={(e) =>
                                            handleUpdateConversationStarter(
                                              'whatsapp',
                                              index,
                                              { text: e.target.value }
                                            )
                                          }
                                          disabled={
                                            !isPro ||
                                            updateConversationStartersMutation.isPending
                                          }
                                          maxLength={20}
                                          className="flex-1"
                                        />
                                        <Switch
                                          checked={starter.enabled}
                                          onCheckedChange={(checked) =>
                                            handleUpdateConversationStarter(
                                              'whatsapp',
                                              index,
                                              { enabled: checked }
                                            )
                                          }
                                          disabled={
                                            !isPro ||
                                            updateConversationStartersMutation.isPending
                                          }
                                        />
                                        {starter.is_default &&
                                          conversationStartersData?.smart_scheduling
                                            ?.page_url && (
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={handleNavigateToSchedulingPage}
                                              disabled={
                                                !isPro ||
                                                updateConversationStartersMutation.isPending
                                              }
                                            >
                                              <ExternalLink className="w-4 h-4" />
                                              Visit Page
                                            </Button>
                                          )}
                                        {!starter.is_default && (
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() =>
                                              handleDeleteConversationStarter(
                                                'whatsapp',
                                                index
                                              )
                                            }
                                            disabled={
                                              !isPro ||
                                              updateConversationStartersMutation.isPending
                                            }
                                          >
                                            <Trash2 className="w-4 h-4 text-destructive" />
                                          </Button>
                                        )}
                                      </div>
                                    )
                                  )}
                                  {conversationStartersInput.whatsapp.length < 4 && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        handleAddConversationStarter('whatsapp')
                                      }
                                      disabled={
                                        !isPro ||
                                        updateConversationStartersMutation.isPending
                                      }
                                      className="w-full"
                                    >
                                      <Plus className="w-4 h-4" />
                                      Add Starter
                                    </Button>
                                  )}
                                </div>
                                <Button
                                  onClick={handleSavePlatformStarters}
                                  disabled={
                                    !isPro || updateConversationStartersMutation.isPending
                                  }
                                  className="w-full"
                                >
                                  {updateConversationStartersMutation.isPending && (
                                    <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                                  )}
                                  Save Starters
                                </Button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {!platform && (
                      <div className="flex flex-col gap-4 justify-center items-center p-4 py-4 h-full rounded-lg border opacity-60 cursor-not-allowed">
                        <div className="flex justify-center items-center w-12 h-12 bg-black rounded-full opacity-50">
                          <Icon
                            icon="ph:tiktok-logo-thin"
                            className="w-6 h-6 text-white [&_path]:stroke-[1.5] [&_path]:fill-none [&_path]:stroke-white"
                          />
                        </div>
                        <div className="text-center">
                          <div className="font-medium">TikTok</div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            Connect your TikTok Business account
                          </div>
                        </div>
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-muted text-muted-foreground">
                          Coming Soon
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Page Selection Dialog - Single Selection */}
        <Dialog open={showPageSelector} onOpenChange={setShowPageSelector}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Select a Page to Connect</DialogTitle>
              <DialogDescription>
                Please select one {selectedPlatform === 'instagram' ? 'Instagram account' : 'Facebook Page'} to connect. You can only connect one {selectedPlatform === 'instagram' ? 'Instagram account' : 'page'} per platform at a time.
              </DialogDescription>
            </DialogHeader>
            {pendingPagesQuery.isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : pendingPagesQuery.isError ? (
              <div className="py-8 text-center text-destructive">
                {pendingPagesQuery.error instanceof Error
                  ? pendingPagesQuery.error.message
                  : 'Failed to load pages. Please try connecting again.'}
              </div>
            ) : pendingPages.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                No pages found. Make sure you have admin access to at least one
                Facebook Page.
              </div>
            ) : (
              <RadioGroup value={selectedPage} onValueChange={setSelectedPage}>
                <div className="overflow-y-auto space-y-3 max-h-96">
                  {pendingPages.map((page: PendingPage) => (
                    <div
                      key={page.id}
                      className={cn(
                        'flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors',
                        selectedPage === page.id &&
                        'border-primary bg-primary/5'
                      )}
                      onClick={() => setSelectedPage(page.id)}
                    >
                      <RadioGroupItem value={page.id} id={page.id} className="mt-1" />
                      <label htmlFor={page.id} className="flex-1 cursor-pointer">
                        <div className="font-medium">{page.name}</div>
                        {page.instagram_business_account && (
                          <div className="flex gap-1 items-center mt-1 text-sm text-muted-foreground">
                            <Instagram className="w-3 h-3" />@
                            {page.instagram_business_account.username}
                          </div>
                        )}
                      </label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowPageSelector(false);
                  setSelectedPage('');
                  setTempToken('');
                  setSelectedPlatform('facebook');
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConnectPages}
                disabled={
                  !selectedPage || connectPagesMutation.isPending
                }
              >
                {connectPagesMutation.isPending && (
                  <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                )}
                Connect Page
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={deleteConfirmDialog.open}
          onOpenChange={(open) => !open && handleDeleteCancel()}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Connected Account</DialogTitle>
              <DialogDescription>
                This action cannot be undone. All data related to this account
                will be permanently removed from Helpmate.
              </DialogDescription>
            </DialogHeader>
            {deleteConfirmDialog.account && (
              <div className="py-4">
                <div className="flex gap-3 items-center p-4 rounded-lg border bg-muted/50">
                  <div
                    className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center',
                      deleteConfirmDialog.account.platform === 'instagram'
                        ? 'bg-gradient-to-br from-purple-500 to-pink-500'
                        : deleteConfirmDialog.account.platform === 'whatsapp'
                          ? 'bg-green-500'
                          : 'bg-blue-500'
                    )}
                  >
                    {getPlatformIcon(deleteConfirmDialog.account.platform)}
                  </div>
                  <div>
                    <div className="font-medium">
                      {deleteConfirmDialog.account.page_name}
                    </div>
                    <div className="text-sm capitalize text-muted-foreground">
                      {deleteConfirmDialog.account.platform}
                    </div>
                  </div>
                </div>
                <div className="p-4 mt-4 rounded-lg border bg-destructive/10 border-destructive/20">
                  <p className="mb-2 text-sm font-medium text-destructive">
                    Warning: This will delete:
                  </p>
                  <ul className="space-y-1 text-sm list-disc list-inside text-muted-foreground">
                    <li>All conversations for this account</li>
                    <li>All messages in those conversations</li>
                    <li>The account connection from Helpmate</li>
                    <li>Webhook subscriptions will be removed from Meta app</li>
                  </ul>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={handleDeleteCancel}
                disabled={disconnectAccountMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteConfirm}
                disabled={disconnectAccountMutation.isPending}
              >
                {disconnectAccountMutation.isPending && (
                  <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                )}
                Confirm Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Localhost Warning Dialog */}
        <Dialog
          open={showLocalhostWarning}
          onOpenChange={setShowLocalhostWarning}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Feature not available on localhost</DialogTitle>
            </DialogHeader>
            <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <p className="text-sm text-yellow-800 !my-0">
                ⚠️ Social platform connections are not available on localhost.
                Please deploy to a live server to connect social platforms.
              </p>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowLocalhostWarning(false)}
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* WhatsApp Register Result Dialog */}
        <Dialog
          open={!!whatsappRegisterDialog?.open}
          onOpenChange={(open) => {
            if (!open) {
              setWhatsappRegisterDialog(null);
              setRetryPinInput('');
            }
          }}
        >
          <DialogContent>
            {whatsappRegisterDialog?.success ? (
              <>
                <DialogHeader>
                  <DialogTitle>WhatsApp registered with META Cloud API</DialogTitle>
                  <DialogDescription>
                    Your number is now registered with WhatsApp Business Cloud
                    API.
                    {whatsappRegisterDialog.pins?.length ? (
                      <>
                        {' '}
                        You have {whatsappRegisterDialog.pins.length} number(s).{' '}
                        {whatsappRegisterDialog.pins.length === 1
                          ? `PIN: ${whatsappRegisterDialog.pins[0]}`
                          : `PINs: ${whatsappRegisterDialog.pins.join(', ')}`}
                        . Save them securely.
                      </>
                    ) : whatsappRegisterDialog.pin ? (
                      <>
                        {' '}
                        Your two-step verification PIN is:{' '}
                        <strong>{whatsappRegisterDialog.pin}</strong>. Save this
                        PIN securely—you will need it if you ever need to
                        re-register or recover your account.
                      </>
                    ) : null}
                  </DialogDescription>
                </DialogHeader>
                {(whatsappRegisterDialog.pin || whatsappRegisterDialog.pins?.length) && (
                  <div className="flex gap-2 items-center py-2">
                    <code className="flex-1 px-3 py-2 text-sm font-mono bg-muted rounded-md">
                      {whatsappRegisterDialog.pins?.join(', ') ??
                        whatsappRegisterDialog.pin}
                    </code>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() =>
                        handleCopyPin(
                          whatsappRegisterDialog.pins?.join(',') ??
                            whatsappRegisterDialog.pin ??
                            ''
                        )
                      }
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                )}
                <DialogFooter>
                  <Button
                    onClick={() => {
                      setWhatsappRegisterDialog(null);
                    }}
                  >
                    Close
                  </Button>
                </DialogFooter>
              </>
            ) : whatsappRegisterDialog?.retryToken &&
              (whatsappRegisterDialog?.errorCode === '133005' ||
                whatsappRegisterDialog?.wrongPinMessage) ? (
              <>
                <DialogHeader>
                  <DialogTitle>Enter your existing PIN</DialogTitle>
                  <DialogDescription>
                    This number already has two-step verification. Enter your
                    existing 6-digit PIN to register with Cloud API.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  {whatsappRegisterDialog.wrongPinMessage && (
                    <p className="text-sm text-destructive">
                      {whatsappRegisterDialog.wrongPinMessage}
                    </p>
                  )}
                  <div>
                    <Label htmlFor="retry-pin">6-digit PIN</Label>
                    <Input
                      id="retry-pin"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      placeholder="000000"
                      value={retryPinInput}
                      onChange={(e) => {
                        setRetryPinInput(e.target.value.replace(/\D/g, '').slice(0, 6));
                        setWhatsappRegisterDialog((d) =>
                          d ? { ...d, wrongPinMessage: undefined } : d
                        );
                      }}
                      className="mt-2 font-mono text-lg tracking-widest"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setWhatsappRegisterDialog(null);
                      setRetryPinInput('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleRegisterRetry}
                    disabled={
                      registerRetryMutation.isPending || retryPinInput.length !== 6
                    }
                  >
                    {registerRetryMutation.isPending && (
                      <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                    )}
                    Try again
                  </Button>
                </DialogFooter>
              </>
            ) : whatsappRegisterDialog?.errorCode === 'EXPIRED' ? (
              <>
                <DialogHeader>
                  <DialogTitle>Session expired</DialogTitle>
                  <DialogDescription>
                    {whatsappRegisterDialog.errorMessage}
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    onClick={() => {
                      setWhatsappRegisterDialog(null);
                    }}
                  >
                    Close
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>WhatsApp registration issue</DialogTitle>
                  <DialogDescription>
                    {getWhatsAppRegisterErrorMessage(
                      whatsappRegisterDialog?.errorCode,
                      whatsappRegisterDialog?.errorMessage
                    ) ||
                      whatsappRegisterDialog?.errorMessage ||
                      'Registration failed. Please try again later.'}
                  </DialogDescription>
                </DialogHeader>
                <div className="text-sm">
                  <a
                    href="https://developers.facebook.com/docs/whatsapp/cloud-api/reference/registration/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Meta WhatsApp registration docs
                  </a>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => {
                      setWhatsappRegisterDialog(null);
                    }}
                  >
                    Close
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </PageGuard>
  );
}
