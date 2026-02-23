import Loading from '@/components/Loading';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCrm } from '@/hooks/useCrm';
import { useTasks } from '@/hooks/useTasks';
import api from '@/lib/axios';
import {
  KanbanColumn,
  Task,
  TaskCustomFieldValue,
  TaskFilters,
} from '@/types/crm';
import { useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { TaskCard } from './components/TaskCard';

interface TasksKanbanProps {
  filters: TaskFilters;
  onTaskClick: (taskId: number) => void;
}

export function TasksKanban({ filters, onTaskClick }: TasksKanbanProps) {
  const { useTasks: useTasksQuery } = useTasks();
  const { useCustomFields } = useCrm();
  const queryClient = useQueryClient();
  const isDraggingRef = useRef(false);

  // Fetch all tasks (no pagination for kanban)
  const { data, isLoading } = useTasksQuery(filters, 1, 1000);
  const { data: customFields } = useCustomFields('task');

  const tasks = data?.tasks || [];

  // Get status field
  const statusField = customFields?.find((f) => f.field_name === 'status');
  const statusOptions = statusField?.field_options || [
    'To Do',
    'In Progress',
    'Review',
    'Done',
  ];

  // Group tasks by status
  const columns: KanbanColumn[] = useMemo(() => {
    return statusOptions.map((status) => ({
      id: status,
      title: status,
      tasks: tasks.filter((task: Task) => {
        const taskStatus = Object.values(task.custom_fields || {}).find(
          (f): f is TaskCustomFieldValue =>
            (f as TaskCustomFieldValue).field_name === 'status'
        );
        return taskStatus?.value === status;
      }),
    }));
  }, [statusOptions, tasks]);

  const handleDragStart = (e: React.DragEvent, taskId: number) => {
    isDraggingRef.current = true;
    e.dataTransfer.setData('taskId', String(taskId));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    isDraggingRef.current = false;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    const taskId = Number(e.dataTransfer.getData('taskId'));

    if (!taskId || !statusField) return;

    // Find the task to get its current status
    const task = tasks.find((t: Task) => Number(t.id) === Number(taskId));
    if (!task) return;

    const currentStatus = Object.values(task.custom_fields || {}).find(
      (f): f is TaskCustomFieldValue =>
        (f as TaskCustomFieldValue).field_name === 'status'
    );

    // Only update if status actually changed
    if (currentStatus?.value !== newStatus) {
      // Call API directly to suppress toasts for kanban drag-and-drop updates
      api
        .post(`/tasks/${taskId}`, {
          custom_fields: {
            [statusField.id]: newStatus,
          },
        })
        .then(() => {
          // Invalidate queries to refresh the UI
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
          queryClient.invalidateQueries({ queryKey: ['task', taskId] });
          queryClient.invalidateQueries({ queryKey: ['contact-tasks'] });
        })
        .catch(() => {
          // Silently handle errors for kanban drag-and-drop updates
        });
    }
  };

  if (isLoading) {
    return <Loading />;
  }

  if (!statusField) {
    return (
      <div className="flex justify-center items-center h-64 text-muted-foreground">
        No status field configured for tasks
      </div>
    );
  }

  return (
    <div className="flex overflow-x-auto gap-4 pb-4 h-full">
      {columns.map((column) => (
        <div
          key={column.id}
          className="flex-shrink-0 w-80"
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, column.id)}
        >
          <Card className="flex flex-col pb-0 h-full">
            <CardHeader className="flex justify-between items-center">
              <CardTitle className="text-base">{column.title}</CardTitle>
              <span className="text-sm font-normal text-muted-foreground">
                {column.tasks.length}
              </span>
            </CardHeader>
            <CardContent className="overflow-hidden flex-1 p-2">
              <ScrollArea className="h-full">
                <div
                  className="space-y-3"
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, column.id)}
                >
                  {column.tasks.length === 0 ? (
                    <div className="py-8 text-sm text-center text-muted-foreground">
                      No tasks
                    </div>
                  ) : (
                    column.tasks.map((task) => (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, task.id)}
                        onDragEnd={handleDragEnd}
                        className="cursor-move"
                      >
                        <TaskCard
                          task={task}
                          onClick={() => {
                            if (!isDraggingRef.current) {
                              onTaskClick(task.id);
                            }
                          }}
                        />
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  );
}
