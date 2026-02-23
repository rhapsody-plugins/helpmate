import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ContactsAnalytics } from '@/types/crm-analytics';
import { Users, Mail } from 'lucide-react';

interface ContactsReportProps {
  data: ContactsAnalytics;
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

export default function ContactsReport({ data }: ContactsReportProps) {
  return (
    <Card className="p-0 h-full">
      <div className="flex flex-col gap-2 justify-between p-6 h-full">
        <div className="flex gap-3 justify-between items-center">
          <div className="flex flex-col justify-center h-full">
            <h5 className="!text-sm !font-normal !my-0 !py-0">Total Contacts</h5>
            <span className="!text-2xl !font-semibold">{data.total}</span>
          </div>
          <Users size={30} strokeWidth={1.5} className="text-blue-500" />
        </div>
        <Separator />
        <div className="flex flex-col gap-1">
          <h5 className="!text-sm !font-normal !my-0 !py-0">Contacts Created</h5>
          <div className="flex gap-1 justify-between items-center">
            <span className="!text-2xl !font-semibold">{data.created}</span>
            <Badge variant={getBadgeVariant(data.comparison.created_change)}>
              {formatPercentage(data.comparison.created_change)}
            </Badge>
          </div>
        </div>
        <Separator />
        <div className="flex flex-col gap-1">
          <h5 className="!text-sm !font-normal !my-0 !py-0">Contacts Updated</h5>
          <div className="flex gap-1 justify-between items-center">
            <span className="!text-2xl !font-semibold">{data.updated}</span>
            <Badge variant={getBadgeVariant(data.comparison.updated_change)}>
              {formatPercentage(data.comparison.updated_change)}
            </Badge>
          </div>
        </div>
        {data.emails_sent !== undefined && (
          <>
            <Separator />
            <div className="flex gap-2 justify-between items-center">
              <div className="flex flex-col gap-1">
                <h5 className="!text-sm !font-normal !my-0 !py-0">Emails Sent</h5>
                <span className="!text-xl !font-semibold">{data.emails_sent}</span>
              </div>
              <Mail size={24} strokeWidth={1.5} className="text-blue-500 opacity-60" />
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

