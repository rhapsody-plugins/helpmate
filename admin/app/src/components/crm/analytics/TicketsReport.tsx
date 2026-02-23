import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { TicketsAnalytics } from '@/types/crm-analytics';
import { MessageSquare } from 'lucide-react';

interface TicketsReportProps {
  data: TicketsAnalytics;
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

export default function TicketsReport({ data }: TicketsReportProps) {
  return (
    <Card className="p-0 h-full">
      <div className="flex flex-col gap-2 justify-between p-6 h-full">
        <div className="flex gap-3 justify-between items-center">
          <div className="flex flex-col justify-center h-full">
            <h5 className="!text-sm !font-normal !my-0 !py-0">Tickets Created</h5>
            <span className="!text-2xl !font-semibold">{data.created}</span>
          </div>
          <MessageSquare size={30} strokeWidth={1.5} className="text-purple-500" />
        </div>
        <Separator />
        <div className="flex flex-col gap-1">
          <h5 className="!text-sm !font-normal !my-0 !py-0">Tickets Resolved</h5>
          <div className="flex gap-1 justify-between items-center">
            <span className="!text-2xl !font-semibold">{data.resolved}</span>
            <Badge variant={getBadgeVariant(data.comparison.resolved_change)}>
              {formatPercentage(data.comparison.resolved_change)}
            </Badge>
          </div>
        </div>
        <Separator />
        <div className="flex flex-col gap-1">
          <h5 className="!text-sm !font-normal !my-0 !py-0">Open Tickets</h5>
          <div className="flex gap-1 justify-between items-center">
            <span className="!text-2xl !font-semibold">{data.open}</span>
            <Badge variant="outline">Active</Badge>
          </div>
        </div>
        <Separator />
        <div className="flex flex-col gap-1">
          <h5 className="!text-sm !font-normal !my-0 !py-0">Avg Resolution Time</h5>
          <div className="flex gap-1 justify-between items-center">
            <span className="!text-2xl !font-semibold">
              {data.avg_resolution_time.toFixed(1)}h
            </span>
            <Badge variant={getBadgeVariant(data.comparison.resolution_time_change)}>
              {formatPercentage(data.comparison.resolution_time_change)}
            </Badge>
          </div>
        </div>
      </div>
    </Card>
  );
}

