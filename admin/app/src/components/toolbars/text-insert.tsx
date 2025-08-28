'use client';

import React from 'react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useToolbar } from '@/components/toolbars/toolbar-provider';

interface TextInsertToolbarProps {
  texts: string[];
}

const TextInsertToolbar = React.forwardRef<HTMLDivElement, TextInsertToolbarProps>(
  ({ texts }, ref) => {
    const { editor } = useToolbar();

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center" ref={ref}>
            <Select
              onValueChange={(value) => {
                editor?.chain().focus().insertContent(value).run();
              }}
            >
              <SelectTrigger className="h-8 w-[120px]">
                <SelectValue placeholder="Insert text" />
              </SelectTrigger>
              <SelectContent>
                {texts.map((text, index) => (
                  <SelectItem key={index} value={text}>
                    {text}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <span>Insert predefined text</span>
        </TooltipContent>
      </Tooltip>
    );
  }
);

TextInsertToolbar.displayName = 'TextInsertToolbar';

export { TextInsertToolbar };