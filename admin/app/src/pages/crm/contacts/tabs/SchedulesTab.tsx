import { ReusableTable } from '@/components/ReusableTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScheduleType, useSmartScheduling } from '@/hooks/useSmartScheduling';
import { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { useEffect, useState } from 'react';

interface SchedulesTabProps {
  email: string | null;
}

const PAGE_SIZE = 10;

export function SchedulesTab({ email }: SchedulesTabProps) {
  const { useContactSchedules, updateScheduleMutation } = useSmartScheduling();
  const [currentPage, setCurrentPage] = useState(1);

  const { data: schedules, isLoading } = useContactSchedules(
    email,
    email !== null && email !== ''
  );

  // Reset to page 1 when email changes
  useEffect(() => {
    setCurrentPage(1);
  }, [email]);

  const handleStatusChange = (scheduleId: number, newStatus: string) => {
    updateScheduleMutation.mutate({
      id: scheduleId,
      status: newStatus,
    });
  };

  const formatTime = (time: string) => {
    const timeParts = time.split(':');
    return timeParts[0] + ':' + timeParts[1];
  };

  const columns: ColumnDef<ScheduleType>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <span className="font-medium">{row.original.name}</span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Select
            value={row.original.status}
            onValueChange={(value) => handleStatusChange(row.original.id, value)}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ),
    },
    {
      accessorKey: 'scheduled_date',
      header: 'Date',
      cell: ({ row }) =>
        format(new Date(row.original.scheduled_date), 'MMM dd, yyyy'),
    },
    {
      accessorKey: 'scheduled_time',
      header: 'Time',
      cell: ({ row }) => formatTime(row.original.scheduled_time),
    },
    {
      accessorKey: 'phone',
      header: 'Phone',
      cell: ({ row }) =>
        row.original.phone || (
          <span className="text-sm text-muted-foreground">-</span>
        ),
    },
    {
      accessorKey: 'message',
      header: 'Message',
      cell: ({ row }) =>
        row.original.message ? (
          <div className="max-w-xs text-sm line-clamp-2">
            {row.original.message}
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">-</span>
        ),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="!text-lg !my-0">
          Schedules ({schedules?.length || 0})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ReusableTable
          columns={columns}
          data={schedules || []}
          loading={isLoading}
          showPagination={true}
          pageSize={PAGE_SIZE}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
        />
      </CardContent>
    </Card>
  );
}
