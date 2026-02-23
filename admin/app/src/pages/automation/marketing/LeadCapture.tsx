import PageGuard from '@/components/PageGuard';
import PageHeader from '@/components/PageHeader';
import { ProBadgeInline } from '@/components/ProBadge';
import { ReusableTable } from '@/components/ReusableTable';
import { CampaignForm } from '@/components/social/SocialLeadCampaignComponents';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
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
import { useSettings } from '@/hooks/useSettings';
import {
  SocialLeadCampaign,
  useSocialChat
} from '@/hooks/useSocialChat';
import { cn } from '@/lib/utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnDef } from '@tanstack/react-table';
import { formatDistanceToNow } from 'date-fns';
import {
  Pencil,
  Plus,
  Trash2
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

export default function LeadCapture() {
  const { getProQuery } = useSettings();
  const isPro = getProQuery.data ?? false;
  const {
    getSettingsQuery,
    updateSettingsMutation,
    getLeadCampaignsQuery,
    deleteLeadCampaignMutation,
  } = useSocialChat();

  const [localSettings, setLocalSettings] = useState({
    leads_enabled: false,
    collect_lead: false,
  });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] =
    useState<SocialLeadCampaign | null>(null);

  // Collect Lead form
  const collectLeadForm = useForm({
    defaultValues: {
      lead_form_fields: ['name', 'email', 'message'],
    },
    resolver: zodResolver(
      z.object({
        lead_form_fields: z.array(z.string()),
      })
    ),
  });

  // Load settings
  useEffect(() => {
    getSettingsQuery.refetch();
  }, []);

  useEffect(() => {
    if (getSettingsQuery.data) {
      const settings = getSettingsQuery.data;
      setLocalSettings({
        leads_enabled: settings.leads_enabled ?? false,
        collect_lead: settings.collect_lead ?? false,
      });
      collectLeadForm.reset({
        lead_form_fields: (settings.lead_form_fields as string[]) || [
          'name',
          'email',
          'message',
        ],
      });
    }
  }, [getSettingsQuery.data, collectLeadForm]);

  const handleAutoSaveSettings = (updated: typeof localSettings) => {
    updateSettingsMutation.mutate({
      leads_enabled: updated.leads_enabled,
    });
  };

  const handleAutoSaveCollectLead = (updated: typeof localSettings) => {
    updateSettingsMutation.mutate({
      collect_lead: updated.collect_lead,
    });
  };

  const handleSaveCollectLead = (data: {
    lead_form_fields: string[];
  }) => {
    updateSettingsMutation.mutate({
      lead_form_fields: data.lead_form_fields,
    });
  };

  // Filter campaigns to only show lead type
  const campaigns = (getLeadCampaignsQuery.data ?? []).filter(
    (c) => c.campaign_type === 'lead'
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
        <span className="capitalize">{row.original.platform}</span>
      ),
    },
    {
      accessorKey: 'fields',
      header: 'Collects',
      cell: ({ row }) => {
        const fields = [];
        if (row.original.collect_email) fields.push('Email');
        if (row.original.collect_phone) fields.push('Phone');
        if (row.original.collect_address) fields.push('Address');
        return <div>{fields.join(', ') || 'None'}</div>;
      },
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

  const handleCreate = () => {
    setEditingCampaign(null);
    setIsFormOpen(true);
  };

  const handleClose = () => {
    setIsFormOpen(false);
    setEditingCampaign(null);
  };

  return (
    <PageGuard page="automation-marketing-lead-capture">
      <div className="gap-0">
        <PageHeader title="Lead Capture" />
        <div className="flex flex-col gap-6 p-6">
          {/* Social */}
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
                      Social
                      {!isPro && <ProBadgeInline />}
                      <InfoTooltip message="Create automations with keywords. When users comment with your automation keywords on Facebook or Instagram posts, they'll receive an automated direct message with automation details and a 'Claim the Deal' button." />
                    </CardTitle>
                  </div>
                  <div className="flex gap-2 items-center">
                    {localSettings.leads_enabled && (
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
                      {localSettings.leads_enabled ? 'Enabled' : 'Disabled'}
                    </Label>
                    <Switch
                      checked={localSettings.leads_enabled}
                      disabled={updateSettingsMutation.isPending || !isPro}
                      onCheckedChange={(checked) => {
                        const updated = {
                          ...localSettings,
                          leads_enabled: checked,
                        };
                        setLocalSettings(updated);
                        handleAutoSaveSettings(updated);
                      }}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="relative">
                {localSettings.leads_enabled && (
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
                          generating leads from comments.
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
                            campaignType="lead"
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

          {/* Collect Lead from Chatbot */}
          <Card className="gap-0">
            <CardHeader className="gap-0">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="flex gap-1 items-center !text-lg">
                    Website
                    <InfoTooltip message="When enabled, the chatbot will collect lead information at the start of the conversation." />
                  </CardTitle>
                </div>
                <div className="flex gap-2 items-center">
                  <Label className="text-sm">
                    {localSettings.collect_lead ? 'Enabled' : 'Disabled'}
                  </Label>
                  <Switch
                    checked={localSettings.collect_lead}
                    disabled={updateSettingsMutation.isPending}
                    onCheckedChange={(checked) => {
                      const updated = {
                        ...localSettings,
                        collect_lead: checked,
                      };
                      setLocalSettings(updated);
                      handleAutoSaveCollectLead(updated);
                    }}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative">
              {localSettings.collect_lead && (
                <div className="pt-4 mt-4 space-y-4 border-t">
                  <Form {...collectLeadForm}>
                    <form
                      onSubmit={collectLeadForm.handleSubmit(
                        handleSaveCollectLead
                      )}
                      className="space-y-6"
                    >
                      <FormField
                        control={collectLeadForm.control}
                        name="lead_form_fields"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Lead Form Fields</FormLabel>
                            <FormControl>
                              <div className="flex flex-wrap gap-2">
                                {[
                                  'name',
                                  'email',
                                  'phone',
                                  'website',
                                  'message',
                                ].map((fieldName) => (
                                  <Button
                                    key={fieldName}
                                    type="button"
                                    variant={
                                      (field.value || []).includes(fieldName)
                                        ? 'secondary'
                                        : 'outline'
                                    }
                                    onClick={() => {
                                      const currentValue = field.value || [];
                                      const newValue = currentValue.includes(
                                        fieldName
                                      )
                                        ? currentValue.filter(
                                            (v) => v !== fieldName
                                          )
                                        : [...currentValue, fieldName];
                                      field.onChange(newValue);
                                    }}
                                    className="capitalize"
                                  >
                                    {fieldName}
                                  </Button>
                                ))}
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button
                        type="submit"
                        disabled={updateSettingsMutation.isPending}
                        loading={updateSettingsMutation.isPending}
                      >
                        {updateSettingsMutation.isPending
                          ? 'Saving...'
                          : 'Save'}
                      </Button>
                    </form>
                  </Form>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageGuard>
  );
}
