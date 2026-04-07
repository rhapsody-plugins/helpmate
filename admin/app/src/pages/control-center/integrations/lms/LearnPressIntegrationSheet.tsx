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

type LearnPressStatus = {
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

type LearnPressIntegrationSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  learnPressPluginActive: boolean;
};

export default function LearnPressIntegrationSheet({
  open,
  onOpenChange,
  learnPressPluginActive,
}: LearnPressIntegrationSheetProps) {
  const queryClient = useQueryClient();
  const [syncConfirmOpen, setSyncConfirmOpen] = useState(false);

  const statusQuery = useQuery<LearnPressStatus>({
    queryKey: ['integrations-learnpress-status'],
    queryFn: async () => {
      const response = await api.get<{
        error: boolean;
        active: boolean;
        student_count: number;
        course_count: number;
        lesson_count: number;
      }>('/integrations/learnpress');
      return {
        active: response.data.active,
        student_count: response.data.student_count,
        course_count: response.data.course_count,
        lesson_count: response.data.lesson_count,
      };
    },
    enabled: open && learnPressPluginActive,
    refetchOnWindowFocus: false,
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post<{
        error: boolean;
        summary?: SyncSummary;
        message?: string;
      }>('/integrations/learnpress/sync-students');
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

  const canSync =
    learnPressPluginActive &&
    statusQuery.data?.active === true &&
    !syncMutation.isPending;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex flex-col w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>LearnPress LMS</SheetTitle>
          </SheetHeader>

          <div className="flex flex-col gap-4 p-4">
            {!learnPressPluginActive ? (
              <p className="text-sm text-muted-foreground">
                Install and activate LearnPress to enable LMS integration.
              </p>
            ) : !statusQuery.data?.active ? (
              <p className="text-sm text-muted-foreground">
                LearnPress plugin is active but runtime is not fully loaded yet. Refresh after
                LearnPress initializes.
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
                One-way import from LearnPress: students are matched by email and contact profile
                fields are overwritten with LearnPress user data.
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
            <DialogTitle>Sync LearnPress students to CRM?</DialogTitle>
            <DialogDescription className="space-y-2 text-left">
              <span className="block">
                Existing CRM contacts with the <strong>same email</strong> as a LearnPress
                student will be updated from that student profile.
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

