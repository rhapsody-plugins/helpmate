import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { LeadsAnalytics } from '@/types/crm-analytics';
import { UserPlus } from 'lucide-react';

interface LeadsReportProps {
  data: LeadsAnalytics;
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

export default function LeadsReport({ data }: LeadsReportProps) {
  return (
    <Card className="p-0 h-full bg-green-50">
      <div className="flex flex-col gap-2 justify-between p-6 h-full">
        <div className="flex gap-3 justify-between items-center">
          <div className="flex flex-col justify-center h-full">
            <h5 className="!text-sm !font-normal !my-0 !py-0">Leads Created</h5>
            <span className="!text-2xl !font-semibold">{data.created}</span>
          </div>
          <UserPlus size={30} strokeWidth={1.5} className="text-green-500" />
        </div>
        <Separator />
        <div className="flex flex-col gap-1">
          <h5 className="!text-sm !font-normal !my-0 !py-0">Leads Converted</h5>
          <div className="flex gap-1 justify-between items-center">
            <span className="!text-2xl !font-semibold">{data.converted}</span>
            <Badge variant={getBadgeVariant(data.comparison.converted_change)}>
              {formatPercentage(data.comparison.converted_change)}
            </Badge>
          </div>
        </div>
        <Separator />
        <div className="flex flex-col gap-1">
          <h5 className="!text-sm !font-normal !my-0 !py-0">Conversion Rate</h5>
          <div className="flex gap-1 justify-between items-center">
            <span className="!text-2xl !font-semibold">
              {data.conversion_rate.toFixed(2)}%
            </span>
            <Badge variant={getBadgeVariant(data.comparison.conversion_rate_change)}>
              {formatPercentage(data.comparison.conversion_rate_change)}
            </Badge>
          </div>
        </div>
      </div>
    </Card>
  );
}

