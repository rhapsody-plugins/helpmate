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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useApi } from '@/hooks/useApi';
import { useDataSource } from '@/hooks/useDataSource';
import { useSettings } from '@/hooks/useSettings';
import { DataSource } from '@/types';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { parseUTCTimestamp, defaultLocale } from '@/pages/crm/contacts/utils';
import { useForm } from 'react-hook-form';
import { __ } from '@/lib/utils';
import { z } from 'zod';

const formSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
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
  const [removingQnAId, setRemovingQnAId] = useState<number | null>(null);
  const { openAiKeyQuery } = useApi();
  const { getProQuery } = useSettings();
  const isPro = getProQuery.data ?? false;
  const canEditOrDelete = !!openAiKeyQuery.data?.openai_key && isPro;
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
        const prevData = fetchData?.find(
          (source) => Number(source.id) === Number(data.id)
        );
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
              show_as_quick_option: false,
            });
            // Refetch table data after successful update
            fetchMutate('qa');
          },
          onError: (error) => {
            console.error('Update failed:', error);
          },
        });
      } else {
        const addData = {
          document_type: 'qa',
          title: data.title,
          content: data.content,
          metadata: {
            show_as_quick_option: data.show_as_quick_option,
          },
        };

        addMutate(addData, {
          onSuccess: () => {
            form.reset({
              id: undefined,
              title: '',
              content: '',
              show_as_quick_option: false,
            });
            // Refetch table data after successful add
            fetchMutate('qa');
          },
          onError: (error) => {
            console.error('Add failed:', error);
          },
        });
      }
    },
    [addMutate, fetchData, updateMutate, fetchMutate]
  );

  const handleRemove = useCallback(
    (id: number) => {
      setRemovingQnAId(id);
      removeMutate(
        {
          ids: [id],
          type: 'qa',
        },
        {
          onSuccess: () => {
            setRemovingQnAId(null);
            // Refetch table data after successful removal
            fetchMutate('qa');
          },
          onError: () => {
            setRemovingQnAId(null);
          },
        }
      );
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
        header: __('Question'),
        cell: ({ row }) => {
          const title = row.getValue('title') as string;
          return <div className="max-w-[150px] truncate">{title}</div>;
        },
      },
      {
        accessorKey: 'content',
        header: __('Answer'),
        cell: ({ row }) => {
          const content = row.getValue('content') as string;
          return <div className="max-w-[150px] truncate">{content}</div>;
        },
      },
      {
        accessorKey: 'last_updated',
        header: __('Last Updated'),
        cell: ({ row }) => {
          const timestamp = row.getValue('last_updated') as number;
          return format(parseUTCTimestamp(timestamp), 'PPpp', {
            locale: defaultLocale,
          });
        },
      },

      {
        id: 'show_as_quick_option',
        header: __('Quick Option'),
        cell: ({ row }) => {
          const metadata = row.original.metadata
            ? JSON.parse(row.original.metadata as unknown as string)
            : {};
          return (
            <div
              className={`font-medium ${
                metadata.show_as_quick_option
                  ? 'text-green-600'
                  : 'text-red-600'
              }`}
            >
              {metadata.show_as_quick_option ? __('True') : __('False')}
            </div>
          );
        },
      },
      {
        id: 'actions',
        header: __('Actions'),
        cell: ({ row }) => {
          const isRemoving = removingQnAId === row.original.id;
          return (
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
                {__('View')}
              </Button>
              {canEditOrDelete ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(row.original.id)}
                >
                  {__('Edit')}
                </Button>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-block">
                      <Button variant="outline" size="sm" disabled>
                        {__('Edit')}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {__(
                      'Add your OpenAI API key in Manage API to edit or delete'
                    )}
                  </TooltipContent>
                </Tooltip>
              )}
              {canEditOrDelete ? (
                <Button
                  variant="destructive"
                  size="sm"
                  loading={removeIsPending && isRemoving}
                  disabled={removeIsPending && isRemoving}
                  onClick={() => handleRemove(row.original.id)}
                >
                  {isRemoving ? __('Deleting...') : __('Delete')}
                </Button>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-block">
                      <Button variant="destructive" size="sm" disabled>
                        {__('Delete')}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {__(
                      'Add your OpenAI API key in Manage API to edit or delete'
                    )}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          );
        },
      },
    ],
    [handleRemove, handleEdit, removeIsPending, removingQnAId, canEditOrDelete]
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
            {__('Create QnA Source')}{' '}
            <InfoTooltip
              message={__(
                'Add a question and answer source to your Helpmate.'
              )}
            />
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
                    <FormLabel>{__('Question')}</FormLabel>
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
                    <FormLabel>{__('Answer')}</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Enter text" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 gap-4">
                <FormField
                  control={form.control}
                  name="show_as_quick_option"
                  render={({ field }) => (
                    <FormItem className="flex flex-row justify-between items-center p-2 h-9 rounded-md border border-input">
                      <div className="flex gap-2 items-center">
                        <FormLabel>{__('Show as Quick Option')}</FormLabel>
                        <InfoTooltip
                          message={__(
                            'This item will show as quick question before the chat input field.'
                          )}
                        />
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
              {form.watch('id') && !canEditOrDelete ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-block">
                      <Button
                        disabled
                        loading={addIsPending || updateIsPending}
                        type="submit"
                      >
                        {addIsPending || updateIsPending
                          ? __('Saving...')
                          : __('Save')}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {__(
                      'Add your OpenAI API key in Manage API to edit or delete'
                    )}
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Button
                  disabled={addIsPending || updateIsPending}
                  loading={addIsPending || updateIsPending}
                  type="submit"
                >
                  {addIsPending || updateIsPending
                    ? __('Saving...')
                    : __('Save')}
                </Button>
              )}
            </form>
          </Form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-xl font-bold">
              {__('Saved QnA Sources')}
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
              {__('QnA Details')}
            </SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto flex-1 p-4 pt-0">
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground !mb-2 !mt-0">
                  {__('Question')}
                </h3>
                <div className="p-4 rounded-lg bg-muted">
                  {selectedQnA?.title}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground !mb-2 !mt-0">
                  {__('Answer')}
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
              {__('Close')}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
