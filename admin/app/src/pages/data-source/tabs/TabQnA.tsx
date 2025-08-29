import { ReusableTable } from '@/components/ReusableTable';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
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
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useDataSource } from '@/hooks/useDataSource';
import { DataSource } from '@/types';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useConsent } from '@/contexts/ConsentContext';

const formSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
  show: z.boolean().optional(),
  show_as_quick_option: z.boolean().optional(),
});

type FormData = z.infer<typeof formSchema>;

export default function TabQnA() {
  const [isContentSheetOpen, setIsContentSheetOpen] = useState(false);
  const [selectedQnA, setSelectedQnA] = useState<{
    title: string;
    content: string;
  } | null>(null);
  const [searchFilterSaved, setSearchFilterSaved] = useState<string>('');
  const { requestConsent } = useConsent();
  const {
    getSourcesMutation,
    addSourceMutation,
    updateSourceMutation,
    removeSourceMutation,
  } = useDataSource();

  const {
    data: fetchData,
    isPending: isFetching,
    mutate: fetchMutate,
  } = getSourcesMutation;

  const { isPending: addIsPending, mutate: addMutate } = addSourceMutation;

  const { isPending: updateIsPending, mutate: updateMutate } =
    updateSourceMutation;

  const { isPending: removeIsPending, mutate: removeMutate } =
    removeSourceMutation;

  const form = useForm<FormData>({
    defaultValues: {
      id: undefined,
      title: '',
      content: '',
      show: true,
      show_as_quick_option: false,
    },
    resolver: zodResolver(formSchema),
  });

  /*
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │   Handlers                                                                  │
  └─────────────────────────────────────────────────────────────────────────────┘
 */

  // Initial data fetch
  useEffect(() => {
    fetchMutate('qa');
  }, [fetchMutate]);

  const handleSubmit = useCallback(
    (data: FormData) => {
      if (data.id) {
        const prevData = fetchData?.find((source) => Number(source.id) === Number(data.id));
        const metadata = prevData?.metadata
          ? JSON.parse(prevData.metadata as unknown as string)
          : {};

        const updateData = {
          id: Number(data.id),
          document_type: 'qa',
          title: data.title,
          content: data.content,
          vector: prevData?.vector,
          metadata: {
            ...metadata,
            show: data.show,
            show_as_quick_option: data.show_as_quick_option,
          },
          last_updated: Math.floor(Date.now() / 1000),
        };

        updateMutate(updateData, {
          onSuccess: () => {
            form.reset({
              id: undefined,
              title: '',
              content: '',
              show: true,
              show_as_quick_option: false,
            });
            // Refetch table data after successful update
            fetchMutate('qa');
          },
          onError: (error) => {
            // If consent is required, request it through the context
            if (error.message === 'CONSENT_REQUIRED') {
              requestConsent(() => handleSubmit(data));
            } else {
              console.error('Update failed:', error);
            }
          },
        });
      } else {
        const addData = {
          document_type: 'qa',
          title: data.title,
          content: data.content,
          metadata: {
            show: data.show,
            show_as_quick_option: data.show_as_quick_option,
          },
        };

        addMutate(addData, {
          onSuccess: () => {
            form.reset({
              id: undefined,
              title: '',
              content: '',
              show: true,
              show_as_quick_option: false,
            });
            // Refetch table data after successful add
            fetchMutate('qa');
          },
          onError: (error) => {
            // If consent is required, request it through the context
            if (error.message === 'CONSENT_REQUIRED') {
              requestConsent(() => handleSubmit(data));
            } else {
              console.error('Add failed:', error);
            }
          },
        });
      }
    },
    [addMutate, fetchData, updateMutate, fetchMutate]
  );

  const handleRemove = useCallback(
    (id: number) => {
      removeMutate({
        ids: [id],
        type: 'qa',
      }, {
        onSuccess: () => {
          // Refetch table data after successful removal
          fetchMutate('qa');
        },
      });
    },
    [removeMutate, fetchMutate]
  );

  const handleEdit = useCallback(
    (id: number) => {
      const source = fetchData?.find((source) => source.id === id);

      if (source) {
        const metadata = source?.metadata
          ? JSON.parse(source.metadata as unknown as string)
          : {};

        const formData = {
          id: String(source.id),
          title: source.title,
          content: source.content,
          show: metadata.show ?? false,
          show_as_quick_option: metadata.show_as_quick_option ?? false,
        };

        form.reset(formData);
      }
    },
    [fetchData, form]
  );

  const columns = useMemo<ColumnDef<DataSource>[]>(
    () => [
      {
        accessorKey: 'title',
        header: 'Question',
        cell: ({ row }) => {
          const title = row.getValue('title') as string;
          return <div className="max-w-[150px] truncate">{title}</div>;
        },
      },
      {
        accessorKey: 'content',
        header: 'Answer',
        cell: ({ row }) => {
          const content = row.getValue('content') as string;
          return <div className="max-w-[150px] truncate">{content}</div>;
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
        id: 'show',
        header: 'Show in FAQs',
        cell: ({ row }) => {
          const metadata = row.original.metadata
            ? JSON.parse(row.original.metadata as unknown as string)
            : {};
          return (
            <div className={`font-medium ${metadata.show ? 'text-green-600' : 'text-red-600'}`}>
              {metadata.show ? 'True' : 'False'}
            </div>
          );
        },
      },
      {
        id: 'show_as_quick_option',
        header: 'Quick Option',
        cell: ({ row }) => {
          const metadata = row.original.metadata
            ? JSON.parse(row.original.metadata as unknown as string)
            : {};
          return (
            <div className={`font-medium ${metadata.show_as_quick_option ? 'text-green-600' : 'text-red-600'}`}>
              {metadata.show_as_quick_option ? 'True' : 'False'}
            </div>
          );
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
                setSelectedQnA({
                  title: row.original.title,
                  content: row.original.content,
                });
                setIsContentSheetOpen(true);
              }}
            >
              View
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleEdit(row.original.id)}
            >
              Edit
            </Button>
            <Button
              variant="destructive"
              size="sm"
              loading={removeIsPending}
              disabled={removeIsPending}
              onClick={() => handleRemove(row.original.id)}
            >
              {removeIsPending ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        ),
      },
    ],
    [handleRemove, handleEdit, removeIsPending]
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
            Create QnA Source{' '}
            <InfoTooltip message="Add a question and answer source to your Helpmate." />
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
                    <FormLabel>Question</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter text" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Answer</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Enter text" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="show"
                  render={({ field }) => (
                    <FormItem className="flex flex-row justify-between items-center p-2 h-9 rounded-md border border-input">
                      <div className="flex gap-2 items-center">
                        <FormLabel>Show in FAQs</FormLabel>
                        <InfoTooltip message="If asked for FAQs AI will show a list where this item will be included." />
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="show_as_quick_option"
                  render={({ field }) => (
                    <FormItem className="flex flex-row justify-between items-center p-2 h-9 rounded-md border border-input">
                      <div className="flex gap-2 items-center">
                        <FormLabel>Show as Quick Option</FormLabel>
                        <InfoTooltip message="This item will show as quick question before the chat input field." />
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
              <Button
                disabled={addIsPending || updateIsPending}
                loading={addIsPending || updateIsPending}
                type="submit"
              >
                {addIsPending || updateIsPending ? 'Saving...' : 'Save'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-xl font-bold">
              Saved QnA Sources
            </CardTitle>
            <Input
              placeholder="Search saved QnA..."
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
              QnA Details
            </SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto flex-1 p-4 pt-0">
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground !mb-2 !mt-0">
                  Question
                </h3>
                <div className="p-4 rounded-lg bg-muted">
                  {selectedQnA?.title}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground !mb-2 !mt-0">
                  Answer
                </h3>
                <div className="p-4 whitespace-pre-wrap rounded-lg bg-muted">
                  {selectedQnA?.content}
                </div>
              </div>
            </div>
            <Button
              className="mt-6"
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
