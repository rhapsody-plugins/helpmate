import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Crown } from 'lucide-react';
import { HelpmatePricingURL } from '@/lib/constants';

interface ProBadgeProps {
  tooltipMessage?: string | null;
  topMessage?: string;
  className?: string;
  buttonText?: string;
  link?: string;
  messageBg?: string;
}

export function ProBadge({
  tooltipMessage = 'Increase sales significantly',
  topMessage,
  className,
  buttonText = 'Go Pro',
  link = HelpmatePricingURL,
  messageBg = 'bg-white',
}: ProBadgeProps) {
  return (
    <div
      className={cn(
        'flex absolute top-0 right-0 bottom-0 left-0 z-10 flex-col justify-center items-center m-auto w-fit h-fit',
        className
      )}
    >
      <div className="px-2 py-1 mx-auto text-xs text-white bg-orange-500 rounded">
        Pro Only
      </div>
      {topMessage && (
        <p
          className={cn(
            'p-3 text-center rounded-lg !text-base lg:!text-[16px] max-w-[400px]',
            messageBg
          )}
        >
          {topMessage}
        </p>
      )}
      {tooltipMessage ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className="shadow-xl"
                onClick={() => window.open(link, '_blank')}
              >
                {buttonText} <Crown />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="!m-0 text-base">{tooltipMessage}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <Button
          className="shadow-xl"
          onClick={() => window.open(link, '_blank')}
        >
          {buttonText} <Crown />
        </Button>
      )}
    </div>
  );
}
