import { ReusableTable } from '@/components/ReusableTable';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PageGuard from '@/components/PageGuard';
import PageHeader from '@/components/PageHeader';
import { ProBadge } from '@/components/ProBadge';
import { useSettings } from '@/hooks/useSettings';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { useCrm } from '@/hooks/useCrm';
import { Segment } from '@/types/crm';
import { ColumnDef } from '@tanstack/react-table';
import { formatDistanceToNow } from 'date-fns';
import { parseUTCDate, defaultLocale } from './contacts/utils';
import { Pencil, Plus, RefreshCw, Trash } from 'lucide-react';
import { useState } from 'react';
import SegmentForm from '@/components/crm/SegmentForm';

export default function Segments() {
  const { getProQuery } = useSettings();
  const isPro = getProQuery.data ?? false;
  const { useSegments, deleteSegmentMutation, refreshSegmentCountMutation } =
    useCrm();

  const { data: segments, isLoading } = useSegments();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSegment, setEditingSegment] = useState<Segment | null>(null);

  const deleteSegment = deleteSegmentMutation;
  const refreshCount = refreshSegmentCountMutation;

  const columns: ColumnDef<Segment>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => <div className="font-medium">{row.original.name}</div>,
    },
    {
      accessorKey: 'contact_count',
      header: 'Contacts',
      cell: ({ row }) => (
        <div className="flex gap-2 items-center">
          <span>{row.original.contact_count}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refreshCount.mutate(row.original.id)}
            disabled={refreshCount.isPending}
            className="p-0 w-6 h-6"
          >
            <RefreshCw
              className={`h-3 w-3 ${
                refreshCount.isPending ? 'animate-spin' : ''
              }`}
            />
          </Button>
        </div>
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditingSegment(row.original);
              setIsFormOpen(true);
            }}
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (confirm('Are you sure you want to delete this segment?')) {
                deleteSegment.mutate(row.original.id);
              }
            }}
          >
            <Trash className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  const handleCreate = () => {
    setEditingSegment(null);
    setIsFormOpen(true);
  };

  const handleClose = () => {
    setIsFormOpen(false);
    setEditingSegment(null);
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="w-64 h-10" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <PageGuard page="crm-segments">
      <div className="gap-0">
        <div className="relative">
          {!isPro && (
            <ProBadge
              topMessage="Organize your contacts into segments for targeted messaging and outreach."
              buttonText="Unlock Segments"
              tooltipMessage={null}
            />
          )}
          <div
            className={cn(
              !isPro && 'opacity-50 cursor-not-allowed pointer-events-none'
            )}
          >
            <PageHeader
              title="Segments"
              rightActions={
                <Button onClick={handleCreate} size="sm" disabled={!isPro}>
                  <Plus className="mr-2 w-4 h-4" />
                  Create Segment
                </Button>
              }
            />

            <div className="p-6">
              <Card
                className={cn(
                  !isPro && 'opacity-50 cursor-not-allowed pointer-events-none'
                )}
              >
                <CardHeader>
                  <CardTitle className="!text-lg !my-0">Segments</CardTitle>
                </CardHeader>
                <CardContent>
                  <ReusableTable
                    data={segments || []}
                    columns={columns}
                    rightAlignedColumns={['actions']}
                  />
                </CardContent>
              </Card>

              <Sheet open={isFormOpen} onOpenChange={handleClose}>
                <SheetContent className="sm:!max-w-2xl">
                  <SheetHeader>
                    <SheetTitle>
                      {editingSegment ? 'Edit Segment' : 'Create Segment'}
                    </SheetTitle>
                  </SheetHeader>
                  <div className="overflow-y-auto flex-1 p-4 pt-6">
                    <SegmentForm segment={editingSegment} onClose={handleClose} />
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </div>
    </PageGuard>
  );
}
