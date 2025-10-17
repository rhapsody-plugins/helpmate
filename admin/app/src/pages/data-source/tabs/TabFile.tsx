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
import { useSettings } from '@/hooks/useSettings';
import api from '@/lib/axios';
import { DataSource } from '@/types';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

const formSchema = z
  .object({
    title: z.string().min(1, 'Title is required'),
    content: z.string().optional(),
    file_name: z.string().optional(),
    selectedFile: z.instanceof(File).optional(),
  })
  .refine(
    (data) => {
      // Either content must be provided OR a file must be selected
      return data.content || data.selectedFile;
    },
    {
      message: 'Either provide content or select a file',
      path: ['content'],
    }
  );

type FormData = z.infer<typeof formSchema>;

export default function TabFile() {
  const { getSourcesMutation, addSourceMutation, removeSourceMutation } =
    useDataSource();
  const { getProQuery } = useSettings();
  const { data: isPro } = getProQuery;

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
      content: undefined,
      file_name: undefined,
      selectedFile: undefined,
    },
    resolver: zodResolver(formSchema),
  });
  console.log(form.formState.errors);

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
    async (data: FormData) => {
      // If we have a selected file, extract text first
      if (data.selectedFile) {
        try {
          toast.loading('Extracting text from file...');

          const file = data.selectedFile;
          const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();

          // Handle office files (PDF, DOCX, XLSX) - upload to backend for extraction
          const officeTypes = ['.pdf', '.doc', '.docx', '.xls', '.xlsx'];
          if (officeTypes.includes(fileExtension)) {
            const formData = new FormData();
            formData.append('file', file);

            // Call the Helpmate backend which proxies to license server
            const response = await api.post('/extract-file-text', formData, {
              headers: {
                'Content-Type': 'multipart/form-data',
              },
            });

            const responseData = response.data;
            toast.dismiss();

            if (responseData.error) {
              toast.error(
                responseData.message || 'Failed to extract text from file.'
              );
              return;
            }

            data.content = responseData.text;
            data.file_name = file.name;
            toast.success('Text extracted successfully!');
          } else {
            // Handle text-based files (CSV, TXT, JSON)
            const content = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = (e) => resolve(e.target?.result as string);
              reader.onerror = reject;
              reader.readAsText(file);
            });

            data.content = content;
            data.file_name = file.name;
            toast.dismiss();
          }
        } catch (error) {
          toast.dismiss();
          console.error('Error extracting text:', error);
          toast.error(
            'Failed to extract text from file. Please try another file.'
          );
          return;
        }
      }

      // Ensure we have content before submitting
      if (!data.content) {
        toast.error('No content available to submit.');
        return;
      }

      addMutate(
        {
          document_type: 'file',
          title: data.title,
          content: data.content,
          metadata: {
            file_name: data.file_name || '',
          },
        },
        {
          onSuccess: () => {
            form.reset({
              title: '',
              content: undefined,
              file_name: undefined,
              selectedFile: undefined,
            });
            if (fileInputRef.current) {
              fileInputRef.current.value = '';
            }
            setSelectedFileName('');
          },
        }
      );
    },
    [addMutate, form]
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
        // Check file size - 300kb for free, 500kb for pro
        const maxSize = isPro ? 500 * 1024 : 300 * 1024;
        const maxSizeLabel = isPro ? '500KB' : '300KB';
        if (file.size > maxSize) {
          toast.error(
            `File size exceeds ${maxSizeLabel} limit. Please choose a smaller file.`
          );
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
          setSelectedFileName('');
          return;
        }

        // Check file type
        const allowedTypes = [
          '.csv',
          '.txt',
          '.json',
          '.pdf',
          '.doc',
          '.docx',
          '.xls',
          '.xlsx',
        ];
        const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
        if (!allowedTypes.includes(fileExtension)) {
          toast.error(
            'Invalid file type. Please choose a CSV, TXT, JSON, PDF, DOC, DOCX, XLS, or XLSX file.'
          );
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
          setSelectedFileName('');
          return;
        }

        setSelectedFileName(file.name);
        form.setValue('selectedFile', file);
      } else {
        setSelectedFileName('');
        form.setValue('selectedFile', undefined);
      }
    },
    [form, isPro]
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
                          accept=".csv,.txt,.json,.pdf,.doc,.docx,.xls,.xlsx"
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
                      CSV, TXT, JSON, PDF, DOC, DOCX, XLS, and XLSX formats are
                      supported. Maximum file size: {isPro ? '500KB' : '300KB'}.
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
