import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { TasksAnalytics } from '@/types/crm-analytics';
import { Clock } from 'lucide-react';

interface TasksReportProps {
  data: TasksAnalytics;
}

const formatPercentage = (value: number) => {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
};

const getBadgeVariant = (value: number) => {
  if (value > 0) return 'secondary';
  if (value < 0) return 'destructive';
  return 'default';
};

export default function TasksReport({ data }: TasksReportProps) {
  return (
    <Card className="p-0 h-full bg-primary/10">
      <div className="flex flex-col gap-2 justify-between p-6 h-full">
        <div className="flex flex-col gap-1">
          <h5 className="!text-sm !font-normal !my-0 !py-0">Tasks Created</h5>
          <div className="flex gap-1 justify-between items-center">
            <span className="!text-2xl !font-semibold">{data.created}</span>
            <Badge variant={getBadgeVariant(data.comparison.created_change)}>
              {formatPercentage(data.comparison.created_change)}
            </Badge>
          </div>
        </div>
        <Separator />
        <div className="flex flex-col gap-1">
          <h5 className="!text-sm !font-normal !my-0 !py-0">Tasks Completed</h5>
          <div className="flex gap-1 justify-between items-center">
            <span className="!text-2xl !font-semibold">{data.completed}</span>
            <Badge variant={getBadgeVariant(data.comparison.completed_change)}>
              {formatPercentage(data.comparison.completed_change)}
            </Badge>
          </div>
        </div>
        <Separator />
        <div className="flex flex-col gap-1">
          <h5 className="!text-sm !font-normal !my-0 !py-0">Completion Rate</h5>
          <div className="flex gap-1 justify-between items-center">
            <span className="!text-2xl !font-semibold">
              {data.completion_rate.toFixed(2)}%
            </span>
            <Badge variant={getBadgeVariant(data.comparison.completion_rate_change)}>
              {formatPercentage(data.comparison.completion_rate_change)}
            </Badge>
          </div>
        </div>
        <Separator />
        <div className="flex flex-col gap-1">
          <h5 className="!text-sm !font-normal !my-0 !py-0">Overdue Tasks</h5>
          <div className="flex gap-1 justify-between items-center">
            <span className="!text-2xl !font-semibold">{data.overdue}</span>
            <Clock size={20} className="text-orange-500" />
          </div>
        </div>
      </div>
    </Card>
  );
}

