import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { FailedEmail } from '@/types/crm';

type FailedEmailsSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  failures: FailedEmail[] | undefined;
  isLoading: boolean;
  failedCount: number;
};

export function FailedEmailsSheet({
  open,
  onOpenChange,
  title,
  failures,
  isLoading,
  failedCount,
}: FailedEmailsSheetProps) {
  const isEmpty = !isLoading && Array.isArray(failures) && failures.length === 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:!max-w-xl">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <div className="mt-4 px-4 space-y-2 overflow-y-auto max-h-[70vh]">
          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : isEmpty ? (
            <p className="text-muted-foreground text-sm">
              {failedCount > 0
                ? 'Failure details not available for campaigns/sequences sent before this feature was added.'
                : 'No failure details.'}
            </p>
          ) : (
            (failures ?? []).map((f, i) => (
              <div
                key={`${f.contact_id}-${i}`}
                className="rounded-md border p-3 text-sm space-y-1"
              >
                <div className="font-medium">
                  {f.contact_name ||
                    f.contact_email ||
                    `Contact #${f.contact_id}` ||
                    'Deleted contact'}
                </div>
                <div className="text-muted-foreground text-xs break-words">
                  {f.error_message}
                </div>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
