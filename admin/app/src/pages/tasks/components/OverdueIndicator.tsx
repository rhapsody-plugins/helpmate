import { Badge } from '@/components/ui/badge';
import { __ } from '@/lib/utils';
import { Clock } from 'lucide-react';

export function OverdueIndicator() {
  return (
    <Badge variant="destructive" className="animate-pulse text-xs">
      <Clock className="w-3 h-3 mr-1" />
      {__('Overdue')}
    </Badge>
  );
}
