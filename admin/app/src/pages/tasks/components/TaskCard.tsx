import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Task } from '@/types/crm';
import { OverdueIndicator } from './OverdueIndicator';
import { ContactPills } from './ContactPills';
import { Calendar, User } from 'lucide-react';
import { format } from 'date-fns';

interface TaskCardProps {
  task: Task;
  onClick?: () => void;
}

export function TaskCard({ task, onClick }: TaskCardProps) {
  const priorityField = Object.values(task.custom_fields || {}).find(
    (f) => f.field_name === 'priority'
  );
  const typeField = Object.values(task.custom_fields || {}).find(
    (f) => f.field_name === 'task_type'
  );

  const getPriorityVariant = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'urgent':
        return 'destructive';
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

  return (
    <Card
      className="transition-shadow cursor-pointer hover:shadow-md"
      onClick={onClick}
    >
      <CardHeader className="block">
        <div className="flex gap-2 justify-between items-start">
          <CardTitle className="text-base font-medium line-clamp-2">
            {task.title}
          </CardTitle>
          {task.is_overdue && <OverdueIndicator />}
        </div>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {task.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 !mt-0">
            {task.description}
          </p>
        )}

        <div className="flex flex-wrap gap-1.5">
          {task.assigned_to_name && (
            <div className="flex gap-1 items-center text-xs text-muted-foreground">
              <User className="w-3.5 h-3.5" />
              <span>{task.assigned_to_name}</span>
            </div>
          )}
          {task.due_date && (
            <div className="flex gap-1 items-center text-xs text-muted-foreground">
              <Calendar className="w-3.5 h-3.5" />
              <span>{format(new Date(task.due_date), 'MMM d, yyyy')}</span>
            </div>
          )}
          {priorityField && (
            <Badge
              variant={getPriorityVariant(priorityField.value as string)}
              className="text-xs"
            >
              {priorityField.value as string}
            </Badge>
          )}
          {typeField && (
            <Badge variant="secondary" className="text-xs">
              {typeField.value as string}
            </Badge>
          )}
          {task.contacts && task.contacts.length > 0 && (
            <ContactPills contacts={task.contacts} maxDisplay={2} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
