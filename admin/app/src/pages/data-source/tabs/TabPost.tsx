import { ReusableTable } from '@/components/ReusableTable';
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

import { useDataSource } from '@/hooks/useDataSource';
import { DataSource, WordPressPost } from '@/types';
import { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useConsent } from '@/contexts/ConsentContext';

// Function to detect if content is dynamic (mostly HTML comments and empty divs)
const isDynamicContent = (content: string): boolean => {
  if (!content) return true;

  // Split content by "Metadata:" to get only the post content
  const contentParts = content.split('\n\nMetadata:');
  const postContent = contentParts[0];

  // Remove HTML comments
  const withoutComments = postContent.replace(/<!--[\s\S]*?-->/g, '');

  // Remove empty divs and whitespace
  const withoutEmptyDivs = withoutComments.replace(/<div[^>]*>\s*<\/div>/g, '');

  // Remove all HTML tags
  const withoutTags = withoutEmptyDivs.replace(/<[^>]*>/g, '');

  // Remove extra whitespace and check if there's meaningful text
  const cleanText = withoutTags.replace(/\s+/g, ' ').trim();

  // If less than 50 characters of meaningful text, consider it dynamic
  return cleanText.length < 50;
};

// Function to get dynamic content explanation
const getDynamicContentExplanation = (content: string): string => {
  if (!content) return 'No content available';

  // Split content by "Metadata:" to get only the post content
  const contentParts = content.split('\n\nMetadata:');
  const postContent = contentParts[0];

  const withoutComments = postContent.replace(/<!--[\s\S]*?-->/g, '');
  const withoutEmptyDivs = withoutComments.replace(/<div[^>]*>\s*<\/div>/g, '');
  const withoutTags = withoutEmptyDivs.replace(/<[^>]*>/g, '');
  const cleanText = withoutTags.replace(/\s+/g, ' ').trim();

  if (cleanText.length === 0) {
    return 'This content consists entirely of HTML comments and empty divs, which is typical for dynamic content that gets populated by JavaScript or server-side rendering. Add content to description for better training.';
  }

  return `This content has minimal text content (${cleanText.length} characters) and consists mostly of HTML structure, comments, and empty containers. This is typical for dynamic content that gets populated by JavaScript, server-side rendering, or external data sources. Add more content to description for better training.`;
};

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

  const { requestConsent } = useConsent();
  const {
    getPostTypesQuery,
    getPostsMutation,
    getSourcesMutation,
    removeSourceMutation,
    addSourceMutation,
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

      if (postIds.length === 1) {
        setAddingPostId(postIds[0]);
      }

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
          is_trained: false,
        },
      }));

      addMutate(documentsToAdd, {
        onSuccess: () => {
          setAddingPostId(null);
        },
        onError: (error) => {
          setAddingPostId(null);

          // If consent is required, request it through the context
          if (error.message === 'CONSENT_REQUIRED') {
            requestConsent(() => handleAdd(ids));
          }
        },
      });
    },
    [addMutate, posts]
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
                <span className="text-xs text-muted-foreground">
                  (Dynamic)
                </span>
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
                <span className="text-xs text-muted-foreground">
                  (Dynamic)
                </span>
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
        accessorKey: 'metadata.is_trained',
        header: 'Trained',
        cell: ({ row }) => {
          const { metadata } = row.original;
          const parsedMetadata = JSON.parse(metadata as unknown as string);
          return (
            <div
              className="max-w-[150px] truncate"
              title={parsedMetadata.is_trained ? 'Yes' : 'No'}
            >
              {parsedMetadata.is_trained ? 'Yes' : 'No'}
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
              {parsedMetadata.is_trained === true && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleContentDisplay(row.original.id)}
                >
                  See Trained Data
                </Button>
              )}
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
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex gap-1 items-center text-xl font-bold">
                Post, Page & Product{' '}
                <InfoTooltip
                  message="Train your post, page and product data to Chatbot for better
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
                  {addIsPending ? 'Adding...' : 'Add Selected'}
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

      <Sheet open={isContentSheetOpen} onOpenChange={setIsContentSheetOpen}>
        <SheetContent className="sm:!max-w-2xl flex flex-col h-full gap-0">
          <SheetHeader className="mt-6">
            <SheetTitle className="text-lg font-bold !my-0">
              Trained Content
            </SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto flex-1 p-4 pt-0">
            {isDynamicContent(selectedPostContent) && (
              <div className="p-3 mb-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-800">
                  <strong>Dynamic Content Detected:</strong> {getDynamicContentExplanation(selectedPostContent)}
                </p>
              </div>
            )}
            <div className="p-4 rounded-lg bg-muted">
              <div dangerouslySetInnerHTML={{ __html: selectedPostContent }} />
            </div>
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
