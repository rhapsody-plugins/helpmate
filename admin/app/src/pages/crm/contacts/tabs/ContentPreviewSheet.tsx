import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

interface ContentPreviewSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  content: React.ReactNode;
}

export function ContentPreviewSheet({
  open,
  onOpenChange,
  title,
  content,
}: ContentPreviewSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:!max-w-2xl flex flex-col h-full gap-0 overflow-hidden">
        <SheetHeader className="pb-4 mt-6 border-b">
          <SheetTitle className="text-lg font-bold !my-0">{title}</SheetTitle>
        </SheetHeader>
        <div className="overflow-y-auto flex-1 p-4 pt-6">{content}</div>
      </SheetContent>
    </Sheet>
  );
}
