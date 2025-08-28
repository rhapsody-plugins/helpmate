import { ReusableTable } from '@/components/ReusableTable';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useDataSource } from '@/hooks/useDataSource';
import { DataSource } from '@/types';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

const formSchema = z.object({
  title: z.string(),
  content: z.string().min(1, 'Content is required'),
  file_name: z.string(),
});

type FormData = z.infer<typeof formSchema>;

export default function TabFile() {
  const { getSourcesMutation, addSourceMutation, removeSourceMutation } =
    useDataSource();

  const {
    data: fetchData,
    isPending: isFetching,
    mutate: fetchMutate,
  } = getSourcesMutation;

  const { isPending: addIsPending, mutate: addMutate } = addSourceMutation;

  const { isPending: removeIsPending, mutate: removeMutate } =
    removeSourceMutation;

  const form = useForm<FormData>({
    defaultValues: {
      title: '',
      content: '',
      file_name: '',
    },
    resolver: zodResolver(formSchema),
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [isContentSheetOpen, setIsContentSheetOpen] = useState(false);
  const [selectedContent, setSelectedContent] = useState<string>('');
  const [searchFilterSaved, setSearchFilterSaved] = useState<string>('');

  /*
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │   Handlers                                                                  │
  └─────────────────────────────────────────────────────────────────────────────┘
 */

  // Initial data fetch
  useEffect(() => {
    fetchMutate('file');
  }, [fetchMutate]);

  const handleSubmit = useCallback(
    (data: FormData) => {
      addMutate(
        {
          document_type: 'file',
          title: data.title,
          content: data.content,
          metadata: {
            file_name: data.file_name,
          },
        },
        {
          onSuccess: () => {
            form.reset({
              title: '',
              content: '',
              file_name: '',
            });
            if (fileInputRef.current) {
              fileInputRef.current.value = '';
            }
          },
        }
      );
    },
    [addMutate]
  );

  const handleRemove = useCallback(
    (id: number) => {
      removeMutate({
        ids: [id],
        type: 'file',
      });
    },
    [removeMutate]
  );

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        // Check file size (3MB = 3 * 1024 * 1024 bytes)
        const maxSize = 3 * 1024 * 1024;
        if (file.size > maxSize) {
          toast.error(
            'File size exceeds 3MB limit. Please choose a smaller file.'
          );
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
          setSelectedFileName('');
          return;
        }

        // Check file type
        const allowedTypes = ['.csv', '.txt', '.json'];
        const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
        if (!allowedTypes.includes(fileExtension)) {
          toast.error(
            'Invalid file type. Please choose a CSV, TXT, or JSON file.'
          );
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
          setSelectedFileName('');
          return;
        }

        setSelectedFileName(file.name);
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          form.setValue('content', content);
          form.setValue('file_name', file.name);
        };
        reader.readAsText(file);
      } else {
        setSelectedFileName('');
      }
    },
    [form]
  );

  const columns = useMemo<ColumnDef<DataSource>[]>(
    () => [
      {
        accessorKey: 'title',
        header: 'Title',
      },
      {
        accessorKey: 'metadata',
        header: 'File Name',
        cell: ({ row }) => {
          const metadata = row.getValue('metadata') as string;
          const parsedMetadata = JSON.parse(metadata);
          return (
            <div
              className="max-w-[150px] truncate"
              title={parsedMetadata.file_name}
            >
              {parsedMetadata.file_name}
            </div>
          );
        },
      },
      {
        accessorKey: 'content',
        header: 'Content',
        cell: ({ row }) => {
          const content = row.getValue('content') as string;
          return (
            <div className="max-w-xs truncate" title={content}>
              {content}
            </div>
          );
        },
      },
      {
        accessorKey: 'last_updated',
        header: 'Last Updated',
        cell: ({ row }) => {
          const timestamp = row.getValue('last_updated') as number;
          return format(new Date(timestamp * 1000), 'PPpp');
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedContent(row.original.content);
                setIsContentSheetOpen(true);
              }}
            >
              View
            </Button>
            <Button
              variant="destructive"
              size="sm"
              loading={removeIsPending}
              disabled={removeIsPending}
              onClick={() => handleRemove(row.original.id)}
            >
              Delete
            </Button>
          </div>
        ),
      },
    ],
    [handleRemove, removeIsPending]
  );

  /*
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │   Renders                                                                   │
  └─────────────────────────────────────────────────────────────────────────────┘
 */

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex gap-1 items-center text-xl font-bold">
            File Source{' '}
            <InfoTooltip message="Add a file source to your Helpmate." />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-6"
            >
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter text" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="content"
                render={() => (
                  <FormItem>
                    <FormLabel>File</FormLabel>
                    <FormControl>
                      <div className="flex gap-4 items-center">
                        <Input
                          ref={fileInputRef}
                          type="file"
                          accept=".csv,.txt,.json"
                          className="hidden"
                          onChange={handleFileChange}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          Choose File
                        </Button>
                        <span className="text-sm text-muted-foreground">
                          {selectedFileName || 'No file chosen'}
                        </span>
                      </div>
                    </FormControl>
                    <FormDescription>
                      CSV, TXT, and JSON formats are supported. Maximum file
                      size: 3MB.
                    </FormDescription>
                  </FormItem>
                )}
              />
              <Button
                disabled={addIsPending}
                loading={addIsPending}
                type="submit"
              >
                {addIsPending ? 'Saving...' : 'Save'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-xl font-bold">
              Saved File Sources
            </CardTitle>
            <Input
              placeholder="Search saved files..."
              value={searchFilterSaved}
              onChange={(event) => setSearchFilterSaved(event.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          <ReusableTable
            columns={columns}
            data={fetchData || []}
            className="w-full"
            rightAlignedColumns={['actions']}
            loading={isFetching}
            globalFilter={searchFilterSaved}
            onGlobalFilterChange={setSearchFilterSaved}
          />
        </CardContent>
      </Card>

      <Sheet open={isContentSheetOpen} onOpenChange={setIsContentSheetOpen}>
        <SheetContent className="sm:!max-w-2xl flex flex-col h-full gap-0">
          <SheetHeader className="mt-6">
            <SheetTitle className="text-lg font-bold !my-0">
              File Content
            </SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto flex-1 p-4 pt-0">
            <pre className="p-4 whitespace-pre-wrap break-words rounded-lg bg-muted">
              {selectedContent}
            </pre>
            <Button
              className="mt-4"
              variant="outline"
              onClick={() => setIsContentSheetOpen(false)}
            >
              Close
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
