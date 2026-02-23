import { ReusableTable } from '@/components/ReusableTable';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ScheduleType, useSmartScheduling } from '@/hooks/useSmartScheduling';
import { useCrm } from '@/hooks/useCrm';
import { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { Trash, UserPlus } from 'lucide-react';
import { parseUTCDate, defaultLocale } from '@/pages/crm/contacts/utils';
import { useMemo, useState } from 'react';
import { ProBadge } from '@/components/ProBadge';
import { useSettings } from '@/hooks/useSettings';
import { cn } from '@/lib/utils';

export default function TabSchedules() {
  const { getProQuery } = useSettings();
  const isPro = getProQuery.data ?? false;
  const { getSchedulesQuery, updateScheduleMutation, deleteScheduleMutation } =
    useSmartScheduling();
  const { createContactMutation } = useCrm();
  const { data, isFetching } = getSchedulesQuery;
  const schedules = data?.data ?? [];
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredSchedules = useMemo(() => {
    if (statusFilter === 'all') {
      return schedules;
    }
    return schedules.filter((schedule) => schedule.status === statusFilter);
  }, [schedules, statusFilter]);

  const handleStatusChange = (scheduleId: number, newStatus: string) => {
    updateScheduleMutation.mutate({
      id: scheduleId,
      status: newStatus,
    });
  };

  const handleDelete = (scheduleId: number) => {
    if (confirm('Are you sure you want to delete this schedule?')) {
      deleteScheduleMutation.mutate(scheduleId);
    }
  };

  const handleCreateContact = (schedule: ScheduleType) => {
    const nameParts = schedule.name.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    createContactMutation.mutate(
      {
        email: schedule.email,
        first_name: firstName,
        last_name: lastName,
        phone: schedule.phone || undefined,
      },
      {
        onSuccess: (data) => {
          // Update schedule to link to contact and refresh data
          if (data.contact_id) {
            updateScheduleMutation.mutate({
              id: schedule.id,
              contact_id: data.contact_id,
            });
          }
        },
      }
    );
  };

  const getStatusBadge = (status: string) => {
    const baseClasses = 'px-2 py-1 rounded-full text-xs font-medium';
    switch (status) {
      case 'confirmed':
        return (
          <span className={`text-green-800 bg-green-100 ${baseClasses}`}>
            Confirmed
          </span>
        );
      case 'cancelled':
        return (
          <span className={`text-red-800 bg-red-100 ${baseClasses}`}>
            Cancelled
          </span>
        );
      default:
        return (
          <span className={`text-yellow-800 bg-yellow-100 ${baseClasses}`}>
            Pending
          </span>
        );
    }
  };

  const columns: ColumnDef<ScheduleType>[] = useMemo(
    () => [
      {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ row }) => <div className="font-medium">{row.original.name}</div>,
      },
      {
        accessorKey: 'email',
        header: 'Email',
        cell: ({ row }) => {
          const schedule = row.original;
          const hasContact = schedule.has_contact ?? false;
          const isCreating = createContactMutation.isPending;

          return (
            <div className="flex items-center gap-2">
              <span>{schedule.email}</span>
              {!hasContact && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCreateContact(schedule)}
                  disabled={isCreating}
                  className="h-7 text-xs"
                >
                  <UserPlus className="w-3 h-3 mr-1" />
                  Create Contact
                </Button>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'phone',
        header: 'Phone',
        cell: ({ row }) => (
          <div>{row.original.phone || <span className="text-muted-foreground">—</span>}</div>
        ),
      },
      {
        accessorKey: 'scheduled_date',
        header: 'Date',
        cell: ({ row }) => {
          try {
            return (
              <div>
                {format(parseUTCDate(row.original.scheduled_date), 'MMM dd, yyyy', {
                  locale: defaultLocale,
                })}
              </div>
            );
          } catch {
            return <div>{row.original.scheduled_date}</div>;
          }
        },
      },
      {
        accessorKey: 'scheduled_time',
        header: 'Time',
        cell: ({ row }) => {
          const time = row.original.scheduled_time;
          // Format time from HH:mm:ss to HH:mm
          const timeParts = time.split(':');
          return <div>{timeParts[0] + ':' + timeParts[1]}</div>;
        },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => getStatusBadge(row.original.status),
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const schedule = row.original;
          return (
            <div className="flex gap-2">
              <Select
                value={schedule.status}
                onValueChange={(value) => handleStatusChange(schedule.id, value)}
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
              <Button
                variant="destructive"
                size="icon"
                onClick={() => handleDelete(schedule.id)}
              >
                <Trash className="w-4 h-4" />
              </Button>
            </div>
          );
        },
      },
    ],
    [createContactMutation.isPending]
  );

  return (
    <div className="relative space-y-6">
      {!isPro && (
        <ProBadge
          topMessage="Manage and track all your scheduled appointments. View, update, and organize schedules with ease."
          buttonText="Unlock Scheduling"
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
            <CardTitle className="!text-lg !my-0">Schedules</CardTitle>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isFetching ? (
            <div className="space-y-4">
              <Skeleton className="w-full h-10" />
              <Skeleton className="w-full h-10" />
              <Skeleton className="w-full h-10" />
            </div>
          ) : filteredSchedules.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No schedules found
            </div>
          ) : (
            <ReusableTable data={filteredSchedules} columns={columns} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

