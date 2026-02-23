import { Card } from '@/components/ui/card';
import { EmailsAnalytics } from '@/types/crm-analytics';
import { Mail } from 'lucide-react';

interface EmailsReportProps {
  data: EmailsAnalytics;
}

export default function EmailsReport({ data }: EmailsReportProps) {
  return (
    <Card className="p-0 h-full">
      <div className="flex flex-col gap-2 justify-between p-6 h-full">
        <div className="flex gap-3 justify-between items-center">
          <div className="flex flex-col justify-center h-full">
            <h5 className="!text-sm !font-normal !my-0 !py-0">Emails Sent</h5>
            <span className="!text-2xl !font-semibold">{data.sent}</span>
          </div>
          <Mail size={30} strokeWidth={1.5} className="text-blue-500" />
        </div>
      </div>
    </Card>
  );
}

