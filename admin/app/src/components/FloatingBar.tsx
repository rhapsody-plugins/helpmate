import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import usePersistedState from '@/hooks/usePersistedState';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

interface FloatingBarProps {
  className?: string;
  title?: string;
  buttonText?: string;
  articleTitle?: string;
  articleContent?: React.ReactNode;
}

export function FloatingBar({
  className,
  title = 'Helpmate Ai Chatbot is not just a chatbot, it helps you increase sales.',
  buttonText = 'Learn How',
  articleTitle = 'Helpmate Ai Chatbot is not just a chatbot, it helps you increase sales.',
  articleContent,
}: FloatingBarProps) {
  const [isCollapsed, setIsCollapsed] = usePersistedState(
    'helpmate_floating_bar_collapsed',
    false
  );
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <>
      <div
        className={cn(
          'flex fixed right-0 bottom-0 left-0 z-50 justify-between items-center p-3 mx-auto rounded-t-lg border shadow-2xl transition-all duration-300 bg-primary-200',
          isCollapsed ? 'p-2 max-w-fit max-h-fit' : 'p-3 max-w-2xl',
          className
        )}
      >
        <span
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -top-2 -right-2 w-fit rounded-full bg-primary-100 !p-1 cursor-pointer hover:bg-primary-100/90"
        >
          {isCollapsed ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )}
        </span>
        <div className="flex gap-3 justify-between items-center w-full">
          {!isCollapsed && (
            <div
              className={cn(
                'overflow-hidden ml-2 text-base transition-all duration-300 text-primary-950',
                isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
              )}
            >
              <div>{title}</div>
            </div>
          )}
          <div className="flex z-10 gap-2 items-center">
            <Button
              variant="outline"
              className="hover:bg-primary-100"
              size={isCollapsed ? 'xs' : 'sm'}
              onClick={() => setIsDialogOpen(true)}
            >
              {buttonText}
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="!max-w-4xl max-h-[80vh] overflow-y-auto gap-0">
          <DialogHeader>
            <DialogTitle className="!text-xl text-left">{articleTitle}</DialogTitle>
          </DialogHeader>
          <div>{articleContent}</div>
        </DialogContent>
      </Dialog>
    </>
  );
}
