import { Button } from '@/components/ui/button';
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
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { useSettings } from '@/hooks/useSettings';
import api from '@/lib/axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

type MembersStatus = {
  active: boolean;
  enabled: boolean;
  member_count: number;
};

type SyncSummary = {
  processed: number;
  created: number;
  updated: number;
  skipped_no_email: number;
  errors: Array<{ user_id: number; message: string }>;
  limit: number;
  offset: number;
};

type IntegrationsSettings = {
  members?: {
    enabled?: boolean;
  };
  [key: string]: unknown;
};

type MembersIntegrationSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  membersPluginActive: boolean;
};

export default function MembersIntegrationSheet({
  open,
  onOpenChange,
  membersPluginActive,
}: MembersIntegrationSheetProps) {
  const queryClient = useQueryClient();
  const { updateSettingsMutation } = useSettings();
  const [syncConfirmOpen, setSyncConfirmOpen] = useState(false);
  const [syncLimit, setSyncLimit] = useState('50');
  const [syncOffset, setSyncOffset] = useState('0');
  const [lastSummary, setLastSummary] = useState<SyncSummary | null>(null);

  const statusQuery = useQuery<MembersStatus>({
    queryKey: ['integrations-members-status'],
    queryFn: async () => {
      const response = await api.get<{ error: boolean; data: MembersStatus }>('/integrations/members');
      return response.data.data;
    },
    enabled: open && membersPluginActive,
    refetchOnWindowFocus: false,
  });

  const integrationsSettingsQuery = useQuery<IntegrationsSettings>({
    queryKey: ['settings', 'integrations'],
    queryFn: async () => {
      const response = await api.get('/settings/integrations');
      return (response.data ?? {}) as IntegrationsSettings;
    },
    enabled: open,
    refetchOnWindowFocus: false,
  });

  const enabled = useMemo(() => {
    if (statusQuery.data) return !!statusQuery.data.enabled;
    return !!integrationsSettingsQuery.data?.members?.enabled;
  }, [statusQuery.data, integrationsSettingsQuery.data]);

  const saveEnabledMutation = useMutation({
    mutationFn: async (nextEnabled: boolean) => {
      const existing = integrationsSettingsQuery.data ?? {};
      const payload: IntegrationsSettings = {
        ...existing,
        members: {
          ...(typeof existing.members === 'object' && existing.members ? existing.members : {}),
          enabled: nextEnabled,
        },
      };
      await updateSettingsMutation.mutateAsync({
        key: 'integrations',
        data: payload,
      });
    },
    onSuccess: async () => {
      toast.success('Members integration setting saved.');
      await queryClient.invalidateQueries({ queryKey: ['settings', 'integrations'] });
      await statusQuery.refetch();
    },
    onError: () => {
      toast.error('Could not save Members integration setting.');
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const limit = Math.max(1, Math.min(200, Number.parseInt(syncLimit, 10) || 50));
      const offset = Math.max(0, Number.parseInt(syncOffset, 10) || 0);
      const response = await api.post<{
        error: boolean;
        summary?: SyncSummary;
        message?: string;
      }>('/integrations/members/sync-members', { limit, offset });
      return response.data;
    },
    onSuccess: async (data) => {
      setSyncConfirmOpen(false);
      if (data.error) {
        toast.error(data.message ?? 'Sync failed.');
        return;
      }
      if (data.summary) {
        setLastSummary(data.summary);
        toast.success(
          `Processed: ${data.summary.processed}, created: ${data.summary.created}, updated: ${data.summary.updated}, skipped: ${data.summary.skipped_no_email}`
        );
      } else {
        toast.success('Sync completed.');
      }

      await queryClient.invalidateQueries({ queryKey: ['crm-contacts'] });
      await queryClient.invalidateQueries({
        queryKey: ['crm-contact-integration-source-options'],
      });
      await statusQuery.refetch();
    },
    onError: () => {
      toast.error('Sync failed.');
    },
  });

  const canSync = membersPluginActive && statusQuery.data?.active === true && !syncMutation.isPending;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex flex-col w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Members</SheetTitle>
          </SheetHeader>

          <div className="flex flex-col gap-4 p-4">
            {!membersPluginActive ? (
              <p className="text-sm text-muted-foreground">
                Install and activate Members to enable this integration.
              </p>
            ) : !statusQuery.data?.active ? (
              <p className="text-sm text-muted-foreground">
                Members is active but runtime is not fully loaded yet. Refresh after it initializes.
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Detected members (v1: total WP users): {statusQuery.data.member_count ?? 0}
                  </p>
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div className="space-y-1">
                      <Label htmlFor="members-integration-enabled">
                        Enable Members integration events
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        When enabled, Helpmate records Members lifecycle events and syncs role data
                        to CRM.
                      </p>
                    </div>
                    <Switch
                      id="members-integration-enabled"
                      checked={enabled}
                      disabled={saveEnabledMutation.isPending}
                      onCheckedChange={(next) => saveEnabledMutation.mutate(next)}
                    />
                  </div>
                </div>

                <div className="border-t pt-4 space-y-3">
                  <div className="space-y-2">
                    <Label>Manual sync controls</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="members-sync-limit" className="text-xs">
                          Limit
                        </Label>
                        <Input
                          id="members-sync-limit"
                          type="number"
                          min={1}
                          max={200}
                          value={syncLimit}
                          onChange={(e) => setSyncLimit(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="members-sync-offset" className="text-xs">
                          Offset
                        </Label>
                        <Input
                          id="members-sync-offset"
                          type="number"
                          min={0}
                          value={syncOffset}
                          onChange={(e) => setSyncOffset(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!canSync}
                    onClick={() => setSyncConfirmOpen(true)}
                  >
                    Sync members to CRM
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    One-way import from Members. Contacts are matched by email and member profile
                    fields may be overwritten by Members values.
                  </p>
                </div>

                {lastSummary ? (
                  <div className="rounded-md border p-3 space-y-1 text-xs text-muted-foreground">
                    <p>Last sync:</p>
                    <p>
                      Processed {lastSummary.processed} | Created {lastSummary.created} | Updated{' '}
                      {lastSummary.updated} | Skipped (no email) {lastSummary.skipped_no_email}
                    </p>
                    {lastSummary.errors?.length ? (
                      <p className="text-destructive">
                        Errors: {lastSummary.errors.length} (last:{' '}
                        {lastSummary.errors[lastSummary.errors.length - 1]?.message ?? 'Unknown'})
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </>
            )}
          </div>

          <SheetFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Dialog open={syncConfirmOpen} onOpenChange={setSyncConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sync Members users to CRM?</DialogTitle>
            <DialogDescription className="space-y-2 text-left">
              <span className="block">
                Existing CRM contacts with the <strong>same email</strong> as a Members user can be
                updated from that profile.
              </span>
              <span className="block text-destructive">
                This bulk update cannot be undone automatically. Export or back up CRM data first if
                unsure.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setSyncConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={syncMutation.isPending}
              onClick={() => syncMutation.mutate()}
            >
              {syncMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  Syncing...
                </>
              ) : (
                'Yes, sync now'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

