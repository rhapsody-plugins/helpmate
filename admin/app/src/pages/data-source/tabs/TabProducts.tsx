import { ReusableTable } from '@/components/ReusableTable';
import { BulkProcessingCard } from '@/components/shared/BulkProcessingCard';
import { ContentDisplaySheet } from '@/components/shared/ContentDisplaySheet';
import {
  getDynamicContentExplanation,
  isDynamicContent,
} from '@/components/shared/ContentUtils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { Input } from '@/components/ui/input';

import { useDataSource } from '@/hooks/useDataSource';
import { DataSource, WordPressPost } from '@/types';
import { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

export default function TabProducts() {
  const [products, setProducts] = useState<WordPressPost[]>([]);
  const [addingProductId, setAddingProductId] = useState<number | null>(null);
  const [removingProductId, setRemovingProductId] = useState<number | null>(
    null
  );
  const [selectedRows, setSelectedRows] = useState<WordPressPost[]>([]);
  const [selectedRowsSaved, setSelectedRowsSaved] = useState<DataSource[]>([]);
  const [isContentSheetOpen, setIsContentSheetOpen] = useState(false);
  const [selectedProductContent, setSelectedProductContent] =
    useState<string>('');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [searchFilterSaved, setSearchFilterSaved] = useState<string>('');
  const [activeBulkJobId, setActiveBulkJobId] = useState<string | null>(null);
  const refreshedJobsRef = useRef<Set<string>>(new Set());

  const {
    getPostsMutation,
    getSourcesMutation,
    removeSourceMutation,
    addSourceMutation,
    getBulkJobsQuery,
    cancelBulkJobMutation,
    deleteBulkJobMutation,
  } = useDataSource();

  const {
    data: fetchData,
    mutate: fetchMutate,
    isPending: fetchIsPending,
  } = getSourcesMutation;
  const { mutate: addMutate, isPending: addIsPending } = addSourceMutation;
  const { mutate: removeMutate, isPending: removeIsPending } =
    removeSourceMutation;
  const { mutate: getPostsMutate, isPending: getPostsIsPending } =
    getPostsMutation;
  const { data: bulkJobsData, refetch: refetchBulkJobs } = getBulkJobsQuery;
  const { mutate: cancelBulkJobMutate } = cancelBulkJobMutation;
  const { mutate: deleteBulkJobMutate } = deleteBulkJobMutation;

  const fetchProducts = useCallback(() => {
    getPostsMutate('product', {
      onSuccess: (data) => {
        if (!data) return;
        const formattedProducts = data.map((product: WordPressPost) => ({
          id: product.id,
          title:
            typeof product.title === 'string'
              ? product.title
              : product.title.rendered,
          type: product.type,
          status: product.status,
          date: new Date(product.date).toLocaleDateString(),
          author: product.author,
          content: product.content,
          metadata: product.metadata,
        }));
        setProducts(formattedProducts);
      },
    });
  }, [getPostsMutate]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    fetchMutate('product');
  }, [fetchMutate]);

  // Track active bulk jobs for products only
  useEffect(() => {
    if (bulkJobsData) {
      // Filter jobs by document_type='product'
      const productJobs = bulkJobsData.filter(
        (job) => job.documents?.document_type === 'product'
      );

      // Find any job (active or completed) for products that should be displayed
      const displayJob = productJobs.find(
        (job) =>
          job.status === 'processing' ||
          job.status === 'scheduled' ||
          job.status === 'completed' ||
          job.status === 'failed' ||
          job.status === 'partial'
      );

      // Check if any job just completed or failed and refresh the trained data
      const finishedJob = productJobs.find(
        (job) =>
          (job.status === 'completed' ||
            job.status === 'failed' ||
            job.status === 'partial') &&
          job.job_id === activeBulkJobId
      );

      if (finishedJob && !refreshedJobsRef.current.has(finishedJob.job_id)) {
        refreshedJobsRef.current.add(finishedJob.job_id);
        fetchMutate('product');
      }

      // Also check for any recently finished jobs that might not match activeBulkJobId
      const anyFinishedJob = productJobs.find(
        (job) =>
          (job.status === 'completed' ||
            job.status === 'failed' ||
            job.status === 'partial') &&
          job.job_id !== activeBulkJobId
      );

      if (
        anyFinishedJob &&
        !activeBulkJobId &&
        !refreshedJobsRef.current.has(anyFinishedJob.job_id)
      ) {
        refreshedJobsRef.current.add(anyFinishedJob.job_id);
        fetchMutate('product');
      }

      // Only set activeBulkJobId if there's a job to display and we don't already have one set
      if (displayJob && !activeBulkJobId) {
        setActiveBulkJobId(displayJob.job_id);
      }
    }
  }, [bulkJobsData, activeBulkJobId, fetchMutate]);

  // Set up polling when there's a job to display (active or completed)
  useEffect(() => {
    if (activeBulkJobId) {
      const interval = setInterval(() => {
        refetchBulkJobs();
      }, 1500);

      return () => clearInterval(interval);
    }
  }, [activeBulkJobId, refetchBulkJobs]);

  // Ensure bulk jobs query is always running
  useEffect(() => {
    refetchBulkJobs();
  }, [refetchBulkJobs]);

  const handleProducts = useCallback(
    (savedProducts: DataSource[] | undefined, products: WordPressPost[]) => {
      if (!products) return [];

      if (fetchIsPending) {
        return products;
      }

      if (!savedProducts) return products;

      const savedProductIds = savedProducts.map(
        (product) => JSON.parse(product.metadata as unknown as string).post_id
      );

      const formattedProducts = products.filter(
        (product) => !savedProductIds?.includes(product.id)
      );

      return formattedProducts;
    },
    [fetchIsPending]
  );

  const handleAdd = useCallback(
    (ids: number | number[]) => {
      const productIds = Array.isArray(ids) ? ids : [ids];
      const productsToAdd = products.filter((product) =>
        productIds.includes(product.id)
      );

      if (productsToAdd.length === 0) return;

      // Check if there's already an active job for products
      if (activeBulkJobId) {
        toast.error(
          'Cannot start new job: there is already an active product job'
        );
        return;
      }

      if (productIds.length === 1) {
        setAddingProductId(productIds[0]);
      }

      // For bulk operations, send only product IDs and basic info
      if (productIds.length > 1) {
        const bulkDocuments = productsToAdd.map((product) => ({
          document_type: 'product',
          post_id: product.id,
          post_type: product.type,
          title:
            typeof product.title === 'string'
              ? product.title
              : product.title.rendered,
        }));

        addMutate(bulkDocuments, {
          onSuccess: (data) => {
            setAddingProductId(null);

            if (data?.job_id) {
              setActiveBulkJobId(data.job_id);
              refetchBulkJobs();
            }
          },
          onError: () => {
            setAddingProductId(null);
          },
        });
        return;
      }

      // For single document, use the original approach
      const documentsToAdd = productsToAdd.map((product) => ({
        document_type: 'product',
        title:
          typeof product.title === 'string'
            ? product.title
            : product.title.rendered,
        content: `${product.content || ''}\n\nMetadata:\n${JSON.stringify(
          product.metadata,
          null,
          2
        )}`,
        metadata: {
          post_id: product.id,
        },
      }));

      addMutate(documentsToAdd, {
        onSuccess: (data) => {
          setAddingProductId(null);

          if (
            Array.isArray(documentsToAdd) &&
            documentsToAdd.length > 1 &&
            data?.job_id
          ) {
            setActiveBulkJobId(data.job_id);
            refetchBulkJobs();
          }
        },
        onError: () => {
          setAddingProductId(null);
        },
      });
    },
    [addMutate, products, activeBulkJobId]
  );

  const handleRemove = useCallback(
    (ids: number | number[]) => {
      const productIds = Array.isArray(ids) ? ids : [ids];
      const sourcesToRemove = fetchData?.filter((source) =>
        productIds.includes(
          JSON.parse(source.metadata as unknown as string).post_id
        )
      );

      if (!sourcesToRemove || sourcesToRemove.length === 0) return;

      if (productIds.length === 1) {
        setRemovingProductId(productIds[0]);
      }

      removeMutate(
        {
          ids: sourcesToRemove?.map((source) => source.id) || [],
          type: 'product',
        },
        {
          onSuccess: () => {
            setRemovingProductId(null);
          },
          onError: () => {
            setRemovingProductId(null);
          },
        }
      );
    },
    [removeMutate, fetchData]
  );

  const handleContentDisplay = useCallback(
    (id: number) => {
      const product = fetchData?.find((p) => p.id === id);
      if (product) {
        setSelectedProductContent(product.content);
        setIsContentSheetOpen(true);
      }
    },
    [fetchData]
  );

  // Get current active bulk job
  const activeBulkJob = bulkJobsData?.find(
    (job) => job.job_id === activeBulkJobId
  );

  // Handle bulk job cancellation
  const handleCancelBulkJob = useCallback(() => {
    if (activeBulkJobId) {
      cancelBulkJobMutate(activeBulkJobId, {
        onSuccess: () => {
          setActiveBulkJobId(null);
        },
      });
    }
  }, [activeBulkJobId, cancelBulkJobMutate]);

  // Handle bulk job dismissal (delete)
  const handleDismissBulkJob = useCallback(() => {
    if (activeBulkJobId) {
      deleteBulkJobMutate(activeBulkJobId, {
        onSuccess: () => {
          setActiveBulkJobId(null);
          window.location.reload();
        },
      });
    }
  }, [activeBulkJobId, deleteBulkJobMutate]);

  const columns = useMemo<ColumnDef<WordPressPost>[]>(
    () => [
      {
        accessorKey: 'image',
        header: 'Image',
        cell: ({ row }) => {
          const { metadata } = row.original;
          const { featured_image } = metadata as { featured_image: string };
          return featured_image ? (
            <img
              src={featured_image}
              alt="Product Image"
              className="w-10 h-10 rounded"
            />
          ) : (
            'No Image'
          );
        },
      },
      {
        accessorKey: 'title',
        header: 'Title',
        cell: ({ row }) => {
          const { title, content } = row.original;
          const titleText = typeof title === 'string' ? title : title.rendered;
          const isDynamic = isDynamicContent(content || '');
          return (
            <div className="flex gap-1 items-center max-w-[200px] truncate">
              {titleText}
              {isDynamic && (
                <span className="text-xs text-muted-foreground">(Dynamic)</span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'type',
        header: 'Type',
      },
      {
        accessorKey: 'status',
        header: 'Status',
      },
      {
        accessorKey: 'date',
        header: 'Date',
      },
      {
        accessorKey: 'author',
        header: 'Author',
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const isAdding = addingProductId === row.original.id;
          return (
            <div className="flex gap-2 justify-end">
              <Button
                size="sm"
                loading={isAdding}
                disabled={addIsPending && !isAdding}
                onClick={() => handleAdd(row.original.id)}
              >
                {isAdding ? 'Training...' : 'Train'}
              </Button>
            </div>
          );
        },
      },
    ],
    [handleAdd, addIsPending, addingProductId]
  );

  const savedColumns = useMemo<ColumnDef<DataSource>[]>(
    () => [
      {
        accessorKey: 'title',
        header: 'Title',
        cell: ({ row }) => {
          const { title, content } = row.original;
          const isDynamic = isDynamicContent(content || '');
          return (
            <div className="flex gap-1 items-center">
              {title}
              {isDynamic && (
                <span className="text-xs text-muted-foreground">(Dynamic)</span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'metadata.post_id',
        header: 'Product ID',
        cell: ({ row }) => {
          const { metadata } = row.original;
          const parsedMetadata = JSON.parse(metadata as unknown as string);
          return (
            <div
              className="max-w-[150px] truncate"
              title={parsedMetadata.post_id}
            >
              {parsedMetadata.post_id}
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
        cell: ({ row }) => {
          const { metadata } = row.original;
          const parsedMetadata = JSON.parse(metadata as unknown as string);
          const isRemoving = removingProductId === row.original.id;
          return (
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleContentDisplay(row.original.id)}
              >
                See Trained Data
              </Button>
              <Button
                variant="destructive"
                size="sm"
                loading={removeIsPending && isRemoving}
                disabled={removeIsPending && isRemoving}
                onClick={() => handleRemove(parsedMetadata.post_id)}
              >
                {isRemoving ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          );
        },
      },
    ],
    [handleRemove, removeIsPending, removingProductId, handleContentDisplay]
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Bulk Processing Progress */}
      <BulkProcessingCard
        activeBulkJob={activeBulkJob || null}
        onCancel={handleCancelBulkJob}
        onDismiss={handleDismissBulkJob}
      />

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex gap-1 items-center text-xl font-bold">
                Products{' '}
                <InfoTooltip
                  message="Train your product data to Chatbot for better
                product recommendations and support"
                />
              </CardTitle>
            </div>
            <div className="flex gap-2 items-center">
              <Input
                placeholder="Search products..."
                value={searchFilter}
                onChange={(event) => setSearchFilter(event.target.value)}
                className="max-w-sm"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ReusableTable
            columns={columns}
            data={handleProducts(fetchData, products)}
            className="w-full"
            loading={getPostsIsPending}
            onSelectionChange={setSelectedRows}
            globalFilter={searchFilter}
            onGlobalFilterChange={setSearchFilter}
            rightAlignedColumns={['actions']}
            selectionActions={
              <>
                <Button
                  size="sm"
                  variant="outline"
                  loading={addIsPending}
                  disabled={addIsPending}
                  onClick={() => {
                    handleAdd(selectedRows.map((row) => row.id));
                    setSelectedRows([]);
                  }}
                >
                  {addIsPending ? 'Training...' : 'Train Selected'}
                </Button>
              </>
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-xl font-bold">
              Trained Product Sources
            </CardTitle>
            <Input
              placeholder="Search saved products..."
              value={searchFilterSaved}
              onChange={(event) => setSearchFilterSaved(event.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          <ReusableTable
            columns={savedColumns}
            data={fetchData || []}
            loading={fetchIsPending}
            className="w-full"
            onSelectionChange={setSelectedRowsSaved}
            globalFilter={searchFilterSaved}
            onGlobalFilterChange={setSearchFilterSaved}
            rightAlignedColumns={['actions']}
            selectionActions={
              <Button
                size="sm"
                variant="destructive"
                loading={removeIsPending}
                disabled={removeIsPending}
                onClick={() => {
                  handleRemove(
                    selectedRowsSaved?.map(
                      (row) =>
                        JSON.parse(row.metadata as unknown as string).post_id
                    ) || []
                  );
                  setSelectedRowsSaved([]);
                }}
              >
                {removeIsPending ? 'Deleting...' : 'Delete Selected'}
              </Button>
            }
          />
        </CardContent>
      </Card>

      <ContentDisplaySheet
        isOpen={isContentSheetOpen}
        onClose={() => setIsContentSheetOpen(false)}
        content={selectedProductContent}
        title="Trained Product Content"
        isDynamicContent={isDynamicContent}
        getDynamicContentExplanation={getDynamicContentExplanation}
      />
    </div>
  );
}
