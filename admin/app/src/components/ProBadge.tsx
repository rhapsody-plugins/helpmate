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

/**
 * Compact inline Pro badge for reply input area - stays within bounds, no overflow.
 */
interface ProBadgeInputProps {
  message?: string;
  className?: string;
}

export function ProBadgeInput({
  message = 'Upgrade to Pro to reply manually.',
  className,
}: ProBadgeInputProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap gap-2 items-center justify-center py-2 px-3 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800',
        className
      )}
    >
      <span className="inline-flex px-2 py-0.5 text-xs font-medium text-white bg-orange-500 rounded shrink-0">
        Pro Only
      </span>
      <span className="text-sm text-muted-foreground shrink min-w-0">
        {message}
      </span>
      <Button
        size="sm"
        variant="default"
        className="shrink-0"
        onClick={() => window.open(HelpmatePricingURL, '_blank')}
      >
        Go Pro <Crown className="w-3.5 h-3.5 ml-1" />
      </Button>
    </div>
  );
}

interface ProBadgeInlineProps {
  className?: string;
}

export function ProBadgeInline({ className }: ProBadgeInlineProps) {
  return (
    <span
      className={cn(
        'inline-flex px-2 py-0.5 text-xs font-medium text-white bg-orange-500 rounded',
        className
      )}
    >
      Pro Only
    </span>
  );
}

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
