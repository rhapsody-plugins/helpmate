import { ReusableTable } from '@/components/ReusableTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTasks } from '@/hooks/useTasks';
import { TaskDetails } from '@/pages/tasks/TaskDetails';
import { Task } from '@/types/crm';
import { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface TasksTabProps {
  contactId: number | null;
}

const PAGE_SIZE = 10;

export function TasksTab({ contactId }: TasksTabProps) {
  const tasksHook = useTasks();
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const { data: tasks, isLoading } = tasksHook.useContactTasks(contactId);

  // Reset to page 1 when contactId changes
  useEffect(() => {
    setCurrentPage(1);
  }, [contactId]);

  const handleTaskClick = (taskId: number) => {
    setSelectedTaskId(taskId);
    setShowTaskDialog(true);
  };

  const handleCreateTask = () => {
    setSelectedTaskId(null);
    setShowTaskDialog(true);
  };

  const handleDelete = (taskId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this task?')) {
      tasksHook.deleteTaskMutation.mutate(taskId);
    }
  };

  const getPriorityVariant = (
    priority: string
  ): 'default' | 'destructive' | 'outline' | 'secondary' => {
    switch (priority?.toLowerCase()) {
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

  const columns: ColumnDef<Task>[] = [
    {
      accessorKey: 'title',
      header: 'Task',
      cell: ({ row }) => (
        <div className="flex gap-2 items-center">
          {row.original.is_overdue && (
            <Badge variant="destructive" className="text-xs">
              Overdue
            </Badge>
          )}
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
            {(statusField?.value as string) || 'No Status'}
          </Badge>
        );
      },
    },
    {
      id: 'priority',
      header: 'Priority',
      cell: ({ row }) => {
        const priorityField = Object.values(
          row.original.custom_fields || {}
        ).find((f) => f.field_name === 'priority');
        const priority = priorityField?.value as string;

        if (!priority)
          return <span className="text-sm text-muted-foreground">-</span>;

        return <Badge variant={getPriorityVariant(priority)}>{priority}</Badge>;
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
          <span
            className={row.original.is_overdue ? 'text-destructive font-medium' : ''}
          >
            {format(new Date(row.original.due_date), 'MMM d, yyyy h:mm a')}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">-</span>
        ),
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
            onClick={() => handleTaskClick(row.original.id)}
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
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="!text-lg !my-0">
              Tasks ({tasks?.length || 0})
            </CardTitle>
            <Button onClick={handleCreateTask} size="sm">
              <Plus className="mr-2 w-4 h-4" />
              Add Task
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ReusableTable
            columns={columns}
            data={tasks || []}
            loading={isLoading}
            showPagination={true}
            pageSize={PAGE_SIZE}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            onRowClick={(row) => handleTaskClick(row.id)}
          />
        </CardContent>
      </Card>

      <TaskDetails
        open={showTaskDialog}
        onOpenChange={setShowTaskDialog}
        taskId={selectedTaskId}
        defaultContactId={contactId}
      />
    </>
  );
}
