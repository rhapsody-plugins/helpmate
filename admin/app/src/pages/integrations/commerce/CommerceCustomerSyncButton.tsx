import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import api from '@/lib/axios';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { __, sprintf } from '@/lib/utils';
import { toast } from 'sonner';

type SyncSummary = {
  created: number;
  updated: number;
  skipped_no_email: number;
  truncated?: boolean;
  errors: Array<{ email: string; message: string }>;
};

type CommerceCustomerSyncButtonProps = {
  providerLabel: string;
  endpoint: string;
  compact?: boolean;
};

export default function CommerceCustomerSyncButton({
  providerLabel,
  endpoint,
  compact = false,
}: CommerceCustomerSyncButtonProps) {
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post<{
        error: boolean;
        summary?: SyncSummary;
        message?: string;
      }>(endpoint);
      return response.data;
    },
    onSuccess: (data) => {
      setConfirmOpen(false);
      if (data?.error) {
        toast.error(data.message ?? 'Sync failed.');
        return;
      }

      void queryClient.invalidateQueries({ queryKey: ['crm-contacts'] });
      const s = data?.summary;
      if (!s) {
        toast.success('Customers synced.');
        return;
      }

      const msg = `Created: ${s.created}, updated: ${s.updated}, skipped (no email): ${s.skipped_no_email}`;
      toast.success(msg);
      if (s.truncated) {
        toast.message('Sync reached the processing cap. Run again to continue importing.');
      }
      if (s.errors?.length) {
        toast.error(
          `${s.errors.length} customer(s) failed. Last error: ${s.errors[s.errors.length - 1]?.message ?? ''}`
        );
      }
    },
    onError: () => {
      toast.error('Sync failed.');
    },
  });

  return (
    <>
      <div className={compact ? '' : 'border-t pt-4 mt-4 space-y-2'}>
        <Button type="button" variant="secondary" onClick={() => setConfirmOpen(true)}>
          {__('Sync customers to CRM')}
        </Button>
      </div>
      {!compact && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {sprintf(
              /* translators: 1: Commerce provider name, 2: Commerce provider name */
              __(
                'One-way import from %1$s: customers are matched by email and CRM contact fields are overwritten from %2$s data.'
              ),
              __(providerLabel),
              __(providerLabel)
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            {__(
              'If you run sync from another commerce provider later, that latest sync wins for matching emails.'
            )}
          </p>
        </div>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{__('Sync customers to CRM?')}</DialogTitle>
            <DialogDescription className="space-y-2 text-left">
              <span className="block">
                {sprintf(
                  /* translators: %1$s: Commerce provider name */
                  __(
                    'Existing CRM contacts with the same email as a %1$s customer will be updated from that customer profile.'
                  ),
                  __(providerLabel)
                )}
              </span>
              <span className="block">
                {__(
                  'If you sync from different commerce providers, the most recent sync overwrites the same-email contact fields.'
                )}
              </span>
              <span className="block text-destructive">
                {__(
                  'This bulk update cannot be undone automatically. Export or back up CRM data if unsure.'
                )}
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>
              {__('Cancel')}
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
                  {__('Syncing…')}
                </>
              ) : (
                __('Yes, sync now')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
