import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Plug, ScrollText } from 'lucide-react';

type IntegrationCardProps = {
  title: string;
  description: string;
  statusClass: string;
  statusText: string;
  onConfigure: () => void;
  onLogs: () => void;
  className?: string;
};

export default function IntegrationCard({
  title,
  description,
  statusClass,
  statusText,
  onConfigure,
  onLogs,
  className,
}: IntegrationCardProps) {
  return (
    <Card className={cn('p-6', className)}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-4 items-center min-w-0">
          <div className="p-2 rounded-lg bg-primary/10 shrink-0">
            <Plug className="w-5 h-5 text-primary" strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <h3 className="!text-lg !font-semibold !my-0 !py-0">{title}</h3>
            <p className="!text-sm !text-muted-foreground !my-0 !py-0 mt-1">
              {description}
            </p>
            <p className={cn('!text-xs !my-0 !py-0 !mt-1', statusClass)}>
              {statusText}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button type="button" onClick={onConfigure}>
            Configure
          </Button>
          <Button type="button" variant="outline" onClick={onLogs}>
            <ScrollText className="size-4" />
            Logs
          </Button>
        </div>
      </div>
    </Card>
  );
}
