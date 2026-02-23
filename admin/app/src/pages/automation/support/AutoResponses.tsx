import PageGuard from '@/components/PageGuard';
import PageHeader from '@/components/PageHeader';
import { ProBadge, ProBadgeInline } from '@/components/ProBadge';
import { ReusableTable } from '@/components/ReusableTable';
import { CampaignForm } from '@/components/social/SocialLeadCampaignComponents';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useMain } from '@/contexts/MainContext';
import { useSettings } from '@/hooks/useSettings';
import {
  SocialLeadCampaign,
  useSocialChat,
} from '@/hooks/useSocialChat';
import { cn } from '@/lib/utils';
import { Icon } from '@iconify/react';
import { ColumnDef } from '@tanstack/react-table';
import { formatDistanceToNow } from 'date-fns';
import { Check, Facebook, Instagram, Link2, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

const WHATSAPP_CONNECT_INFO = `<strong>Before you connect</strong><br/><br/>• After clicking Connect, you'll be redirected to a new screen where a popup window will open to complete the connection. Some browsers (e.g., Microsoft Edge) block popups by default. If the connection does not complete, allow popups for this site in your browser settings and try again.<br/><br/>• If the phone number you want to connect is already registered with WhatsApp or WhatsApp Business on another device or app, you must remove it from that app first. A phone number can only be linked to one WhatsApp account at a time.`;

export default function AutoResponses() {
  const { setPage } = useMain();
  const { getProQuery } = useSettings();
  const isPro = getProQuery.data ?? false;
  const {
    getAccountsQuery,
    getSettingsQuery,
    updateSettingsMutation,
    getLeadCampaignsQuery,
    deleteLeadCampaignMutation,
    connectFacebookPageMutation,
    connectInstagramMutation,
    connectWhatsAppMutation,
  } = useSocialChat();

  const [localSettings, setLocalSettings] = useState({
    platforms: {
      messenger: {
        enabled: true,
        auto_reply: true,
        comment_auto_reply: true,
      },
      instagram_dm: {
        enabled: true,
        auto_reply: true,
        comment_auto_reply: true,
      },
      whatsapp: {
        enabled: true,
        auto_reply: true,
      },
      comments: {
        enabled: false,
      },
    },
  });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] =
    useState<SocialLeadCampaign | null>(null);

  const settings = getSettingsQuery.data;
  const accounts = getAccountsQuery.data?.accounts ?? [];

  // Check if accounts exist for each platform
  const hasFacebookPage = accounts.some((acc) => acc.platform === 'messenger');
  const hasInstagram = accounts.some((acc) => acc.platform === 'instagram');
  const hasWhatsApp = accounts.some((acc) => acc.platform === 'whatsapp');

  // Sync local settings with fetched settings
  useEffect(() => {
    if (settings) {
      setLocalSettings({
        platforms: {
          messenger: {
            enabled: true,
            auto_reply: settings.platforms.messenger?.auto_reply ?? true,
            comment_auto_reply: settings.platforms.messenger?.comment_auto_reply ?? true,
          },
          instagram_dm: {
            enabled: true,
            auto_reply: settings.platforms.instagram_dm?.auto_reply ?? true,
            comment_auto_reply: settings.platforms.instagram_dm?.comment_auto_reply ?? true,
          },
          whatsapp: {
            enabled: true,
            auto_reply: settings.platforms.whatsapp?.auto_reply ?? true,
          },
          comments: {
            enabled: settings.platforms.comments?.enabled ?? false,
          },
        },
      });
    }
  }, [settings]);

  const handleAutoSaveSettings = (updatedSettings: typeof localSettings) => {
    updateSettingsMutation.mutate({
      platforms: {
        messenger: {
          enabled: localSettings.platforms.messenger.enabled,
          auto_reply: updatedSettings.platforms.messenger.auto_reply,
          comment_auto_reply: updatedSettings.platforms.messenger.comment_auto_reply,
        },
        instagram_dm: {
          enabled: localSettings.platforms.instagram_dm.enabled,
          auto_reply: updatedSettings.platforms.instagram_dm.auto_reply,
          comment_auto_reply: updatedSettings.platforms.instagram_dm.comment_auto_reply,
        },
        whatsapp: {
          enabled: localSettings.platforms.whatsapp.enabled,
          auto_reply: updatedSettings.platforms.whatsapp.auto_reply,
        },
        comments: {
          enabled: localSettings.platforms.comments.enabled,
        },
      },
    });
  };

  const handleAutoSaveCustomMessages = (updated: typeof localSettings) => {
    updateSettingsMutation.mutate({
      platforms: {
        messenger: {
          enabled: localSettings.platforms.messenger.enabled,
          auto_reply: localSettings.platforms.messenger.auto_reply,
          comment_auto_reply: localSettings.platforms.messenger.comment_auto_reply,
        },
        instagram_dm: {
          enabled: localSettings.platforms.instagram_dm.enabled,
          auto_reply: localSettings.platforms.instagram_dm.auto_reply,
          comment_auto_reply: localSettings.platforms.instagram_dm.comment_auto_reply,
        },
        whatsapp: {
          enabled: localSettings.platforms.whatsapp.enabled,
          auto_reply: localSettings.platforms.whatsapp.auto_reply,
        },
        comments: {
          enabled: updated.platforms.comments.enabled,
        },
      },
    });
  };

  const handleCreate = () => {
    setEditingCampaign(null);
    setIsFormOpen(true);
  };

  const handleClose = () => {
    setIsFormOpen(false);
    setEditingCampaign(null);
  };

  // Filter campaigns to only show custom_message type
  const campaigns = (getLeadCampaignsQuery.data ?? []).filter(
    (c) => c.campaign_type === 'custom_message'
  );

  const columns: ColumnDef<SocialLeadCampaign>[] = [
    {
      accessorKey: 'title',
      header: 'Title',
      cell: ({ row }) => (
        <div className="font-medium">{row.original.title}</div>
      ),
    },
    {
      accessorKey: 'keywords',
      header: 'Keyword',
      cell: ({ row }) => (
        <div className="font-mono text-sm">{row.original.keywords}</div>
      ),
    },
    {
      accessorKey: 'platform',
      header: 'Platform',
      cell: ({ row }) => (
        <div className="capitalize">
          {row.original.platform === 'facebook' ? 'Facebook' : 'Instagram'}
        </div>
      ),
    },
    {
      accessorKey: 'created_at',
      header: 'Created',
      cell: ({ row }) =>
        formatDistanceToNow(new Date(row.original.created_at * 1000), {
          addSuffix: true,
        }),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex gap-2 justify-end items-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditingCampaign(row.original);
              setIsFormOpen(true);
            }}
            disabled={!isPro}
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (confirm('Are you sure you want to delete this automation?')) {
                deleteLeadCampaignMutation.mutate(row.original.id);
              }
            }}
            disabled={!isPro || deleteLeadCampaignMutation.isPending}
          >
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <PageGuard page="automation-support-auto-responses">
      <div className="gap-0">
        <PageHeader title="Auto DM and Comments" />
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
                'gap-0'
              )}
            >
              <CardHeader className="gap-0">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="flex gap-1 items-center !text-lg">
                      <Link2 className="w-5 h-5" />
                      Social Chat Platforms
                      <InfoTooltip message="Connect Facebook, Instagram, and WhatsApp to manage all your social conversations in one place. Enable AI-powered auto-replies for each platform." />
                    </CardTitle>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage('social-chat')}
                  >
                    Manage Accounts
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="relative space-y-6">
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

                <div className="grid grid-cols-1 gap-4 pt-4 mt-4 border-t md:grid-cols-2">
                  {/* Facebook */}
                  <div className="flex justify-between items-center p-4 rounded-lg border flex-wrap gap-4">
                    <div className="flex flex-1 gap-3 items-center">
                      <div className="flex relative justify-center items-center w-10 h-10 bg-blue-500 rounded-full">
                        <Facebook className="w-5 h-5 text-white" />
                        {hasFacebookPage && (
                          <div className="flex absolute -bottom-0.5 -right-0.5 justify-center items-center w-4 h-4 bg-green-500 rounded-full border-2 border-background">
                            <Check className="w-2.5 h-2.5 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">Facebook</div>
                        <div className="text-sm text-muted-foreground">
                          {hasFacebookPage
                            ? accounts.find(
                              (acc) => acc.platform === 'messenger'
                            )?.page_name || 'Connected'
                            : 'Connect your Facebook Page'}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-3 items-center">
                      {!hasFacebookPage ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            connectFacebookPageMutation.mutate({
                              returnTo: 'automation-support-auto-responses',
                            })
                          }
                          disabled={!isPro || connectFacebookPageMutation.isPending}
                        >
                          {connectFacebookPageMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            'Connect'
                          )}
                        </Button>
                      ) : (
                        <>
                          <div className="flex gap-2 items-center">
                            <Label className="text-sm">AI DM</Label>
                            <Switch
                              checked={
                                localSettings.platforms.messenger.auto_reply
                              }
                              disabled={updateSettingsMutation.isPending}
                              onCheckedChange={(checked) => {
                                const updated = {
                                  ...localSettings,
                                  platforms: {
                                    ...localSettings.platforms,
                                    messenger: {
                                      ...localSettings.platforms.messenger,
                                      auto_reply: checked,
                                    },
                                  },
                                };
                                setLocalSettings(updated);
                                handleAutoSaveSettings(updated);
                              }}
                            />
                          </div>
                          <div className="flex gap-2 items-center">
                            <Label className="text-sm">AI Comment</Label>
                            <Switch
                              checked={
                                localSettings.platforms.messenger.comment_auto_reply
                              }
                              disabled={updateSettingsMutation.isPending}
                              onCheckedChange={(checked) => {
                                const updated = {
                                  ...localSettings,
                                  platforms: {
                                    ...localSettings.platforms,
                                    messenger: {
                                      ...localSettings.platforms.messenger,
                                      comment_auto_reply: checked,
                                    },
                                  },
                                };
                                setLocalSettings(updated);
                                handleAutoSaveSettings(updated);
                              }}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Instagram */}
                  <div className="flex justify-between items-center p-4 rounded-lg border flex-wrap gap-4">
                    <div className="flex flex-1 gap-3 items-center">
                      <div className="flex relative justify-center items-center w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full">
                        <Instagram className="w-5 h-5 text-white" />
                        {hasInstagram && (
                          <div className="flex absolute -bottom-0.5 -right-0.5 justify-center items-center w-4 h-4 bg-green-500 rounded-full border-2 border-background">
                            <Check className="w-2.5 h-2.5 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">Instagram</div>
                        <div className="text-sm text-muted-foreground">
                          {hasInstagram
                            ? accounts.find(
                              (acc) => acc.platform === 'instagram'
                            )?.page_name || 'Connected'
                            : 'Connect your Instagram Business account'}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-3 items-center">
                      {!hasInstagram ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            connectInstagramMutation.mutate({
                              returnTo: 'automation-support-auto-responses',
                            })
                          }
                          disabled={!isPro || connectInstagramMutation.isPending}
                        >
                          {connectInstagramMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            'Connect'
                          )}
                        </Button>
                      ) : (
                        <>
                          <div className="flex gap-2 items-center">
                            <Label className="text-sm">AI DM</Label>
                            <Switch
                              checked={
                                localSettings.platforms.instagram_dm.auto_reply
                              }
                              disabled={updateSettingsMutation.isPending}
                              onCheckedChange={(checked) => {
                                const updated = {
                                  ...localSettings,
                                  platforms: {
                                    ...localSettings.platforms,
                                    instagram_dm: {
                                      ...localSettings.platforms.instagram_dm,
                                      auto_reply: checked,
                                    },
                                  },
                                };
                                setLocalSettings(updated);
                                handleAutoSaveSettings(updated);
                              }}
                            />
                          </div>
                          <div className="flex gap-2 items-center">
                            <Label className="text-sm">AI Comment</Label>
                            <Switch
                              checked={
                                localSettings.platforms.instagram_dm.comment_auto_reply
                              }
                              disabled={updateSettingsMutation.isPending}
                              onCheckedChange={(checked) => {
                                const updated = {
                                  ...localSettings,
                                  platforms: {
                                    ...localSettings.platforms,
                                    instagram_dm: {
                                      ...localSettings.platforms.instagram_dm,
                                      comment_auto_reply: checked,
                                    },
                                  },
                                };
                                setLocalSettings(updated);
                                handleAutoSaveSettings(updated);
                              }}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* WhatsApp */}
                  <div className="flex justify-between items-center p-4 rounded-lg border flex-wrap gap-4">
                    <div className="flex flex-1 gap-3 items-center">
                      <div className="flex relative justify-center items-center w-10 h-10 bg-green-500 rounded-full">
                        <Icon
                          icon="mdi:whatsapp"
                          className="w-5 h-5 text-white"
                        />
                        {hasWhatsApp && (
                          <div className="flex absolute -bottom-0.5 -right-0.5 justify-center items-center w-4 h-4 bg-green-500 rounded-full border-2 border-background">
                            <Check className="w-2.5 h-2.5 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">WhatsApp</div>
                        <div className="text-sm text-muted-foreground">
                          {hasWhatsApp
                            ? accounts.find(
                              (acc) => acc.platform === 'whatsapp'
                            )?.page_name || 'Connected'
                            : 'Connect your WhatsApp Business account'}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-3 items-center">
                      {!hasWhatsApp ? (
                        <>
                          <InfoTooltip message={WHATSAPP_CONNECT_INFO} />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              connectWhatsAppMutation.mutate({
                                returnTo: 'automation-support-auto-responses',
                              })
                            }
                            disabled={!isPro || connectWhatsAppMutation.isPending}
                          >
                            {connectWhatsAppMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              'Connect'
                            )}
                          </Button>
                        </>
                      ) : (
                        <div className="flex gap-2 items-center">
                          <Label className="text-sm">AI DM</Label>
                          <Switch
                            checked={
                              localSettings.platforms.whatsapp.auto_reply
                            }
                            disabled={updateSettingsMutation.isPending}
                            onCheckedChange={(checked) => {
                              const updated = {
                                ...localSettings,
                                platforms: {
                                  ...localSettings.platforms,
                                  whatsapp: {
                                    ...localSettings.platforms.whatsapp,
                                    auto_reply: checked,
                                  },
                                },
                              };
                              setLocalSettings(updated);
                              handleAutoSaveSettings(updated);
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* TikTok - Coming Soon */}
                  <div className="flex justify-between items-center p-4 rounded-lg border flex-wrap gap-4 opacity-60 cursor-not-allowed">
                    <div className="flex flex-1 gap-3 items-center">
                      <div className="flex justify-center items-center w-10 h-10 bg-black rounded-full">
                        <Icon
                          icon="ph:tiktok-logo-thin"
                          className="w-6 h-6 text-white [&_path]:stroke-[1.5] [&_path]:fill-none [&_path]:stroke-white"
                        />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">TikTok</div>
                        <div className="text-sm text-muted-foreground">
                          Connect your TikTok Business account
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-3 items-center">
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-muted text-muted-foreground">
                        Coming Soon
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* DM for Comments */}
          <div className="relative">
            <Card
              className={cn(
                !isPro && 'opacity-50 cursor-not-allowed pointer-events-none',
                'gap-0'
              )}
            >
              <CardHeader className="gap-0">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="flex gap-1 items-center !text-lg">
                      DM for Comments
                      {!isPro && <ProBadgeInline />}
                      <InfoTooltip message="Create automations with keywords. When users comment with your automation keywords on Facebook or Instagram posts, they'll receive an automated direct message with your custom message." />
                    </CardTitle>
                  </div>
                  <div className="flex gap-2 items-center">
                    {localSettings.platforms.comments.enabled && (
                      <Button
                        onClick={handleCreate}
                        variant="outline"
                        disabled={!isPro}
                        size="sm"
                      >
                        <Plus className="w-4 h-4" />
                        Create Automation
                      </Button>
                    )}
                    <Label className="text-sm">
                      {localSettings.platforms.comments.enabled
                        ? 'Enabled'
                        : 'Disabled'}
                    </Label>
                    <Switch
                      checked={localSettings.platforms.comments.enabled}
                      disabled={updateSettingsMutation.isPending || !isPro}
                      onCheckedChange={(checked) => {
                        const updated = {
                          ...localSettings,
                          platforms: {
                            ...localSettings.platforms,
                            comments: {
                              ...localSettings.platforms.comments,
                              enabled: checked,
                            },
                          },
                        };
                        setLocalSettings(updated);
                        handleAutoSaveCustomMessages(updated);
                      }}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="relative">
                {localSettings.platforms.comments.enabled && (
                  <div className="pt-4 mt-4 space-y-4 border-t">
                    {getLeadCampaignsQuery.isLoading ? (
                      <div className="space-y-2">
                        <Skeleton className="w-full h-10" />
                        <Skeleton className="w-full h-10" />
                        <Skeleton className="w-full h-10" />
                      </div>
                    ) : campaigns.length === 0 ? (
                      <div className="flex flex-col justify-center items-center py-12 text-center rounded-lg border">
                        <p className="text-muted-foreground">
                          No automations yet. Create your first automation to start
                          sending custom messages from comments.
                        </p>
                      </div>
                    ) : (
                      <ReusableTable
                        data={campaigns}
                        columns={columns}
                        rightAlignedColumns={['actions']}
                      />
                    )}

                    <Sheet open={isFormOpen} onOpenChange={handleClose}>
                      <SheetContent className="sm:!max-w-2xl">
                        <SheetHeader>
                          <SheetTitle>
                            {editingCampaign
                              ? 'Edit Automation'
                              : 'Create Automation'}
                          </SheetTitle>
                        </SheetHeader>
                        <div className="overflow-y-auto flex-1 p-4 pt-6">
                          <CampaignForm
                            campaign={editingCampaign}
                            campaignType="custom_message"
                            onClose={handleClose}
                          />
                        </div>
                      </SheetContent>
                    </Sheet>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PageGuard>
  );
}
