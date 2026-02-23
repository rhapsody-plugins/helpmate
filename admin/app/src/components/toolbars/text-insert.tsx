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

interface VariableGroup {
  label: string;
  variables: string[];
}

interface TextInsertToolbarProps {
  texts: string[];
  grouped?: VariableGroup[];
}

const TextInsertToolbar = React.forwardRef<HTMLDivElement, TextInsertToolbarProps>(
  ({ texts, grouped }, ref) => {
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
              <SelectTrigger className="h-8 w-[180px]">
                <SelectValue placeholder="Insert variable" />
              </SelectTrigger>
              <SelectContent>
                {grouped && grouped.length > 0 ? (
                  <>
                    {grouped.map((group, groupIndex) => (
                      <React.Fragment key={groupIndex}>
                        {groupIndex > 0 && (
                          <div className="my-1 border-t border-border" />
                        )}
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground pointer-events-none">
                          {group.label}
                        </div>
                        {group.variables.map((variable, varIndex) => (
                          <SelectItem key={`${groupIndex}-${varIndex}`} value={variable}>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm">{variable}</span>
                              <span className="text-xs text-muted-foreground">
                                {variable.replace(/[{}]/g, '').replace(/_/g, ' ')}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </React.Fragment>
                    ))}
                  </>
                ) : (
                  texts.map((text, index) => (
                    <SelectItem key={index} value={text}>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">{text}</span>
                        <span className="text-xs text-muted-foreground">
                          {text.replace(/[{}]/g, '').replace(/_/g, ' ')}
                        </span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <span>Insert variable</span>
        </TooltipContent>
      </Tooltip>
    );
  }
);

TextInsertToolbar.displayName = 'TextInsertToolbar';

export { TextInsertToolbar };