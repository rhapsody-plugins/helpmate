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
};

export default function CommerceCustomerSyncButton({
  providerLabel,
  endpoint,
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
      <div className="border-t pt-4 mt-4 space-y-2">
        <Button type="button" variant="secondary" onClick={() => setConfirmOpen(true)}>
          Sync customers to CRM
        </Button>
        <p className="text-xs text-muted-foreground">
          One-way import from {providerLabel}: customers are matched by email and CRM contact
          fields are overwritten from {providerLabel} data.
        </p>
        <p className="text-xs text-muted-foreground">
          If you run sync from another commerce provider later, that latest sync wins for matching
          emails.
        </p>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sync customers to CRM?</DialogTitle>
            <DialogDescription className="space-y-2 text-left">
              <span className="block">
                Existing CRM contacts with the <strong>same email</strong> as a {providerLabel}{' '}
                customer will be updated from that customer profile.
              </span>
              <span className="block">
                If you sync from different commerce providers, the most recent sync overwrites the
                same-email contact fields.
              </span>
              <span className="block text-destructive">
                This bulk update cannot be undone automatically. Export or back up CRM data if
                unsure.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>
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
