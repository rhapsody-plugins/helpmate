import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { ContactNote } from '@/types/crm';
import { useEffect, useState } from 'react';

interface NoteEditSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  note: ContactNote | null;
  onSave: (noteId: number, content: string) => void;
  isSaving?: boolean;
}

export function NoteEditSheet({
  open,
  onOpenChange,
  note,
  onSave,
  isSaving = false,
}: NoteEditSheetProps) {
  const [content, setContent] = useState('');

  useEffect(() => {
    if (note) {
      setContent(note.note_content);
    }
  }, [note]);

  const handleSave = () => {
    if (note && content.trim()) {
      onSave(note.id, content);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:!max-w-lg flex flex-col h-full gap-0 overflow-hidden">
        <SheetHeader className="pb-4 mt-6 border-b">
          <SheetTitle className="text-lg font-bold !my-0">Edit Note</SheetTitle>
        </SheetHeader>
        <div className="overflow-y-auto flex-1 p-4 pt-6 space-y-4">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={8}
            placeholder="Enter note content..."
          />
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !content.trim()}>
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
