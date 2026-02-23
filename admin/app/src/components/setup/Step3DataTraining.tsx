import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useDataSource } from '@/hooks/useDataSource';
import { useWooCommerce } from '@/hooks/useWooCommerce';
import { useMain } from '@/contexts/MainContext';
import { FileText, File, Package, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ReusableTable } from '@/components/ReusableTable';
import { ColumnDef } from '@tanstack/react-table';
import { WordPressPost } from '@/types';

interface Step3DataTrainingProps {
  onComplete: () => void;
  onSkip: () => void;
}

type ContentType = 'page' | 'post' | 'product';

interface SelectedItems {
  page: number[];
  post: number[];
  product: number[];
}

export default function Step3DataTraining({
  onComplete,
  onSkip,
}: Step3DataTrainingProps) {
  const { setPage } = useMain();
  const { isWooCommerceInstalled } = useWooCommerce();
  const { getPostsMutation, addSourceMutation, getBulkJobsQuery } =
    useDataSource();

  const [selectedTypes, setSelectedTypes] = useState<ContentType[]>([]);
  const [selectedItems, setSelectedItems] = useState<SelectedItems>({
    page: [],
    post: [],
    product: [],
  });
  const [isSelectionDialogOpen, setIsSelectionDialogOpen] =
    useState<ContentType | null>(null);
  const [pages, setPages] = useState<WordPressPost[]>([]);
  const [posts, setPosts] = useState<WordPressPost[]>([]);
  const [products, setProducts] = useState<WordPressPost[]>([]);
  const [isTraining, setIsTraining] = useState(false);
  const [trainingCompleted, setTrainingCompleted] = useState(false);
  const [activeJobIds, setActiveJobIds] = useState<{
    post: string | null;
    product: string | null;
  }>({
    post: null,
    product: null,
  });

  const [completedSyncRequests, setCompletedSyncRequests] = useState<{
    post: boolean;
    product: boolean;
  }>({
    post: false,
    product: false,
  });

  const [trainingProgress, setTrainingProgress] = useState<{
    post: number;
    product: number;
  }>({
    post: 0,
    product: 0,
  });
  const completionTriggeredRef = useRef(false);

  const { mutate: getPostsMutate, isPending: getPostsIsPending } =
    getPostsMutation;
  const { mutate: addMutate } = addSourceMutation;
  const { data: bulkJobsData, refetch: refetchBulkJobs } = getBulkJobsQuery;


  // Fetch available items
  useEffect(() => {
    if (selectedTypes.includes('page')) {
      getPostsMutate('page', {
        onSuccess: (data) => {
          if (data) {
            setPages(
              data.map((post: WordPressPost) => ({
                id: post.id,
                title:
                  typeof post.title === 'string'
                    ? post.title
                    : post.title.rendered,
                type: post.type,
                status: post.status,
                date: new Date(post.date).toLocaleDateString(),
                author: post.author,
                content: post.content,
                metadata: post.metadata,
              }))
            );
          }
        },
      });
    }
    if (selectedTypes.includes('post')) {
      getPostsMutate('post', {
        onSuccess: (data) => {
          if (data) {
            setPosts(
              data.map((post: WordPressPost) => ({
                id: post.id,
                title:
                  typeof post.title === 'string'
                    ? post.title
                    : post.title.rendered,
                type: post.type,
                status: post.status,
                date: new Date(post.date).toLocaleDateString(),
                author: post.author,
                content: post.content,
                metadata: post.metadata,
              }))
            );
          }
        },
      });
    }
    if (selectedTypes.includes('product') && isWooCommerceInstalled) {
      getPostsMutate('product', {
        onSuccess: (data) => {
          if (data) {
            setProducts(
              data.map((product: WordPressPost) => ({
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
              }))
            );
          }
        },
      });
    }
  }, [selectedTypes, getPostsMutate, isWooCommerceInstalled]);

  // Track training progress
  useEffect(() => {
    if (bulkJobsData && isTraining) {
      const progress: { post: number; product: number } = {
        post: 0,
        product: 0,
      };

      if (activeJobIds.post) {
        const job = bulkJobsData.find((j) => j.job_id === activeJobIds.post);
        if (job) {
          const total = Number(job.total_documents) || 1;
          const processed = Number(job.processed_documents) || 0;
          progress.post = Math.round((processed / total) * 100);
        }
      }

      if (activeJobIds.product) {
        const job = bulkJobsData.find((j) => j.job_id === activeJobIds.product);
        if (job) {
          const total = Number(job.total_documents) || 1;
          const processed = Number(job.processed_documents) || 0;
          progress.product = Math.round((processed / total) * 100);
        }
      }

      setTrainingProgress(progress);
    }
  }, [bulkJobsData, activeJobIds, isTraining]);

  // Check completion separately - runs regardless of isTraining state
  useEffect(() => {
    if (!isTraining || completionTriggeredRef.current) return;

    // Determine what requests we're expecting
    const expectingPost = activeJobIds.post || completedSyncRequests.post;
    const expectingProduct = activeJobIds.product || completedSyncRequests.product;

    if (!expectingPost && !expectingProduct) return;

    // Check if post request is complete
    let postComplete = false;
    if (activeJobIds.post && bulkJobsData) {
      const job = bulkJobsData.find((j) => j.job_id === activeJobIds.post);
      if (job) {
        const isTerminal =
          job.status === 'completed' ||
          job.status === 'failed' ||
          job.status === 'partial';
        const total = Number(job.total_documents) || 0;
        const processed = Number(job.processed_documents) || 0;
        const isFullyProcessed = total > 0 && processed >= total;
        postComplete = isTerminal || isFullyProcessed;
      }
    } else if (completedSyncRequests.post) {
      postComplete = true;
    }

    // Check if product request is complete
    let productComplete = false;
    if (activeJobIds.product && bulkJobsData) {
      const job = bulkJobsData.find((j) => j.job_id === activeJobIds.product);
      if (job) {
        const isTerminal =
          job.status === 'completed' ||
          job.status === 'failed' ||
          job.status === 'partial';
        const total = Number(job.total_documents) || 0;
        const processed = Number(job.processed_documents) || 0;
        const isFullyProcessed = total > 0 && processed >= total;
        productComplete = isTerminal || isFullyProcessed;
      }
    } else if (completedSyncRequests.product) {
      productComplete = true;
    }

    // If all expected requests are complete, trigger completion
    const allComplete =
      (!expectingPost || postComplete) &&
      (!expectingProduct || productComplete);

    if (allComplete) {
      completionTriggeredRef.current = true;
      setIsTraining(false);
      setTrainingCompleted(true);
      setActiveJobIds({ post: null, product: null });
      setCompletedSyncRequests({ post: false, product: false });
      toast.success('Training completed!');
    }
  }, [bulkJobsData, activeJobIds, completedSyncRequests, isTraining]);

  // Poll for job updates while training - continue until all jobs are complete
  useEffect(() => {
    const hasActiveJobs = activeJobIds.post || activeJobIds.product;
    if (hasActiveJobs && isTraining) {
      const interval = setInterval(() => {
        refetchBulkJobs();
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [activeJobIds, isTraining, refetchBulkJobs]);

  // Additional check: manually refetch when jobs are at 100% to catch final status update
  useEffect(() => {
    const hasActiveJobs = activeJobIds.post || activeJobIds.product;
    if (hasActiveJobs && isTraining && bulkJobsData) {
      // Check if any jobs are at 100% but status hasn't updated yet
      const jobsAt100Percent: string[] = [];

      if (activeJobIds.post) {
        const job = bulkJobsData.find((j) => j.job_id === activeJobIds.post);
        if (job) {
          const total = Number(job.total_documents) || 1;
          const processed = Number(job.processed_documents) || 0;
          const progress = Math.round((processed / total) * 100);
          if (
            progress >= 100 &&
            job.status !== 'completed' &&
            job.status !== 'failed' &&
            job.status !== 'partial'
          ) {
            jobsAt100Percent.push(activeJobIds.post);
          }
        }
      }

      if (activeJobIds.product) {
        const job = bulkJobsData.find((j) => j.job_id === activeJobIds.product);
        if (job) {
          const total = Number(job.total_documents) || 1;
          const processed = Number(job.processed_documents) || 0;
          const progress = Math.round((processed / total) * 100);
          if (
            progress >= 100 &&
            job.status !== 'completed' &&
            job.status !== 'failed' &&
            job.status !== 'partial'
          ) {
            jobsAt100Percent.push(activeJobIds.product);
          }
        }
      }

      // If any jobs are at 100% but not marked complete, refetch more frequently
      if (jobsAt100Percent.length > 0) {
        const timeout = setTimeout(() => {
          refetchBulkJobs();
        }, 1000);
        return () => clearTimeout(timeout);
      }
    }
  }, [bulkJobsData, activeJobIds, isTraining, refetchBulkJobs]);

  // Final safety check: if all jobs are at 100% processed, trigger completion
  useEffect(() => {
    if (!isTraining || completionTriggeredRef.current) return;

    const hasActiveJobs = activeJobIds.post || activeJobIds.product;
    const hasCompletedSync = completedSyncRequests.post || completedSyncRequests.product;

    if (!hasActiveJobs && !hasCompletedSync) return;

    if (hasActiveJobs && bulkJobsData) {
      const jobsToCheck: Array<{ type: 'post' | 'product'; jobId: string }> = [];
      if (activeJobIds.post) jobsToCheck.push({ type: 'post', jobId: activeJobIds.post });
      if (activeJobIds.product) jobsToCheck.push({ type: 'product', jobId: activeJobIds.product });

      const allJobsFound = jobsToCheck.every(({ jobId }) => {
        return bulkJobsData.some((j) => j.job_id === jobId);
      });

      if (allJobsFound) {
        const allFullyProcessed = jobsToCheck.every(({ jobId }) => {
          const job = bulkJobsData.find((j) => j.job_id === jobId);
          if (!job) return false;
          const total = Number(job.total_documents) || 0;
          const processed = Number(job.processed_documents) || 0;
          // Job is complete if processed >= total (regardless of status)
          return total > 0 && processed >= total;
        });

        // Check if we have all expected requests (async jobs + sync requests)
        const expectedCount = jobsToCheck.length + (completedSyncRequests.post ? 1 : 0) + (completedSyncRequests.product ? 1 : 0);
        const hasAllRequests = expectedCount > 0;

        // If all jobs are fully processed, trigger completion even if status hasn't updated
        if (allFullyProcessed && hasAllRequests) {
          // Do one final refetch to get latest status
          refetchBulkJobs().then(() => {
            // After refetch, if still all processed, trigger completion
            setTimeout(() => {
              if (!completionTriggeredRef.current && isTraining) {
                completionTriggeredRef.current = true;
                setIsTraining(false);
                setTrainingCompleted(true);
                setActiveJobIds({ post: null, product: null });
                setCompletedSyncRequests({ post: false, product: false });
                toast.success('Training completed!');
              }
            }, 500);
          });
        }
      }
    } else if (!hasActiveJobs && hasCompletedSync) {
      // All requests completed synchronously - already handled in main completion check
      if (completedSyncRequests.post && completedSyncRequests.product) {
        completionTriggeredRef.current = true;
        setIsTraining(false);
        setTrainingCompleted(true);
        setActiveJobIds({ post: null, product: null });
        setCompletedSyncRequests({ post: false, product: false });
        toast.success('Training completed!');
      }
    }
  }, [bulkJobsData, activeJobIds, completedSyncRequests, isTraining, refetchBulkJobs]);

  const toggleType = (type: ContentType) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
    // Clear selections when unchecking
    if (selectedTypes.includes(type)) {
      setSelectedItems((prev) => ({
        ...prev,
        [type]: [],
      }));
    }
  };

  const getTotalSelectedCount = () => {
    return (
      selectedItems.page.length +
      selectedItems.post.length +
      selectedItems.product.length
    );
  };

  const handleStartTraining = () => {
    const totalSelected = getTotalSelectedCount();
    if (totalSelected < 3) {
      toast.error('Please select at least 3 items to train');
      return;
    }

    setIsTraining(true);
    setTrainingCompleted(false);
    completionTriggeredRef.current = false; // Reset completion flag
    setCompletedSyncRequests({ post: false, product: false }); // Reset sync completion tracking

    // Prepare posts documents (pages + posts combined)
    const postDocuments: Array<{
      document_type: string;
      post_id: number;
      post_type: string;
      title: string;
    }> = [];

    // Add pages
    if (selectedItems.page.length > 0) {
      const pageItems = pages.filter((p) => selectedItems.page.includes(p.id));
      pageItems.forEach((page) => {
        postDocuments.push({
          document_type: 'post',
          post_id: page.id,
          post_type: page.type,
          title:
            typeof page.title === 'string' ? page.title : page.title.rendered,
        });
      });
    }

    // Add posts
    if (selectedItems.post.length > 0) {
      const postItems = posts.filter((p) => selectedItems.post.includes(p.id));
      postItems.forEach((post) => {
        postDocuments.push({
          document_type: 'post',
          post_id: post.id,
          post_type: post.type,
          title:
            typeof post.title === 'string' ? post.title : post.title.rendered,
        });
      });
    }

    // Prepare products documents
    const productDocuments: Array<{
      document_type: string;
      post_id: number;
      post_type: string;
      title: string;
    }> = [];

    if (selectedItems.product.length > 0) {
      const productItems = products.filter((p) =>
        selectedItems.product.includes(p.id)
      );
      productItems.forEach((product) => {
        productDocuments.push({
          document_type: 'product',
          post_id: product.id,
          post_type: product.type,
          title:
            typeof product.title === 'string'
              ? product.title
              : product.title.rendered,
        });
      });
    }

    // Send posts request (pages + posts)
    if (postDocuments.length > 0) {
      addMutate(postDocuments, {
        onSuccess: (data) => {
          if (data?.job_id) {
            setActiveJobIds((prev) => ({ ...prev, post: String(data.job_id) }));
            refetchBulkJobs();
          } else {
            // If no job_id, training completed synchronously
            setCompletedSyncRequests((prev) => ({ ...prev, post: true }));
          }
        },
        onError: (error) => {
          toast.error(
            (error as { message?: string })?.message ||
              'Failed to train posts. Please try again.'
          );
          setActiveJobIds((prev) => ({ ...prev, post: null }));
          setIsTraining(false);
          setTrainingCompleted(false);
        },
      });
    }

    // Send products request
    if (productDocuments.length > 0) {
      // For bulk operations (2+ products), send only product IDs and basic info
      if (productDocuments.length > 1) {
          addMutate(productDocuments, {
            onSuccess: (data) => {
              if (data?.job_id) {
                setActiveJobIds((prev) => ({ ...prev, product: String(data.job_id) }));
                refetchBulkJobs();
              } else {
                // If no job_id, training completed synchronously
                setCompletedSyncRequests((prev) => ({ ...prev, product: true }));
              }
            },
            onError: (error) => {
              toast.error(
                (error as { message?: string })?.message ||
                  'Failed to train products. Please try again.'
              );
              setActiveJobIds((prev) => ({ ...prev, product: null }));
              setIsTraining(false);
              setTrainingCompleted(false);
            },
          });
      } else {
        // For single product, use the format with content and metadata
        const product = products.find((p) => selectedItems.product.includes(p.id));
        if (product) {
          const singleProductDocument = {
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
          };

          addMutate([singleProductDocument], {
            onSuccess: (data) => {
              if (data?.job_id) {
                setActiveJobIds((prev) => ({ ...prev, product: String(data.job_id) }));
                refetchBulkJobs();
              } else {
                // If no job_id, training completed synchronously
                setCompletedSyncRequests((prev) => ({ ...prev, product: true }));
              }
            },
            onError: (error) => {
              toast.error(
                (error as { message?: string })?.message ||
                  'Failed to train products. Please try again.'
              );
              setActiveJobIds((prev) => ({ ...prev, product: null }));
              setIsTraining(false);
              setTrainingCompleted(false);
            },
          });
        }
      }
    }
  };

  const getItemsForType = (type: ContentType) => {
    switch (type) {
      case 'page':
        return pages;
      case 'post':
        return posts;
      case 'product':
        return products;
    }
  };

  const getSelectedItemsForType = (type: ContentType) => {
    return selectedItems[type];
  };

  const toggleItemSelection = (type: ContentType, itemId: number) => {
    setSelectedItems((prev) => ({
      ...prev,
      [type]: prev[type].includes(itemId)
        ? prev[type].filter((id) => id !== itemId)
        : [...prev[type], itemId],
    }));
  };

  const selectAllItems = (type: ContentType) => {
    const items = getItemsForType(type);
    setSelectedItems((prev) => ({
      ...prev,
      [type]: items.map((item) => item.id),
    }));
  };

  const deselectAllItems = (type: ContentType) => {
    setSelectedItems((prev) => ({
      ...prev,
      [type]: [],
    }));
  };

  const columns: ColumnDef<WordPressPost>[] = [
    {
      id: 'select',
      header: ({ table }) => {
        const type = isSelectionDialogOpen!;
        const items = getItemsForType(type);
        const selectedIds = getSelectedItemsForType(type);
        const allSelected = items.length > 0 && selectedIds.length === items.length;
        const someSelected = selectedIds.length > 0;
        return (
          <Checkbox
            checked={
              allSelected
                ? true
                : someSelected
                  ? 'indeterminate'
                  : false
            }
            onCheckedChange={(value) => {
              if (value) {
                selectAllItems(type);
              } else {
                deselectAllItems(type);
              }
              table.toggleAllPageRowsSelected(!!value);
            }}
          />
        );
      },
      cell: ({ row }) => {
        const item = row.original;
        const isSelected = getSelectedItemsForType(
          isSelectionDialogOpen!
        ).includes(item.id);
        return (
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => {
              toggleItemSelection(isSelectionDialogOpen!, item.id);
            }}
          />
        );
      },
    },
    {
      accessorKey: 'title',
      header: 'Title',
    },
    {
      accessorKey: 'date',
      header: 'Date',
    },
  ];

  const totalSelected = getTotalSelectedCount();
  const canStartTraining = totalSelected >= 3;

  return (
    <div className="space-y-6">
      <div className="mb-6 text-center">
        <h2 className="!mb-2 !mt-0 !text-2xl !font-bold">
          Step 3: Train Your Data (Optional)
        </h2>
        <p className="text-muted-foreground !my-0">
          Select content to train your chatbot. Minimum 3 items recommended.
        </p>
      </div>

      {isTraining && (
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex gap-3 items-center mb-2">
            <div className="w-5 h-5 rounded-full border-2 border-blue-600 animate-spin border-t-transparent" />
            <span className="font-medium">Training in progress...</span>
          </div>
          <div className="mt-3 space-y-2">
            {activeJobIds.post && (
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Posts & Pages</span>
                  <span>{trainingProgress.post}%</span>
                </div>
                <div className="overflow-hidden w-full h-2 bg-gray-200 rounded-full">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all"
                    style={{
                      width: `${trainingProgress.post}%`,
                    }}
                  />
                </div>
              </div>
            )}
            {activeJobIds.product && (
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Products</span>
                  <span>{trainingProgress.product}%</span>
                </div>
                <div className="overflow-hidden w-full h-2 bg-gray-200 rounded-full">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all"
                    style={{
                      width: `${trainingProgress.product}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Pages Card */}
        <Card
          className={`cursor-pointer transition-all ${
            selectedTypes.includes('page')
              ? 'border-primary shadow-md'
              : 'hover:shadow-md'
          }`}
          onClick={() => toggleType('page')}
        >
          <CardHeader>
            <div className="flex justify-between items-center">
              <div className="flex gap-2 items-center">
                <FileText className="w-5 h-5 text-primary" />
                <CardTitle className="text-lg">Pages</CardTitle>
              </div>
              <Checkbox
                checked={selectedTypes.includes('page')}
                onCheckedChange={() => toggleType('page')}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </CardHeader>
          <CardContent>
            <p className="!my-0 text-sm text-muted-foreground">
              {pages.length} pages available
            </p>
            {selectedTypes.includes('page') && (
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  {selectedItems.page.length} selected
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsSelectionDialogOpen('page');
                  }}
                >
                  Select Items
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Posts Card */}
        <Card
          className={`cursor-pointer transition-all ${
            selectedTypes.includes('post')
              ? 'border-primary shadow-md'
              : 'hover:shadow-md'
          }`}
          onClick={() => toggleType('post')}
        >
          <CardHeader>
            <div className="flex justify-between items-center">
              <div className="flex gap-2 items-center">
                <File className="w-5 h-5 text-primary" />
                <CardTitle className="text-lg">Posts</CardTitle>
              </div>
              <Checkbox
                checked={selectedTypes.includes('post')}
                onCheckedChange={() => toggleType('post')}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </CardHeader>
          <CardContent>
            <p className="!my-0 text-sm text-muted-foreground">
              {posts.length} posts available
            </p>
            {selectedTypes.includes('post') && (
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  {selectedItems.post.length} selected
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsSelectionDialogOpen('post');
                  }}
                >
                  Select Items
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Products Card */}
        {isWooCommerceInstalled && (
          <Card
            className={`cursor-pointer transition-all ${
              selectedTypes.includes('product')
                ? 'border-primary shadow-md'
                : 'hover:shadow-md'
            }`}
            onClick={() => toggleType('product')}
          >
            <CardHeader>
              <div className="flex justify-between items-center">
                <div className="flex gap-2 items-center">
                  <Package className="w-5 h-5 text-primary" />
                  <CardTitle className="text-lg">Products</CardTitle>
                </div>
                <Checkbox
                  checked={selectedTypes.includes('product')}
                  onCheckedChange={() => toggleType('product')}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground !my-0">
                {products.length} products available
              </p>
              {selectedTypes.includes('product') && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    {selectedItems.product.length} selected
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsSelectionDialogOpen('product');
                  }}
                  >
                    Select Items
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="flex justify-between items-center pt-4 border-t">
        <div className="text-sm text-muted-foreground">
          {totalSelected >= 3 ? (
            <span className="font-medium text-green-600">
              <CheckCircle2 className="inline mr-1 w-4 h-4" />
              {totalSelected} items selected (ready to train)
            </span>
          ) : (
            <span>{totalSelected} of 3 minimum items selected</span>
          )}
        </div>
        <div className="flex gap-3">
          {!isTraining && !trainingCompleted && (
            <Button variant="outline" onClick={onSkip}>
              Skip This Step
            </Button>
          )}
          {isTraining || trainingCompleted ? (
            <Button
              onClick={() => {
                const url = new URL(window.location.href);
                url.searchParams.set('tab', 'test-chatbot');
                window.history.pushState({}, '', url.toString());
                setPage('test-chatbot');
                onComplete();
              }}
            >
              Test Chatbot
            </Button>
          ) : (
            <Button
              onClick={handleStartTraining}
              disabled={!canStartTraining}
            >
              Start Training
            </Button>
          )}
        </div>
      </div>

      {/* Selection Dialog */}
      <Dialog
        open={isSelectionDialogOpen !== null}
        onOpenChange={(open) => !open && setIsSelectionDialogOpen(null)}
      >
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              Select{' '}
              {isSelectionDialogOpen === 'page'
                ? 'Pages'
                : isSelectionDialogOpen === 'post'
                ? 'Posts'
                : 'Products'}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto">
            {isSelectionDialogOpen && (
              <ReusableTable
                data={getItemsForType(isSelectionDialogOpen)}
                columns={columns}
                loading={getPostsIsPending}
              />
            )}
          </div>
          <div className="flex justify-between items-center pt-4 border-t">
            <span className="text-sm text-muted-foreground">
              {isSelectionDialogOpen
                ? getSelectedItemsForType(isSelectionDialogOpen).length
                : 0}{' '}
              items selected
            </span>
            <Button onClick={() => setIsSelectionDialogOpen(null)}>Done</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
