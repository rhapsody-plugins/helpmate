import { ProBadge } from '@/components/ProBadge';
import { ReusableTable } from '@/components/ReusableTable';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import useRefundReturn from '@/hooks/useRefundReturn';
import { useSettings } from '@/hooks/useSettings';
import { cn } from '@/lib/utils';
import { RefundReturnType } from '@/types';
import { ColumnDef } from '@tanstack/react-table';
import { Eye } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export default function TabRequests() {
  const { getProQuery } = useSettings();
  const { getRefundReturns, updateRefundReturn } = useRefundReturn();
  const {
    mutateAsync: getRefundReturnsMutation,
    data: refundReturns,
    isPending: isFetching,
  } = getRefundReturns;
  const { mutateAsync: updateRefundReturnMutation } = updateRefundReturn;
  const [page, setPage] = useState(1);
  const [perPage] = useState(10);
  const [selectedRefund, setSelectedRefund] = useState<RefundReturnType | null>(
    null
  );
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  useEffect(() => {
    getRefundReturnsMutation({
      page,
      per_page: perPage,
    });
  }, [page, perPage]);

  const handleStatusChange = async (status: string) => {
    if (!selectedRefund) return;

    try {
      await updateRefundReturnMutation({
        id: selectedRefund.id,
        status,
      });
      toast.success('Status updated successfully');
      getRefundReturnsMutation({
        page,
        per_page: perPage,
      });
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error('Failed to update status');
      }
    }
  };

  const columns: ColumnDef<RefundReturnType>[] = [
    {
      accessorKey: 'order_id',
      header: 'Order ID',
    },
    {
      accessorKey: 'customer_name',
      header: 'Customer Name',
    },
    {
      accessorKey: 'customer_email',
      header: 'Customer Email',
    },
    {
      accessorKey: 'type',
      header: 'Type',
      cell: ({ row }) => {
        const type = row.getValue('type') as string;
        return (
          <span
            className={cn(
              'px-2 py-1 rounded-full text-xs font-medium',
              type === 'refund' && 'bg-blue-100 text-blue-800',
              type === 'return' && 'bg-orange-100 text-orange-800',
              type === 'exchange' && 'bg-purple-100 text-purple-800'
            )}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </span>
        );
      },
    },
    {
      accessorKey: 'reason',
      header: 'Reason',
      cell: ({ row }) => {
        const reason = row.getValue('reason') as string;
        return <div className="max-w-[100px] truncate">{reason}</div>;
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.getValue('status') as string;
        return (
          <span
            className={cn(
              'px-2 py-1 rounded-full text-xs font-medium',
              status === 'approved' && 'bg-green-100 text-green-800',
              status === 'pending' && 'bg-yellow-100 text-yellow-800',
              status === 'rejected' && 'bg-red-100 text-red-800'
            )}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
        );
      },
    },
    {
      accessorKey: 'created_at',
      header: 'Created At',
      cell: ({ row }) => {
        const created_at = row.getValue('created_at') as number;
        return <span>{new Date(created_at * 1000).toLocaleString()}</span>;
      },
    },
    {
      accessorKey: 'updated_at',
      header: 'Updated At',
      cell: ({ row }) => {
        const updated_at = row.getValue('updated_at') as number;
        return <span>{new Date(updated_at * 1000).toLocaleString()}</span>;
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const refund = row.original;
        return (
          <div className="flex gap-2 items-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setSelectedRefund(refund);
                setIsSheetOpen(true);
              }}
            >
              <Eye className="w-4 h-4" />
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="relative">
      {!getProQuery.data && (
        <ProBadge
          topMessage="It's not just a refund. It's your reputation. Offer seamless return experiences and build trust."
          buttonText="Build Loyalty with Ease"
          tooltipMessage={null}
        />
      )}
      <Card
        className={cn(
          !getProQuery.data &&
            'opacity-50 cursor-not-allowed pointer-events-none'
        )}
      >
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex gap-2 items-center text-xl font-bold">
                Refund & Return Requests
                <InfoTooltip message="Manage customer refund and return requests." />
              </CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isFetching ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Skeleton className="w-48 h-6" />
                <Skeleton className="w-32 h-10" />
              </div>
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="w-full h-16" />
                ))}
              </div>
              <div className="flex justify-between items-center">
                <Skeleton className="w-32 h-4" />
                <Skeleton className="w-48 h-10" />
              </div>
            </div>
          ) : (
            <ReusableTable
              columns={columns}
              data={refundReturns?.items || []}
              showPagination={true}
              pageSize={perPage}
              rightAlignedColumns={['actions']}
              loading={isFetching}
              serverSidePagination={true}
              totalCount={refundReturns?.pagination?.total || 0}
              onPageChange={setPage}
              currentPage={page}
            />
          )}
        </CardContent>
      </Card>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="gap-0">
          <SheetHeader className="mt-6">
            <SheetTitle className="!text-xl !font-bold !my-0">
              Refund & Return Details
            </SheetTitle>
            <SheetDescription className="!text-sm !my-0">
              View and manage refund/return request details
            </SheetDescription>
          </SheetHeader>
          <div className="p-4 pt-0 space-y-6">
            {selectedRefund && (
              <>
                <div className="space-y-2">
                  <h3 className="font-medium !my-0">Type</h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedRefund.type.charAt(0).toUpperCase() + selectedRefund.type.slice(1)}
                  </p>
                </div>
                <div className="space-y-2">
                  <h3 className="font-medium !my-0">Reason</h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedRefund.reason}
                  </p>
                </div>
                <div className="space-y-2">
                  <h3 className="font-medium !my-0 !mb-2">Status</h3>
                  <Select
                    value={selectedRefund.status}
                    onValueChange={handleStatusChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <h3 className="font-medium !my-0">Customer Details</h3>
                  <p className="text-sm text-muted-foreground">
                    Name: {selectedRefund.customer_name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Email: {selectedRefund.customer_email}
                  </p>
                </div>
                <div className="space-y-2">
                  <h3 className="font-medium !my-0">Order Details</h3>
                  <p className="text-sm text-muted-foreground">
                    Order ID: {selectedRefund.order_id}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Amount: ${selectedRefund.amount}
                  </p>
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}