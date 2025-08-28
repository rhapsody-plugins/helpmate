'use client';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { FAQItem } from '@/types';

interface FAQOptionsProps {
  faqs: FAQItem[];
  onQuestionClick: (question: string) => void;
}

export function FAQOptions({ faqs, onQuestionClick }: FAQOptionsProps) {
  return (
    <div className="my-2 space-y-2">
      <p className="mb-1 text-xs text-slate-500">Select a question:</p>
      {faqs.length === 0 ? (
        <p className="text-sm italic text-slate-400">No FAQs available</p>
      ) : (
        faqs.map((faq, index) => (
          <Button
            key={index}
            variant="outline"
            size="sm"
            className="justify-between px-3 py-2 w-full h-auto text-sm font-normal text-left"
            onClick={() => onQuestionClick(faq.title)}
          >
            <span className="mr-2 truncate">{faq.title}</span>
            <ChevronRight size={16} className="flex-shrink-0 text-slate-400" />
          </Button>
        ))
      )}
    </div>
  );
}
