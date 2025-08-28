import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface InfoTooltipProps {
  message: string;
}

export function InfoTooltip({ message }: InfoTooltipProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="inline-block ml-1 w-4 h-4 text-slate-400" />
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-base text-wrap">
          {message}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
