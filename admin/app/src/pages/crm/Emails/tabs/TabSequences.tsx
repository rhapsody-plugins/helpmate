import EmailSequenceForm from '@/components/crm/EmailSequenceForm';
import { FailedEmailsSheet } from '@/components/crm/FailedEmailsSheet';
import { ReusableTable } from '@/components/ReusableTable';
import { ProBadge } from '@/components/ProBadge';
import { useSettings } from '@/hooks/useSettings';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { useCrm } from '@/hooks/useCrm';
import { EmailSequence } from '@/types/crm';
import { ColumnDef } from '@tanstack/react-table';
import { formatDistanceToNow } from 'date-fns';
import { parseUTCDate, defaultLocale } from '@/pages/crm/contacts/utils';
import { Pencil, Plus, Trash } from 'lucide-react';
import { useState } from 'react';

export default function TabSequences() {
  const { getProQuery } = useSettings();
  const isPro = getProQuery.data ?? false;
  const {
    useEmailSequences,
    useSequenceFailedEmails,
    deleteEmailSequenceMutation,
  } = useCrm();

  const { data: sequences, isLoading } = useEmailSequences();
  const [failuresSequenceId, setFailuresSequenceId] = useState<number | null>(
    null
  );
  const { data: failedEmails, isLoading: failedEmailsLoading } =
    useSequenceFailedEmails(failuresSequenceId, failuresSequenceId !== null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSequence, setEditingSequence] = useState<EmailSequence | null>(
    null
  );

  const columns: ColumnDef<EmailSequence>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
    },
    {
      accessorKey: 'steps',
      header: 'Steps',
      cell: ({ row }) => <span>{row.original.steps?.length || 0} steps</span>,
    },
    {
      accessorKey: 'sent_count',
      header: 'Sent',
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span>{row.original.sent_count ?? 0} sent</span>
          {(row.original.failed_count ?? 0) > 0 && (
            <span className="text-xs text-destructive">
              {row.original.failed_count} failed
            </span>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'is_active',
      header: 'Status',
      cell: ({ row }) => (
        <span>{row.original.is_active ? 'Active' : 'Inactive'}</span>
      ),
    },
    {
      accessorKey: 'created_at',
      header: 'Created',
      cell: ({ row }) =>
        formatDistanceToNow(parseUTCDate(row.original.created_at), {
          addSuffix: true,
          locale: defaultLocale,
        }),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex gap-2 justify-end items-center">
          {(row.original.failed_count ?? 0) > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFailuresSequenceId(row.original.id)}
            >
              View failures
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditingSequence(row.original);
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
              if (
                confirm('Are you sure you want to delete this email sequence?')
              ) {
                deleteEmailSequenceMutation.mutate(row.original.id);
              }
            }}
            disabled={!isPro}
          >
            <Trash className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="relative p-6 space-y-6">
        {!isPro && (
          <ProBadge
            topMessage="Create email sequences that automatically send emails over time."
            buttonText="Unlock Email Sequences"
            tooltipMessage={null}
          />
        )}
        <Card
          className={cn(
            !isPro && 'opacity-50 cursor-not-allowed pointer-events-none'
          )}
        >
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Email Sequences</CardTitle>
              <Button
                onClick={() => {
                  setEditingSequence(null);
                  setIsFormOpen(true);
                }}
                disabled={!isPro}
              >
                <Plus className="mr-2 w-4 h-4" />
                Create Sequence
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-96" />
            ) : sequences && sequences.length > 0 ? (
              <ReusableTable
                data={sequences}
                columns={columns}
                rightAlignedColumns={['actions']}
              />
            ) : (
              <div className="py-12 text-center">
                <p className="text-muted-foreground">No email sequences yet.</p>
                <Button
                  onClick={() => setIsFormOpen(true)}
                  className="mt-4"
                  disabled={!isPro}
                >
                  <Plus className="mr-2 w-4 h-4" />
                  Create Sequence
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <FailedEmailsSheet
        open={failuresSequenceId !== null}
        onOpenChange={(open) => !open && setFailuresSequenceId(null)}
        title="Failed emails"
        failures={failedEmails}
        isLoading={failedEmailsLoading}
        failedCount={
          sequences?.find((s) => s.id === failuresSequenceId)?.failed_count ?? 0
        }
      />

      <Sheet
        open={isFormOpen}
        onOpenChange={(open) => {
          setIsFormOpen(open);
          if (!open) setEditingSequence(null);
        }}
      >
        <SheetContent className="sm:!max-w-3xl">
          <SheetHeader>
            <SheetTitle>
              {editingSequence
                ? 'Edit Email Sequence'
                : 'Create Email Sequence'}
            </SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto flex-1 p-4 pt-6">
            <EmailSequenceForm
              key={editingSequence?.id || 'new'}
              sequence={editingSequence}
              onClose={() => {
                setIsFormOpen(false);
                setEditingSequence(null);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
