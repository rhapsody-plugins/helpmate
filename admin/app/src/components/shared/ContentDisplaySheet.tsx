import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

interface ContentDisplaySheetProps {
  isOpen: boolean;
  onClose: () => void;
  content: string;
  title: string;
  isDynamicContent: (content: string) => boolean;
  getDynamicContentExplanation: (content: string) => string;
}

export function ContentDisplaySheet({
  isOpen,
  onClose,
  content,
  title,
  isDynamicContent,
  getDynamicContentExplanation,
}: ContentDisplaySheetProps) {
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="sm:!max-w-2xl flex flex-col h-full gap-0">
        <SheetHeader className="mt-6">
          <SheetTitle className="text-lg font-bold !my-0">
            {title}
          </SheetTitle>
        </SheetHeader>
        <div className="overflow-y-auto flex-1 p-4 pt-0">
          {isDynamicContent(content) && (
            <div className="p-3 mb-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800">
                <strong>Dynamic Content Detected:</strong>{' '}
                {getDynamicContentExplanation(content)}
              </p>
            </div>
          )}
          <div className="p-4 rounded-lg bg-muted">
            <div dangerouslySetInnerHTML={{ __html: content }} />
          </div>
          <Button
            className="mt-4"
            variant="outline"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
