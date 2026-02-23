import { useEffect, useState } from 'react';
import PageHeader from '@/components/PageHeader';
import PageGuard from '@/components/PageGuard';
import { ProBadge } from '@/components/ProBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSettings } from '@/hooks/useSettings';
import { cn } from '@/lib/utils';
import { TaskFilters as TaskFiltersType } from '@/types/crm';
import { TaskFilters, getTaskFilterCount } from './TaskFilters';
import { TasksListView } from './TasksListView';
import { TasksKanban } from './TasksKanban';
import { TaskDetails } from './TaskDetails';
import { Plus, List, LayoutGrid, Filter } from 'lucide-react';

type ViewMode = 'list' | 'kanban';

export default function TasksList() {
  const { getProQuery } = useSettings();
  const isPro = getProQuery.data ?? false;
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [filters, setFilters] = useState<TaskFiltersType>({});
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);

  const handleTaskClick = (taskId: number) => {
    setSelectedTaskId(taskId);
    setShowTaskDialog(true);
  };

  const handleCreateTask = () => {
    setSelectedTaskId(null);
    setShowTaskDialog(true);
  };

  const handleCloseDialog = () => {
    setShowTaskDialog(false);
    setSelectedTaskId(null);
  };

  // Auto-open task from URL (e.g. from email notification link)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const taskIdParam = params.get('task_id');
    if (taskIdParam) {
      const taskId = parseInt(taskIdParam, 10);
      if (!Number.isNaN(taskId) && taskId > 0) {
        setSelectedTaskId(taskId);
        setShowTaskDialog(true);
        params.delete('task_id');
        const query = params.toString();
        const newUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, []);

  return (
    <PageGuard page="tasks">
      <div className="gap-0 relative">
        {!isPro && (
          <ProBadge
            topMessage="Create and manage tasks. Track follow-ups, deadlines, and assignments."
            buttonText="Unlock Tasks"
            tooltipMessage={null}
          />
        )}
        <PageHeader
          title="Tasks"
          rightActions={
            <div className="flex gap-2 items-center">
              <TaskFilters
                filters={filters}
                onFiltersChange={setFilters}
                open={filterPopoverOpen}
                onOpenChange={setFilterPopoverOpen}
              >
                <Button
                  variant={filterPopoverOpen ? 'default' : 'outline'}
                  size="sm"
                  className="relative"
                >
                  <Filter className="w-4 h-4" />
                  {getTaskFilterCount(filters) > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                      {getTaskFilterCount(filters)}
                    </span>
                  )}
                </Button>
              </TaskFilters>
              <div className="flex items-center rounded-md border">
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="icon"
                  onClick={() => setViewMode('list')}
                  aria-label="List view"
                  className="rounded-r-none"
                >
                  <List className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === 'kanban' ? 'default' : 'ghost'}
                  size="icon"
                  onClick={() => setViewMode('kanban')}
                  aria-label="Kanban view"
                  className="rounded-l-none"
                >
                  <LayoutGrid className="w-4 h-4" />
                </Button>
              </div>
              <Button onClick={handleCreateTask} disabled={!isPro}>
                <Plus className="mr-2 w-4 h-4" />
                Add Task
              </Button>
            </div>
          }
        />

        <div className="overflow-auto flex-1 p-6">
          <Card
            className={cn(
              !isPro && 'opacity-50 cursor-not-allowed pointer-events-none'
            )}
          >
            <CardHeader>
              <CardTitle className="!text-lg !my-0">Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              {viewMode === 'list' ? (
                <TasksListView filters={filters} onTaskClick={handleTaskClick} />
              ) : (
                <TasksKanban filters={filters} onTaskClick={handleTaskClick} />
              )}
            </CardContent>
          </Card>
        </div>

        <TaskDetails
          open={showTaskDialog}
          onOpenChange={handleCloseDialog}
          taskId={selectedTaskId}
        />
      </div>
    </PageGuard>
  );
}
