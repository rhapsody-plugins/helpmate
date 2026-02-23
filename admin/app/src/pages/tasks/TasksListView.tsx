import { useMemo, useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { ReusableTable } from '@/components/ReusableTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Task, TaskFilters } from '@/types/crm';
import { useTasks } from '@/hooks/useTasks';
import { useNotificationsList } from '@/hooks/useNotifications';
import { OverdueIndicator } from './components/OverdueIndicator';
import { ContactPills } from './components/ContactPills';
import { Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { defaultLocale } from '@/pages/crm/contacts/utils';

interface TasksListViewProps {
  filters: TaskFilters;
  onTaskClick: (taskId: number) => void;
}

export function TasksListView({ filters, onTaskClick }: TasksListViewProps) {
  const [page, setPage] = useState(1);
  const [perPage] = useState(20);
  const { useTasks: useTasksQuery, deleteTaskMutation } = useTasks();
  const { data, isLoading } = useTasksQuery(filters, page, perPage);
  const { data: unreadTaskNotifications } = useNotificationsList({
    type: 'task',
    read: 'unread',
    per_page: 500,
  });
  const taskIdsWithUnread = useMemo(
    () =>
      new Set(
        (unreadTaskNotifications?.data ?? [])
          .filter((n) => n.entity_id != null)
          .map((n) => Number(n.entity_id))
      ),
    [unreadTaskNotifications?.data]
  );

  const tasks = data?.tasks || [];
  const pagination = data?.pagination;

  const getPriorityVariant = (priority: string): "default" | "destructive" | "outline" | "secondary" => {
    switch (priority.toLowerCase()) {
      case 'urgent':
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      case 'low':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const handleDelete = (taskId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this task?')) {
      deleteTaskMutation.mutate(taskId);
    }
  };

  const columns: ColumnDef<Task>[] = [
    {
      accessorKey: 'title',
      header: 'Task',
      cell: ({ row }) => (
        <div className="flex gap-2 items-center">
          {row.original.is_overdue && <OverdueIndicator />}
          <span className="font-medium">{row.original.title}</span>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const statusField = Object.values(row.original.custom_fields || {}).find(
          (f) => f.field_name === 'status'
        );
        return (
          <Badge variant="default">
            {statusField?.value as string || 'No Status'}
          </Badge>
        );
      },
    },
    {
      id: 'priority',
      header: 'Priority',
      cell: ({ row }) => {
        const priorityField = Object.values(row.original.custom_fields || {}).find(
          (f) => f.field_name === 'priority'
        );
        const priority = priorityField?.value as string;

        if (!priority) return <span className="text-sm text-muted-foreground">-</span>;

        return (
          <Badge variant={getPriorityVariant(priority)}>
            {priority}
          </Badge>
        );
      },
    },
    {
      id: 'type',
      header: 'Type',
      cell: ({ row }) => {
        const typeField = Object.values(row.original.custom_fields || {}).find(
          (f) => f.field_name === 'task_type'
        );
        return typeField?.value ? (
          <Badge variant="secondary">{typeField.value as string}</Badge>
        ) : (
          <span className="text-sm text-muted-foreground">-</span>
        );
      },
    },
    {
      accessorKey: 'assigned_to_name',
      header: 'Assigned To',
      cell: ({ row }) =>
        row.original.assigned_to_name || (
          <span className="text-sm text-muted-foreground">Unassigned</span>
        ),
    },
    {
      accessorKey: 'due_date',
      header: 'Due Date',
      cell: ({ row }) =>
        row.original.due_date ? (
          <span className={row.original.is_overdue ? 'text-destructive font-medium' : ''}>
            {format(new Date(row.original.due_date), 'MMM d, yyyy h:mm a', {
              locale: defaultLocale,
            })}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">-</span>
        ),
    },
    {
      id: 'contacts',
      header: 'Contacts',
      cell: ({ row }) => <ContactPills contacts={row.original.contacts} maxDisplay={2} />,
    },
    {
      id: 'actions',
      header: '',
      meta: { className: 'text-right' },
      cell: ({ row }) => (
        <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onTaskClick(row.original.id)}
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={(e) => handleDelete(row.original.id, e)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <ReusableTable
        columns={columns}
        data={tasks}
        loading={isLoading}
        showPagination={true}
        serverSidePagination={true}
        totalCount={pagination?.total || 0}
        currentPage={page}
        pageSize={perPage}
        onPageChange={setPage}
        onRowClick={(row) => onTaskClick(row.id)}
        getRowClassName={(row) =>
          taskIdsWithUnread.has(Number(row.id)) ? 'bg-primary/10' : ''
        }
      />
    </div>
  );
}
