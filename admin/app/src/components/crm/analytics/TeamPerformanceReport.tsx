import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TeamMemberPerformance } from '@/types/crm-analytics';
import { __ } from '@/lib/utils';
import { Users } from 'lucide-react';

interface TeamPerformanceReportProps {
  data: TeamMemberPerformance[];
}

export default function TeamPerformanceReport({
  data,
}: TeamPerformanceReportProps) {
  if (!data || data.length === 0) {
    return (
      <Card className="p-0 h-full">
        <div className="p-6 h-full flex flex-col justify-center items-center text-muted-foreground">
          <Users className="mb-2 w-8 h-8" />
          <p className="text-sm">{__('No team performance data available')}</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-0 h-full">
      <div className="p-6 h-full flex flex-col">
        <h5 className="!text-sm !font-normal !my-0 !py-0 !mb-4">
          {__('Team Performance')}
        </h5>
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{__('Member')}</TableHead>
                <TableHead className="text-right">{__('Tasks Created')}</TableHead>
                <TableHead className="text-right">{__('Tasks Completed')}</TableHead>
                <TableHead className="text-right">{__('Tickets Resolved')}</TableHead>
                <TableHead className="text-right">{__('Contacts Created')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((member) => (
                <TableRow key={member.user_id}>
                  <TableCell className="font-medium">
                    {member.display_name}
                  </TableCell>
                  <TableCell className="text-right">
                    {member.tasks_created}
                  </TableCell>
                  <TableCell className="text-right">
                    {member.tasks_completed}
                  </TableCell>
                  <TableCell className="text-right">
                    {member.tickets_resolved}
                  </TableCell>
                  <TableCell className="text-right">
                    {member.contacts_created}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </Card>
  );
}

