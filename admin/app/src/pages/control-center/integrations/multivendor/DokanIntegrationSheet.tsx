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

export type DokanIntegrationSettings = {
  show_vendor_in_orders_tab: boolean;
  show_vendor_in_training_products: boolean;
  show_vendor_in_product_lists: boolean;
};

const DEFAULT_DOKAN: DokanIntegrationSettings = {
  show_vendor_in_orders_tab: false,
  show_vendor_in_training_products: false,
  show_vendor_in_product_lists: false,
};

type DokanIntegrationSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dokanPluginActive: boolean;
};

type SyncSummary = {
  created: number;
  updated: number;
  skipped_no_email: number;
  errors: Array<{ email: string; message: string }>;
};

export default function DokanIntegrationSheet({
  open,
  onOpenChange,
  dokanPluginActive,
}: DokanIntegrationSheetProps) {
  const queryClient = useQueryClient();
  const { updateSettingsMutation } = useSettings();
  const [local, setLocal] = useState<DokanIntegrationSettings>(DEFAULT_DOKAN);
  const [syncConfirmOpen, setSyncConfirmOpen] = useState(false);

  const settingsQuery = useQuery<DokanIntegrationSettings, Error>({
    queryKey: ['settings', 'dokan_integration'],
    queryFn: async () => {
      const response = await api.get<Partial<DokanIntegrationSettings>>(
        '/settings/dokan_integration'
      );
      return { ...DEFAULT_DOKAN, ...(response.data ?? {}) };
    },
    enabled: open,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (settingsQuery.data) {
      setLocal({ ...DEFAULT_DOKAN, ...settingsQuery.data });
    }
  }, [settingsQuery.data]);

  const save = useCallback(async () => {
    await updateSettingsMutation.mutateAsync({
      key: 'dokan_integration',
      data: local,
    });
    await queryClient.invalidateQueries({ queryKey: ['settings', 'dokan_integration'] });
    toast.success('Dokan settings saved.');
  }, [local, updateSettingsMutation, queryClient]);

  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post<{
        error: boolean;
        summary?: SyncSummary;
        message?: string;
      }>('/integrations/dokan/sync-vendors');
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
    onError: (err: unknown) => {
      toast.error('Sync failed.');
      console.error(err);
    },
  });

  const dokanRuntimeActiveQuery = useQuery({
    queryKey: ['integrations-dokan-status'],
    queryFn: async () => {
      const response = await api.get<{ active: boolean; vendor_count: number }>(
        '/integrations/dokan'
      );
      return response.data;
    },
    enabled: open && dokanPluginActive,
    refetchOnWindowFocus: false,
  });

  const canSync =
    dokanPluginActive && dokanRuntimeActiveQuery.data?.active === true && !syncMutation.isPending;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex flex-col w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Dokan</SheetTitle>
          </SheetHeader>

          <div className="flex flex-col gap-6 p-4">
            {!dokanPluginActive ? (
              <p className="text-sm text-muted-foreground">
                Install and activate Dokan (Lite or Pro) to use multivendor features.
              </p>
            ) : !dokanRuntimeActiveQuery.data?.active ? (
              <p className="text-sm text-muted-foreground">
                Dokan plugin is active but the marketplace runtime is not loaded yet. Refresh after
                Dokan finishes loading.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Vendors detected: {dokanRuntimeActiveQuery.data.vendor_count ?? 0}
              </p>
            )}

            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <Label htmlFor="dokan-orders">Vendors on contact Orders tab</Label>
                  <p className="text-xs text-muted-foreground">
                    Show vendor summary per WooCommerce order when Dokan is active.
                  </p>
                </div>
                <Switch
                  id="dokan-orders"
                  checked={local.show_vendor_in_orders_tab}
                  onCheckedChange={(v) =>
                    setLocal((prev) => ({ ...prev, show_vendor_in_orders_tab: v }))
                  }
                  disabled={settingsQuery.isLoading}
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <Label htmlFor="dokan-training">Vendors in product training</Label>
                  <p className="text-xs text-muted-foreground">
                    Vendor column and filter on Data source → Products.
                  </p>
                </div>
                <Switch
                  id="dokan-training"
                  checked={local.show_vendor_in_training_products}
                  onCheckedChange={(v) =>
                    setLocal((prev) => ({ ...prev, show_vendor_in_training_products: v }))
                  }
                  disabled={settingsQuery.isLoading}
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <Label htmlFor="dokan-lists">Vendors on product lists</Label>
                  <p className="text-xs text-muted-foreground">
                    e.g. discounted products for proactive sales and product name lookups.
                  </p>
                </div>
                <Switch
                  id="dokan-lists"
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
                One-way import: Dokan sellers become CRM contacts. Matching email addresses are
                overwritten with Dokan store profile data.
              </p>
            </div>
          </div>

          <SheetFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
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
                Existing CRM contacts with the <strong>same email</strong> as a Dokan vendor will be
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
