'use client';

import { HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSettings } from '@/hooks/useSettings';
import type { FAQItem } from '@/types';
import { useMemo, useCallback } from 'react';

interface QuickOptionsProps {
  onOptionClick: (message: string) => void;
}

export function QuickOptions({ onOptionClick }: QuickOptionsProps) {
  const { getSettingsQuery } = useSettings();
  const { data: settings } = getSettingsQuery;

  // Memoize quickOptions to prevent unnecessary re-renders
  const quickOptions = useMemo(
    () => settings?.quick_options || [],
    [settings?.quick_options]
  );

  // Memoize click handler
  const handleOptionClick = useCallback(
    (title: string) => {
      onOptionClick(title);
    },
    [onOptionClick]
  );

  if (!quickOptions.length) return null;

  return (
    <div className="pb-2">
      <div className="flex overflow-x-auto gap-2 [scrollbar-width:none]">
        {quickOptions.map((option: FAQItem, index: number) => (
          <Button
            key={index}
            variant="outline"
            size="xs"
            className="flex gap-2 items-center whitespace-nowrap bg-white rounded-full"
            onClick={() => handleOptionClick(option.title)}
          >
            <HelpCircle size={16} />
            {option.title}
          </Button>
        ))}
      </div>
    </div>
  );
}
