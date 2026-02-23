'use client';

import { Code2Icon, EyeIcon } from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface CodeViewToolbarProps extends React.ComponentProps<'button'> {
  isCodeView: boolean;
  onToggle: () => void;
}

const CodeViewToolbar = React.forwardRef<
  HTMLButtonElement,
  CodeViewToolbarProps
>(({ className, onClick, isCodeView, onToggle, children, ...props }, ref) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          type="button"
          className={cn('h-8 w-8', isCodeView && 'bg-accent', className)}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggle();
            onClick?.(e);
          }}
          ref={ref}
          {...props}
        >
          {children ||
            (isCodeView ? (
              <EyeIcon className="w-4 h-4" />
            ) : (
              <Code2Icon className="w-4 h-4" />
            ))}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <span>{isCodeView ? 'Visual View' : 'Code View'}</span>
      </TooltipContent>
    </Tooltip>
  );
});

CodeViewToolbar.displayName = 'CodeViewToolbar';

export { CodeViewToolbar };
