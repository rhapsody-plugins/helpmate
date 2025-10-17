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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { useDataSource } from '@/hooks/useDataSource';
import { DataSource, WordPressPost } from '@/types';
import { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

export default function TabPost() {
  const [posts, setPosts] = useState<WordPressPost[]>([]);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [postTypes, setPostTypes] = useState<string[]>([]);
  const [addingPostId, setAddingPostId] = useState<number | null>(null);
  const [removingPostId, setRemovingPostId] = useState<number | null>(null);
  const [selectedRows, setSelectedRows] = useState<WordPressPost[]>([]);
  const [selectedRowsSaved, setSelectedRowsSaved] = useState<DataSource[]>([]);
  const [isContentSheetOpen, setIsContentSheetOpen] = useState(false);
  const [selectedPostContent, setSelectedPostContent] = useState<string>('');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [searchFilterSaved, setSearchFilterSaved] = useState<string>('');
  const [activeBulkJobId, setActiveBulkJobId] = useState<string | null>(null);
  const refreshedJobsRef = useRef<Set<string>>(new Set());

  const {
    getPostTypesQuery,
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
  const { data: postTypesData } = getPostTypesQuery;
  const { data: bulkJobsData, refetch: refetchBulkJobs } = getBulkJobsQuery;
  const { mutate: cancelBulkJobMutate } = cancelBulkJobMutation;
  const { mutate: deleteBulkJobMutate } = deleteBulkJobMutation;

  const fetchPosts = useCallback(() => {
    getPostsMutate(selectedType, {
      onSuccess: (data) => {
        if (!data) return;
        const formattedPosts = data.map((post: WordPressPost) => ({
          id: post.id,
          title:
            typeof post.title === 'string' ? post.title : post.title.rendered,
          type: post.type,
          status: post.status,
          date: new Date(post.date).toLocaleDateString(),
          author: post.author,
          content: post.content,
          metadata: post.metadata,
        }));
        setPosts(formattedPosts);
      },
    });
  }, [selectedType, getPostsMutate]);

  /*
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │   Handlers                                                                  │
  └─────────────────────────────────────────────────────────────────────────────┘
 */

  useEffect(() => {
    if (postTypesData) {
      setPostTypes(postTypesData.map((type) => type.name));
    }
  }, [postTypesData]);

  useEffect(() => {
    fetchPosts();
  }, [selectedType]);

  useEffect(() => {
    fetchMutate('post');
  }, [fetchMutate]);

  // Track active bulk jobs for posts only
  useEffect(() => {
    if (bulkJobsData) {
      // Filter jobs by document_type='post'
      const postJobs = bulkJobsData.filter(
        (job) => job.documents?.document_type === 'post'
      );

      // Find any job (active or completed) for posts that should be displayed
      const displayJob = postJobs.find(
        (job) =>
          job.status === 'processing' ||
          job.status === 'scheduled' ||
          job.status === 'completed' ||
          job.status === 'failed' ||
          job.status === 'partial'
      );

      // Check if any job just completed or failed and refresh the trained data
      const finishedJob = postJobs.find(
        (job) =>
          (job.status === 'completed' ||
            job.status === 'failed' ||
            job.status === 'partial') &&
          job.job_id === activeBulkJobId
      );

      if (finishedJob && !refreshedJobsRef.current.has(finishedJob.job_id)) {
        // Mark this job as refreshed to avoid multiple refreshes
        refreshedJobsRef.current.add(finishedJob.job_id);
        // Refresh the trained data sources when a job finishes (success or failure)
        fetchMutate('post');
      }

      // Also check for any recently finished jobs that might not match activeBulkJobId
      const anyFinishedJob = postJobs.find(
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
        fetchMutate('post');
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
      }, 1500); // Poll every 1.5 seconds when job is active

      return () => clearInterval(interval);
    }
  }, [activeBulkJobId, refetchBulkJobs]);

  // Ensure bulk jobs query is always running
  useEffect(() => {
    // Trigger initial fetch when component mounts
    refetchBulkJobs();
  }, [refetchBulkJobs]);

  const handlePosts = useCallback(
    (savedPosts: DataSource[] | undefined, posts: WordPressPost[]) => {
      if (!posts) return [];

      // If fetch is pending (refreshing trained data), don't filter out posts
      // to prevent the brief empty state
      if (fetchIsPending) {
        return posts;
      }

      if (!savedPosts) return posts;

      const savedPostsIds = savedPosts.map(
        (post) => JSON.parse(post.metadata as unknown as string).post_id
      );

      const formattedPosts = posts.filter(
        (post) => !savedPostsIds?.includes(post.id)
      );

      return formattedPosts;
    },
    [fetchIsPending]
  );

  const handleAdd = useCallback(
    (ids: number | number[]) => {
      const postIds = Array.isArray(ids) ? ids : [ids];
      const postsToAdd = posts.filter((post) => postIds.includes(post.id));

      if (postsToAdd.length === 0) return;

      // Check if there's already an active job for posts
      if (activeBulkJobId) {
        toast.error(
          'Cannot start new job: there is already an active post job'
        );
        return;
      }

      if (postIds.length === 1) {
        setAddingPostId(postIds[0]);
      }

      // For bulk operations, send only post IDs and basic info
      if (postIds.length > 1) {
        const bulkDocuments = postsToAdd.map((post) => ({
          document_type: 'post',
          post_id: post.id,
          post_type: post.type,
          // Include minimal data for job tracking
          title:
            typeof post.title === 'string' ? post.title : post.title.rendered,
        }));

        addMutate(bulkDocuments, {
          onSuccess: (data) => {
            setAddingPostId(null);

            // If this was a bulk operation, track the job and start polling
            if (data?.job_id) {
              setActiveBulkJobId(data.job_id);
              // Immediately refetch to get the job data
              refetchBulkJobs();
            }
          },
          onError: () => {
            setAddingPostId(null);
          },
        });
        return;
      }

      // For single document, use the original approach
      const documentsToAdd = postsToAdd.map((post) => ({
        document_type: 'post',
        title:
          typeof post.title === 'string' ? post.title : post.title.rendered,
        content: `${post.content || ''}\n\nMetadata:\n${JSON.stringify(
          post.metadata,
          null,
          2
        )}`,
        metadata: {
          post_id: post.id,
        },
      }));

      addMutate(documentsToAdd, {
        onSuccess: (data) => {
          setAddingPostId(null);

          // If this was a bulk operation, track the job and start polling
          if (
            Array.isArray(documentsToAdd) &&
            documentsToAdd.length > 1 &&
            data?.job_id
          ) {
            setActiveBulkJobId(data.job_id);
            // Immediately refetch to get the job data
            refetchBulkJobs();
          }
        },
        onError: () => {
          setAddingPostId(null);
        },
      });
    },
    [addMutate, posts, activeBulkJobId]
  );

  const handleRemove = useCallback(
    (ids: number | number[]) => {
      const postIds = Array.isArray(ids) ? ids : [ids];
      const sourcesToRemove = fetchData?.filter((source) =>
        postIds.includes(
          JSON.parse(source.metadata as unknown as string).post_id
        )
      );

      if (!sourcesToRemove || sourcesToRemove.length === 0) return;

      if (postIds.length === 1) {
        setRemovingPostId(postIds[0]);
      }

      removeMutate(
        {
          ids: sourcesToRemove?.map((source) => source.id) || [],
          type: 'post',
        },
        {
          onSuccess: () => {
            setRemovingPostId(null);
          },
          onError: () => {
            setRemovingPostId(null);
          },
        }
      );
    },
    [removeMutate, fetchData]
  );

  const handleContentDisplay = useCallback(
    (id: number) => {
      const post = fetchData?.find((p) => p.id === id);
      if (post) {
        setSelectedPostContent(post.content);
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
              alt="Image"
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
          const isAdding = addingPostId === row.original.id;
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
    [handleAdd, addIsPending, addingPostId]
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
        header: 'Post ID',
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
          const isRemoving = removingPostId === row.original.id;
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
    [handleRemove, removeIsPending]
  );

  /*
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │   Renders                                                                   │
  └─────────────────────────────────────────────────────────────────────────────┘
 */
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
                Posts & Pages{' '}
                <InfoTooltip
                  message="Train your post and page data to Chatbot for better
                reply"
                />
              </CardTitle>
            </div>
            <div className="flex gap-2 items-center">
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select post type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {postTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Search posts..."
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
            data={handlePosts(fetchData, posts)}
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
              Trained Data Sources
            </CardTitle>
            <Input
              placeholder="Search saved posts..."
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
        content={selectedPostContent}
        title="Trained Content"
        isDynamicContent={isDynamicContent}
        getDynamicContentExplanation={getDynamicContentExplanation}
      />
    </div>
  );
}
