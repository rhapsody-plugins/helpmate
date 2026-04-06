import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

export type WcfmIntegrationSettings = {
  show_vendor_in_orders_tab: boolean;
  show_vendor_in_training_products: boolean;
  show_vendor_in_product_lists: boolean;
};

const DEFAULT_WCFM: WcfmIntegrationSettings = {
  show_vendor_in_orders_tab: false,
  show_vendor_in_training_products: false,
  show_vendor_in_product_lists: false,
};

type WcfmIntegrationSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wcfmPluginActive: boolean;
};

type SyncSummary = {
  created: number;
  updated: number;
  skipped_no_email: number;
  errors: Array<{ email: string; message: string }>;
};

export default function WcfmIntegrationSheet({
  open,
  onOpenChange,
  wcfmPluginActive,
}: WcfmIntegrationSheetProps) {
  const queryClient = useQueryClient();
  const { updateSettingsMutation } = useSettings();
  const [local, setLocal] = useState<WcfmIntegrationSettings>(DEFAULT_WCFM);
  const [syncConfirmOpen, setSyncConfirmOpen] = useState(false);

  const settingsQuery = useQuery<WcfmIntegrationSettings, Error>({
    queryKey: ['settings', 'wcfm_integration'],
    queryFn: async () => {
      const response = await api.get<Partial<WcfmIntegrationSettings>>('/settings/wcfm_integration');
      return { ...DEFAULT_WCFM, ...(response.data ?? {}) };
    },
    enabled: open,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (settingsQuery.data) {
      setLocal({ ...DEFAULT_WCFM, ...settingsQuery.data });
    }
  }, [settingsQuery.data]);

  const save = useCallback(async () => {
    await updateSettingsMutation.mutateAsync({
      key: 'wcfm_integration',
      data: local,
    });
    await queryClient.invalidateQueries({ queryKey: ['settings', 'wcfm_integration'] });
    toast.success('WCFM settings saved.');
  }, [local, queryClient, updateSettingsMutation]);

  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post<{
        error: boolean;
        summary?: SyncSummary;
        message?: string;
      }>('/integrations/wcfm/sync-vendors');
      return response.data;
    },
    onSuccess: (data) => {
      setSyncConfirmOpen(false);
      if (data?.error) {
        toast.error(data.message ?? 'Sync failed.');
        return;
      }
      void queryClient.invalidateQueries({ queryKey: ['crm-contacts'] });
      const s = data?.summary;
      if (s) {
        const msg = `Created: ${s.created}, updated: ${s.updated}, skipped (no email): ${s.skipped_no_email}`;
        toast.success(msg);
        if (s.errors?.length) {
          toast.error(
            `${s.errors.length} vendor(s) failed. Check the last error: ${s.errors[s.errors.length - 1]?.message ?? ''}`
          );
        }
      }
    },
    onError: () => {
      toast.error('Sync failed.');
    },
  });

  const wcfmRuntimeActiveQuery = useQuery({
    queryKey: ['integrations-wcfm-status'],
    queryFn: async () => {
      const response = await api.get<{ active: boolean; vendor_count: number }>('/integrations/wcfm');
      return response.data;
    },
    enabled: open && wcfmPluginActive,
    refetchOnWindowFocus: false,
  });

  const canSync =
    wcfmPluginActive && wcfmRuntimeActiveQuery.data?.active === true && !syncMutation.isPending;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex flex-col w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>WCFM Marketplace</SheetTitle>
          </SheetHeader>

          <div className="flex flex-col gap-6 p-4">
            {!wcfmPluginActive ? (
              <p className="text-sm text-muted-foreground">
                Install and activate WCFM Marketplace to use multivendor features.
              </p>
            ) : !wcfmRuntimeActiveQuery.data?.active ? (
              <p className="text-sm text-muted-foreground">
                WCFM plugin is active but the marketplace runtime is not loaded yet. Refresh after
                WCFM finishes loading.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Vendors detected: {wcfmRuntimeActiveQuery.data.vendor_count ?? 0}
              </p>
            )}

            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <Label htmlFor="wcfm-orders">Vendors on contact Orders tab</Label>
                  <p className="text-xs text-muted-foreground">
                    Show vendor summary per WooCommerce order when WCFM is active.
                  </p>
                </div>
                <Switch
                  id="wcfm-orders"
                  checked={local.show_vendor_in_orders_tab}
                  onCheckedChange={(v) =>
                    setLocal((prev) => ({ ...prev, show_vendor_in_orders_tab: v }))
                  }
                  disabled={settingsQuery.isLoading}
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <Label htmlFor="wcfm-training">Vendors in product training</Label>
                  <p className="text-xs text-muted-foreground">
                    Vendor column and filter on Data source → Products.
                  </p>
                </div>
                <Switch
                  id="wcfm-training"
                  checked={local.show_vendor_in_training_products}
                  onCheckedChange={(v) =>
                    setLocal((prev) => ({ ...prev, show_vendor_in_training_products: v }))
                  }
                  disabled={settingsQuery.isLoading}
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <Label htmlFor="wcfm-lists">Vendors on product lists</Label>
                  <p className="text-xs text-muted-foreground">
                    e.g. discounted products for proactive sales and product name lookups.
                  </p>
                </div>
                <Switch
                  id="wcfm-lists"
                  checked={local.show_vendor_in_product_lists}
                  onCheckedChange={(v) =>
                    setLocal((prev) => ({ ...prev, show_vendor_in_product_lists: v }))
                  }
                  disabled={settingsQuery.isLoading}
                />
              </div>
            </div>

            <div className="border-t pt-4 space-y-2">
              <Button
                type="button"
                variant="secondary"
                disabled={!canSync}
                onClick={() => setSyncConfirmOpen(true)}
              >
                Sync vendors to CRM
              </Button>
              <p className="text-xs text-muted-foreground">
                One-way import: WCFM sellers become CRM contacts. Matching email addresses are
                overwritten with WCFM store profile data.
              </p>
            </div>
          </div>

          <SheetFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button
              type="button"
              onClick={() => void save()}
              disabled={updateSettingsMutation.isPending || settingsQuery.isLoading}
            >
              {updateSettingsMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  Saving…
                </>
              ) : (
                'Save settings'
              )}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Dialog open={syncConfirmOpen} onOpenChange={setSyncConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sync vendors to CRM?</DialogTitle>
            <DialogDescription className="space-y-2 text-left">
              <span className="block">
                Existing CRM contacts with the <strong>same email</strong> as a WCFM vendor will be
                updated with that vendor&apos;s profile (name, phone, address, WordPress user link).
              </span>
              <span className="block text-destructive">
                This bulk update cannot be undone automatically. Export or back up CRM data if
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
                  Syncing…
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
