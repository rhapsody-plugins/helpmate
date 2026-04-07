import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import api from '@/lib/axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

type LifterStatus = {
  active: boolean;
  student_count: number;
  course_count: number;
  lesson_count: number;
};

type SyncSummary = {
  created: number;
  updated: number;
  skipped_no_email: number;
  errors: Array<{ email: string; message: string }>;
};

type LifterLmsIntegrationSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lifterPluginActive: boolean;
};

export default function LifterLmsIntegrationSheet({
  open,
  onOpenChange,
  lifterPluginActive,
}: LifterLmsIntegrationSheetProps) {
  const queryClient = useQueryClient();
  const [syncConfirmOpen, setSyncConfirmOpen] = useState(false);

  const statusQuery = useQuery<LifterStatus>({
    queryKey: ['integrations-lifterlms-status'],
    queryFn: async () => {
      const response = await api.get<{
        error: boolean;
        active: boolean;
        student_count: number;
        course_count: number;
        lesson_count: number;
      }>('/integrations/lifterlms');
      return {
        active: response.data.active,
        student_count: response.data.student_count,
        course_count: response.data.course_count,
        lesson_count: response.data.lesson_count,
      };
    },
    enabled: open && lifterPluginActive,
    refetchOnWindowFocus: false,
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post<{
        error: boolean;
        summary?: SyncSummary;
        message?: string;
      }>('/integrations/lifterlms/sync-students');
      return response.data;
    },
    onSuccess: (data) => {
      setSyncConfirmOpen(false);
      if (data?.error) {
        toast.error(data.message ?? 'Sync failed.');
        return;
      }
      void queryClient.invalidateQueries({ queryKey: ['crm-contacts'] });
      void queryClient.invalidateQueries({ queryKey: ['crm-contact-integration-source-options'] });
      const s = data?.summary;
      if (s) {
        toast.success(
          `Created: ${s.created}, updated: ${s.updated}, skipped (no email): ${s.skipped_no_email}`
        );
        if (s.errors?.length) {
          toast.error(
            `${s.errors.length} student(s) failed. Last error: ${s.errors[s.errors.length - 1]?.message ?? ''}`
          );
        }
      }
      void statusQuery.refetch();
    },
    onError: () => {
      toast.error('Sync failed.');
    },
  });

  const canSync = lifterPluginActive && statusQuery.data?.active === true && !syncMutation.isPending;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex flex-col w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>LifterLMS</SheetTitle>
          </SheetHeader>

          <div className="flex flex-col gap-4 p-4">
            {!lifterPluginActive ? (
              <p className="text-sm text-muted-foreground">
                Install and activate LifterLMS to enable LMS integration.
              </p>
            ) : !statusQuery.data?.active ? (
              <p className="text-sm text-muted-foreground">
                LifterLMS plugin is active but runtime is not fully loaded yet. Refresh after
                LifterLMS initializes.
              </p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  Students: {statusQuery.data.student_count ?? 0}
                </p>
                <p className="text-xs text-muted-foreground">
                  Courses: {statusQuery.data.course_count ?? 0}
                </p>
                <p className="text-xs text-muted-foreground">
                  Lessons: {statusQuery.data.lesson_count ?? 0}
                </p>
              </>
            )}

            <div className="border-t pt-4 space-y-2">
              <Button
                type="button"
                variant="secondary"
                disabled={!canSync}
                onClick={() => setSyncConfirmOpen(true)}
              >
                Sync students to CRM
              </Button>
              <p className="text-xs text-muted-foreground">
                One-way import from LifterLMS: students are matched by email and contact profile
                fields are overwritten with LifterLMS user data.
              </p>
            </div>
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
            <DialogTitle>Sync LifterLMS students to CRM?</DialogTitle>
            <DialogDescription className="space-y-2 text-left">
              <span className="block">
                Existing CRM contacts with the <strong>same email</strong> as a LifterLMS student
                will be updated from that student profile.
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

