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

import { Textarea } from '@/components/ui/textarea';
import { useDataSource } from '@/hooks/useDataSource';
import { DataSource } from '@/types';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const formSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
});

type FormData = z.infer<typeof formSchema>;

export default function TabText() {
  const [isContentSheetOpen, setIsContentSheetOpen] = useState(false);
  const [selectedText, setSelectedText] = useState<{
    title: string;
    content: string;
  } | null>(null);
  const [searchFilterSaved, setSearchFilterSaved] = useState<string>('');
  const [removingTextId, setRemovingTextId] = useState<number | null>(null);
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
    fetchMutate('text');
  }, [fetchMutate]);

  const handleSubmit = useCallback(
    (data: FormData) => {
      if (data.id) {
        const prevData = fetchData?.find(
          (source) => Number(source.id) === Number(data.id)
        );

        const updateData = {
          id: Number(data.id),
          document_type: 'text',
          title: data.title,
          content: data.content,
          vector: prevData?.vector,
          metadata: {},
          last_updated: Math.floor(Date.now() / 1000),
        };

        updateMutate(updateData, {
          onSuccess: () => {
            form.reset({
              id: undefined,
              title: '',
              content: '',
            });
            // Refetch table data after successful update
            fetchMutate('text');
          },
          onError: (error) => {
            console.error('Update failed:', error);
          },
        });
      } else {
        const addData = {
          document_type: 'text',
          title: data.title,
          content: data.content,
          metadata: {},
        };

        addMutate(addData, {
          onSuccess: () => {
            form.reset({
              id: undefined,
              title: '',
              content: '',
            });
            // Refetch table data after successful add
            fetchMutate('text');
          },
          onError: (error) => {
            console.error('Add failed:', error);
          },
        });
      }
    },
    [addMutate, fetchData, updateMutate, fetchMutate, form]
  );

  const handleRemove = useCallback(
    (id: number) => {
      setRemovingTextId(id);
      removeMutate(
        {
          ids: [id],
          type: 'text',
        },
        {
          onSuccess: () => {
            setRemovingTextId(null);
            // Refetch table data after successful removal
            fetchMutate('text');
          },
          onError: () => {
            setRemovingTextId(null);
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
        const formData = {
          id: String(source.id),
          title: source.title,
          content: source.content,
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
        header: 'Title',
        cell: ({ row }) => {
          const title = row.getValue('title') as string;
          return <div className="max-w-[150px] truncate">{title}</div>;
        },
      },
      {
        accessorKey: 'content',
        header: 'Content',
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
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const isRemoving = removingTextId === row.original.id;
          return (
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedText({
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
                loading={removeIsPending && isRemoving}
                disabled={removeIsPending && isRemoving}
                onClick={() => handleRemove(row.original.id)}
              >
                {isRemoving ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          );
        },
      },
    ],
    [handleRemove, handleEdit, removeIsPending, removingTextId]
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
            Create Text Source{' '}
            <InfoTooltip message="Add a text source to your Helpmate." />
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
                      <Input placeholder="Enter title" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Content</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Enter text" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
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
              Saved Text Sources
            </CardTitle>
            <Input
              placeholder="Search saved text..."
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
              Text Details
            </SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto flex-1 p-4 pt-0">
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground !mb-2 !mt-0">
                  Title
                </h3>
                <div className="p-4 rounded-lg bg-muted">
                  {selectedText?.title}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground !mb-2 !mt-0">
                  Content
                </h3>
                <div className="p-4 whitespace-pre-wrap rounded-lg bg-muted">
                  {selectedText?.content}
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
