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
import { useDataSource } from '@/hooks/useDataSource';
import api from '@/lib/axios';
import { DataSource } from '@/types';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnDef } from '@tanstack/react-table';
import { AxiosError } from 'axios';
import { format } from 'date-fns';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { useConsent } from '@/contexts/ConsentContext';

const formSchema = z.object({
  title: z.string(),
  content: z.string(),
  url: z.string().min(1, 'URL is required'),
});

type FormData = z.infer<typeof formSchema>;

export default function TabUrl() {
  const [isLoading, setIsLoading] = useState(false);
  const [isContentSheetOpen, setIsContentSheetOpen] = useState(false);
  const [selectedContent, setSelectedContent] = useState<string>('');
  const [searchFilterSaved, setSearchFilterSaved] = useState<string>('');
  const { requestConsent } = useConsent();
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
      url: '',
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
    fetchMutate('url');
  }, [fetchMutate]);

  const handleSubmit = useCallback(
    async (data: FormData) => {
      setIsLoading(true);

      try {
        const response = await api.post('/url-content-to-text', {
          url: data.url,
        });

        if (response.data.error) {
          toast.error(response.data.message);
          return;
        }

        addMutate({
          document_type: 'url',
          title: response.data.title || 'Untitled',
          content: response.data.content,
          metadata: {
            url: data.url,
          },
        }, {
          onError: (error) => {
            // If consent is required, request it through the context
            if (error.message === 'CONSENT_REQUIRED') {
              requestConsent(() => handleSubmit(data));
            }
          },
        });
      } catch (error) {
        console.error('Error fetching URL:', error);
        toast.error(
          (error as AxiosError<{ message: string }>).response?.data?.message ??
            'Failed to fetch URL content'
        );
      } finally {
        setIsLoading(false);
      }
    },
    [addMutate]
  );

  const handleRemove = useCallback(
    (id: number) => {
      removeMutate({
        ids: [id],
        type: 'url',
      });
    },
    [removeMutate]
  );

  const columns = useMemo<ColumnDef<DataSource>[]>(
    () => [
      {
        accessorKey: 'title',
        header: 'Title',
        cell: ({ row }) => {
          const title = row.getValue('title') as string;
          return (
            <div className="max-w-[100px] truncate" title={title}>
              {title}
            </div>
          );
        },
      },
      {
        accessorKey: 'metadata',
        header: 'URL',
        cell: ({ row }) => {
          const metadata = row.getValue('metadata') as string;
          const parsedMetadata = JSON.parse(metadata);
          return (
            <div className="max-w-[150px] truncate" title={parsedMetadata.url}>
              {parsedMetadata.url}
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
              disabled={removeIsPending}
              loading={removeIsPending}
              onClick={() => handleRemove(row.original.id)}
            >
              {removeIsPending ? 'Deleting...' : 'Delete'}
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
            Create URL Source{' '}
            <InfoTooltip message="Add a URL source to your Helpmate." />
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
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <Button
                disabled={addIsPending || isLoading}
                loading={addIsPending || isLoading}
                type="submit"
              >
                {addIsPending || isLoading ? 'Saving...' : 'Save'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-xl font-bold">
              Saved URL Sources
            </CardTitle>
            <Input
              placeholder="Search saved URLs..."
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
              URL Content
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
