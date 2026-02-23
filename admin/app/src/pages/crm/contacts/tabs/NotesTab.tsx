import { ReusableTable } from '@/components/ReusableTable';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { useCrm } from '@/hooks/useCrm';
import { ContactNote } from '@/types/crm';
import { ColumnDef } from '@tanstack/react-table';
import { formatDistanceToNow } from 'date-fns';
import { Pencil, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { parseUTCDate, defaultLocale } from '../utils';
import { NoteEditSheet } from './NoteEditSheet';

interface NotesTabProps {
  contactId: number | null;
}

const PAGE_SIZE = 10;

export function NotesTab({ contactId }: NotesTabProps) {
  const {
    useContactNotes,
    createNoteMutation,
    updateNoteMutation,
    deleteNoteMutation,
  } = useCrm();
  const [currentPage, setCurrentPage] = useState(1);
  const [newNote, setNewNote] = useState('');
  const [editingNote, setEditingNote] = useState<ContactNote | null>(null);
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);

  const { data: notesData, isLoading } = useContactNotes(
    contactId,
    currentPage,
    PAGE_SIZE,
    contactId !== null
  );
  const notes = notesData?.notes || [];
  const pagination = notesData?.pagination;

  // Reset to page 1 when contactId changes
  useEffect(() => {
    setCurrentPage(1);
  }, [contactId]);

  const handleAddNote = () => {
    if (!contactId || !newNote.trim()) return;
    createNoteMutation.mutate(
      { contactId, content: newNote },
      {
        onSuccess: () => setNewNote(''),
      }
    );
  };

  const handleEditNote = (note: ContactNote, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingNote(note);
    setIsEditSheetOpen(true);
  };

  const handleSaveEdit = (noteId: number, content: string) => {
    updateNoteMutation.mutate(
      { noteId, content },
      {
        onSuccess: () => {
          setIsEditSheetOpen(false);
          setEditingNote(null);
        },
      }
    );
  };

  const handleDeleteNote = (noteId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this note?')) {
      deleteNoteMutation.mutate(noteId);
    }
  };

  const columns: ColumnDef<ContactNote>[] = [
    {
      accessorKey: 'note_content',
      header: 'Content',
      cell: ({ row }) => (
        <div className="max-w-md text-sm line-clamp-2">
          {row.original.note_content}
        </div>
      ),
    },
    {
      accessorKey: 'created_by_name',
      header: 'Created By',
      cell: ({ row }) => row.original.created_by_name || 'Unknown',
    },
    {
      accessorKey: 'created_at',
      header: 'Created At',
      cell: ({ row }) =>
        formatDistanceToNow(parseUTCDate(row.original.created_at), {
          addSuffix: true,
          locale: defaultLocale,
        }),
    },
    {
      id: 'actions',
      header: '',
      meta: { className: 'text-right' },
      cell: ({ row }) => (
        <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => handleEditNote(row.original, e)}
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={(e) => handleDeleteNote(row.original.id, e)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="space-y-4">
        <div>
          <h3 className="!text-xl !font-semibold !mt-1 !p-0 !mb-2">Add Note</h3>
          <Textarea
            placeholder="Enter note content..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            rows={4}
          />
          <Button onClick={handleAddNote} className="mt-2" size="sm">
            Add Note
          </Button>
        </div>

        <Separator />

        <Card>
          <CardHeader>
            <CardTitle className="!text-lg !my-0">
              Notes ({pagination?.total || notes.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ReusableTable
              columns={columns}
              data={notes}
              loading={isLoading}
              showPagination={true}
              serverSidePagination={true}
              totalCount={pagination?.total || 0}
              currentPage={currentPage}
              pageSize={PAGE_SIZE}
              onPageChange={setCurrentPage}
            />
          </CardContent>
        </Card>
      </div>

      <NoteEditSheet
        open={isEditSheetOpen}
        onOpenChange={setIsEditSheetOpen}
        note={editingNote}
        onSave={handleSaveEdit}
        isSaving={updateNoteMutation.isPending}
      />
    </>
  );
}
