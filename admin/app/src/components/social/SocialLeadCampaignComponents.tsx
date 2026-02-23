import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import {
  SocialLeadCampaign,
  SocialPost,
  useSocialChat,
} from '@/hooks/useSocialChat';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Lock, MessageSquare } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { formatDistanceToNow } from 'date-fns';

export const campaignFormSchema = z
  .object({
    title: z.string().min(1, 'Title is required'),
    description: z.string().optional(),
    platform: z.enum(['facebook', 'instagram']),
    keywords: z.string().min(1, 'At least one keyword is required'),
    campaign_type: z.enum(['lead', 'custom_message']),
    post_scope: z.literal('specific_post'),
    post_id: z.string().optional(),
    collect_email: z.boolean(),
    collect_phone: z.boolean(),
    collect_address: z.boolean(),
    url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
    comment_reply: z.string().optional(),
    custom_message: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.campaign_type === 'lead') {
      if (!data.collect_email && !data.collect_phone && !data.collect_address) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'At least one field (email, phone, or address) must be selected',
          path: ['collect_email'],
        });
      }
      if (!data.post_id || data.post_id.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Please select a post',
          path: ['post_id'],
        });
      }
    } else if (data.campaign_type === 'custom_message') {
      if (!data.custom_message || data.custom_message.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Custom message is required',
          path: ['custom_message'],
        });
      }
      if (!data.post_id || data.post_id.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Please select a post',
          path: ['post_id'],
        });
      }
    }
  });

export type CampaignFormData = z.infer<typeof campaignFormSchema>;

export interface CampaignFormProps {
  campaign: SocialLeadCampaign | null;
  campaignType?: 'lead' | 'custom_message';
  onClose: () => void;
}

interface PostScopeSelectorProps {
  form: ReturnType<typeof useForm<CampaignFormData>>;
  platform: 'facebook' | 'instagram';
}

// Helper function to check if a post has no available content (e.g., shared posts that are unavailable)
function isPostUnavailable(post: SocialPost): boolean {
  const hasMessage = post.message && post.message.trim().length > 0;
  const hasCaption = post.caption && post.caption.trim().length > 0;
  const hasMedia = !!(post.media_url || post.full_picture || post.thumbnail_url);
  return !hasMessage && !hasCaption && !hasMedia;
}

interface PostSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  platform: 'facebook' | 'instagram';
  accountId: number | null;
  selectedPostId: string;
  onSelect: (postId: string, post?: SocialPost) => void;
}

function PostSelectionDialog({
  open,
  onOpenChange,
  platform,
  accountId,
  selectedPostId,
  onSelect,
}: PostSelectionDialogProps) {
  const { useSocialPostsQuery } = useSocialChat();
  const [allPosts, setAllPosts] = useState<SocialPost[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [currentCursor, setCurrentCursor] = useState<string | null>(null);
  const [tempSelectedPostId, setTempSelectedPostId] = useState<string>(selectedPostId);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const queryEnabled = open && !!accountId;
  const postsQuery = useSocialPostsQuery(
    platform,
    accountId,
    9,
    currentCursor,
    queryEnabled
  );

  // Update posts when query data changes
  useEffect(() => {
    if (postsQuery.data && postsQuery.data.posts.length > 0) {
      if (currentCursor === null) {
        // First load - replace posts
        setAllPosts(postsQuery.data.posts);
      } else {
        // Load more - append posts (avoid duplicates)
        setAllPosts(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const newPosts = postsQuery.data.posts.filter(p => !existingIds.has(p.id));
          return [...prev, ...newPosts];
        });
      }
      setNextCursor(postsQuery.data.nextCursor);
    }
  }, [postsQuery.data, currentCursor]);

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setAllPosts([]);
      setCurrentCursor(null);
      setNextCursor(null);
      setTempSelectedPostId(selectedPostId);
    }
  }, [open, selectedPostId]);

  // Infinite scroll with intersection observer
  useEffect(() => {
    if (!open || !loadMoreRef.current || !nextCursor || postsQuery.isFetching) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && nextCursor && !postsQuery.isFetching) {
          setCurrentCursor(nextCursor);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(loadMoreRef.current);

    return () => {
      observer.disconnect();
    };
  }, [open, nextCursor, postsQuery.isFetching]);

  const handleConfirm = () => {
    const selectedPostData = allPosts.find(p => p.id === tempSelectedPostId);
    onSelect(tempSelectedPostId, selectedPostData || undefined);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Select Post</DialogTitle>
          <DialogDescription>
            Choose a post to trigger the automation only on comments from that post.
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto flex-1">
          {postsQuery.isLoading && allPosts.length === 0 ? (
            <div className="flex justify-center items-center p-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : allPosts.length === 0 ? (
            <div className="p-4 rounded-md border bg-muted/50">
              <p className="text-sm text-muted-foreground">
                No posts found. Make sure your {platform === 'facebook' ? 'Facebook' : 'Instagram'} account has posts.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4 p-4">
              {allPosts.map((post) => (
                <div
                  key={post.id}
                  className={`flex flex-col border rounded-md cursor-pointer transition-colors ${
                    tempSelectedPostId === post.id
                      ? 'border-primary bg-primary/5'
                      : 'hover:bg-muted/50'
                  }`}
                  onClick={() => setTempSelectedPostId(post.id)}
                >
                  <div className="flex-1 p-3">
                    {post.media_url || post.full_picture || post.thumbnail_url ? (
                      <img
                        src={post.media_url || post.full_picture || post.thumbnail_url || ''}
                        alt="Post media"
                        className="object-cover mb-2 w-full h-40 rounded"
                      />
                    ) : (
                      <div className="flex flex-col justify-center items-center mb-2 w-full h-40 rounded bg-muted">
                        {isPostUnavailable(post) ? (
                          <>
                            <Lock className="mb-2 w-8 h-8 text-muted-foreground" />
                            <p className="px-2 text-xs text-center text-muted-foreground">Content not available</p>
                          </>
                        ) : (
                          <MessageSquare className="w-8 h-8 text-muted-foreground" />
                        )}
                      </div>
                    )}
                    <p className="mb-2 text-sm line-clamp-2">
                      {isPostUnavailable(post)
                        ? 'This content is not available. It may have been deleted or is only visible to a limited audience.'
                        : (post.message || post.caption || 'No message')}
                    </p>
                    {(post.timestamp || post.created_time) && (
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(
                          new Date(post.timestamp || post.created_time || ''),
                          { addSuffix: true }
                        )}
                      </p>
                    )}
                  </div>
                  <div className="flex justify-center items-center p-3 border-t">
                    <input
                      type="radio"
                      value={post.id}
                      id={`dialog-post-${post.id}`}
                      checked={tempSelectedPostId === post.id}
                      onChange={() => setTempSelectedPostId(post.id)}
                      className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>
              ))}
              {nextCursor && (
                <div ref={loadMoreRef} className="flex col-span-3 justify-center items-center p-4">
                  {postsQuery.isFetching && (
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={!tempSelectedPostId}>
            Select
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PostScopeSelector({ form, platform }: PostScopeSelectorProps) {
  const { useSocialPostsQuery, getAccountsQuery } = useSocialChat();
  const selectedPostId = form.watch('post_id');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<SocialPost | null>(null);

  // Get accounts for the selected platform
  const accounts = getAccountsQuery.data?.accounts ?? [];
  const platformAccounts = accounts.filter(acc =>
    (platform === 'facebook' && acc.platform === 'messenger') ||
    (platform === 'instagram' && acc.platform === 'instagram')
  );

  // Use the first account of the selected platform
  const accountId = platformAccounts.length > 0 ? platformAccounts[0].id : null;

  const queryEnabled = !!accountId;

  // When editing with a selected post, fetch more posts to ensure we find it
  const isEditingWithPost = !!selectedPostId;
  const initialLimit = isEditingWithPost ? 20 : 3;

  // Fetch posts for initial display
  const postsQuery = useSocialPostsQuery(
    platform,
    accountId,
    initialLimit,
    null,
    queryEnabled
  );

  // Reorder posts to put selected post first
  const reorderedPosts = useMemo(() => {
    const posts = postsQuery.data?.posts ?? [];
    if (!selectedPostId) {
      return posts;
    }

    // If we have a selectedPost (from dialog or edit), put it first
    if (selectedPost && selectedPost.id === selectedPostId) {
      const otherPosts = posts.filter(p => p.id !== selectedPostId);
      return [selectedPost, ...otherPosts];
    }

    // Otherwise, find the selected post in the current posts and move it to front
    const selectedIndex = posts.findIndex(p => p.id === selectedPostId);
    if (selectedIndex >= 0) {
      const selected = posts[selectedIndex];
      const others = posts.filter((_, i) => i !== selectedIndex);
      return [selected, ...others];
    }

    // If selected post is not in current posts but we have selectedPost data, use it
    if (selectedPost) {
      return [selectedPost, ...posts];
    }

    return posts;
  }, [postsQuery.data?.posts, selectedPostId, selectedPost]);

  const displayedPosts = reorderedPosts.slice(0, 3);
  const hasMorePosts = (postsQuery.data?.posts.length ?? 0) > 3 || !!postsQuery.data?.nextCursor;

  // When editing and post_id exists, or when posts are loaded, find the selected post
  useEffect(() => {
    if (selectedPostId && accountId) {
      const posts = postsQuery.data?.posts ?? [];
      const foundPost = posts.find(p => p.id === selectedPostId);
      if (foundPost && (!selectedPost || selectedPost.id !== selectedPostId)) {
        setSelectedPost(foundPost);
      }
    } else if (!selectedPostId) {
      setSelectedPost(null);
    }
  }, [selectedPostId, accountId, postsQuery.data?.posts, selectedPost]);

  return (
    <>
      {!accountId ? (
        <div className="p-4 rounded-md border bg-muted/50">
          <p className="text-sm text-muted-foreground">
            No {platform === 'facebook' ? 'Facebook' : 'Instagram'} account connected. Please connect an account first to select posts.
          </p>
        </div>
      ) : postsQuery.isLoading ? (
          <div className="flex justify-center items-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
      ) : (
        <FormField
          control={form.control}
          name="post_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Select Post</FormLabel>
              <FormControl>
                <div className="space-y-4">
                  {displayedPosts.length === 0 ? (
                    <div className="p-4 rounded-md border bg-muted/50">
                      <p className="text-sm text-muted-foreground">
                        No posts found. Make sure your {platform === 'facebook' ? 'Facebook' : 'Instagram'} account has posts.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-3 gap-4">
                        {displayedPosts.map((post) => (
                              <div
                                key={post.id}
                                className={`flex flex-col border rounded-md cursor-pointer transition-colors ${
                                  field.value === post.id
                                    ? 'border-primary bg-primary/5'
                                    : 'hover:bg-muted/50'
                                }`}
                                onClick={() => field.onChange(post.id)}
                              >
                                <div className="flex-1 p-3">
                                  {post.media_url || post.full_picture || post.thumbnail_url ? (
                                    <img
                                      src={post.media_url || post.full_picture || post.thumbnail_url || ''}
                                      alt="Post media"
                                      className="object-cover mb-2 w-full h-32 rounded"
                                    />
                                  ) : (
                                    <div className="flex flex-col justify-center items-center mb-2 w-full h-32 rounded bg-muted">
                                      {isPostUnavailable(post) ? (
                                        <>
                                          <Lock className="mb-1 w-6 h-6 text-muted-foreground" />
                                          <p className="px-2 text-xs text-center text-muted-foreground">Content not available</p>
                                        </>
                                      ) : (
                                        <MessageSquare className="w-8 h-8 text-muted-foreground" />
                                      )}
                                    </div>
                                  )}
                                  <p className="mb-2 text-sm line-clamp-2">
                                    {isPostUnavailable(post)
                                      ? 'This content is not available. It may have been deleted or is only visible to a limited audience.'
                                      : (post.message || post.caption || 'No message')}
                                  </p>
                                  {(post.timestamp || post.created_time) && (
                                    <p className="text-xs text-muted-foreground">
                                      {formatDistanceToNow(
                                        new Date(post.timestamp || post.created_time || ''),
                                        { addSuffix: true }
                                      )}
                                    </p>
                                  )}
                                </div>
                                <div className="flex justify-center items-center p-3 border-t">
                                  <input
                                    type="radio"
                                    value={post.id}
                                    id={`post-${post.id}`}
                                    checked={field.value === post.id}
                                    onChange={() => field.onChange(post.id)}
                                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </div>
                              </div>
                            ))}
                      </div>
                      {hasMorePosts && (
                        <Button
                              type="button"
                              variant="outline"
                              onClick={() => setDialogOpen(true)}
                              className="w-full"
                            >
                            Show More Posts
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </FormControl>
              <FormMessage />
              <p className="text-xs text-muted-foreground">
                Select a specific post to trigger the automation only on comments from that post.
              </p>
              <PostSelectionDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                platform={platform}
                accountId={accountId}
                selectedPostId={field.value || 'none'}
                onSelect={(postId, postData) => {
                  field.onChange(postId);
                  if (postData) {
                    setSelectedPost(postData);
                  }
                }}
              />
            </FormItem>
          )}
        />
      )}
    </>
  );
}

export function CampaignForm({ campaign, campaignType, onClose }: CampaignFormProps) {
  const { createLeadCampaignMutation, updateLeadCampaignMutation, getAccountsQuery } =
    useSocialChat();
  const isEditing = !!campaign;

  // Get connected accounts to filter platforms
  const accounts = getAccountsQuery.data?.accounts ?? [];
  const hasFacebook = accounts.some(acc => acc.platform === 'messenger');
  const hasInstagram = accounts.some(acc => acc.platform === 'instagram');
  const connectedPlatforms: Array<'facebook' | 'instagram'> = [];
  if (hasFacebook) connectedPlatforms.push('facebook');
  if (hasInstagram) connectedPlatforms.push('instagram');
  const defaultPlatform = connectedPlatforms[0] || 'facebook';

  // Use provided campaignType or default to campaign's type or 'lead'
  const defaultCampaignType = campaignType || campaign?.campaign_type || 'lead';

  const form = useForm<CampaignFormData>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: {
      title: campaign?.title || '',
      description: campaign?.description || '',
      platform: campaign?.platform || defaultPlatform,
      keywords: campaign?.keywords || '',
      campaign_type: defaultCampaignType,
      post_scope: 'specific_post',
      post_id: campaign?.post_id || '',
      collect_email: campaign?.collect_email || false,
      collect_phone: campaign?.collect_phone || false,
      collect_address: campaign?.collect_address || false,
      url: campaign?.url || '',
      comment_reply: campaign?.comment_reply || '',
      custom_message: campaign?.custom_message || '',
    },
  });

  // Use provided campaignType or watch from form
  const activeCampaignType = campaignType || form.watch('campaign_type');

  // Reset form when campaign changes (for edit mode)
  useEffect(() => {
    if (campaign) {
      form.reset({
        title: campaign.title || '',
        description: campaign.description || '',
        platform: campaign.platform || defaultPlatform,
        keywords: campaign.keywords || '',
        campaign_type: defaultCampaignType,
        post_scope: 'specific_post',
        post_id: campaign.post_id || '',
        collect_email: campaign.collect_email || false,
        collect_phone: campaign.collect_phone || false,
        collect_address: campaign.collect_address || false,
        url: campaign.url || '',
        comment_reply: campaign.comment_reply || '',
        custom_message: campaign.custom_message || '',
      });
    } else {
      form.reset({
        title: '',
        description: '',
        platform: defaultPlatform,
        keywords: '',
        campaign_type: defaultCampaignType,
        post_scope: 'specific_post',
        post_id: '',
        collect_email: false,
        collect_phone: false,
        collect_address: false,
        url: '',
        comment_reply: '',
        custom_message: '',
      });
    }
  }, [campaign, form, defaultPlatform, defaultCampaignType]);

  const onSubmit = (data: CampaignFormData) => {
    const submitData = {
      ...data,
      description: data.description || '',
      url: data.url || '',
      comment_reply: data.comment_reply || '',
      custom_message: data.custom_message || '',
      post_scope: 'specific_post' as const,
      post_id: data.post_id ?? '',
    };

    if (isEditing && campaign) {
      updateLeadCampaignMutation.mutate(
        {
          id: campaign.id,
          ...submitData,
        },
        {
          onSuccess: () => {
            onClose();
          },
        }
      );
    } else {
      createLeadCampaignMutation.mutate(
        submitData,
        {
          onSuccess: () => {
            onClose();
          },
        }
      );
    }
  };

  const onError = (errors: Record<string, { message?: string }>) => {
    console.error('Form validation errors:', errors);
    // Scroll to first error field
    const firstErrorField = Object.keys(errors)[0];
    if (firstErrorField) {
      const element = document.querySelector(`[name="${firstErrorField}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  // Show message if no platforms connected
  if (connectedPlatforms.length === 0) {
    return (
      <div className="flex flex-col justify-center items-center py-12 text-center">
        <p className="mb-4 text-muted-foreground">
          Please connect a Facebook or Instagram account first to create automations.
        </p>
        <Button type="button" variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, onError)} className="space-y-6">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Automation Title</FormLabel>
              <FormControl>
                <Input placeholder="Summer Sale 2024" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Get 50% off on all products this summer!"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="platform"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Platform</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  value={field.value}
                  className="flex flex-col space-y-1"
                >
                  {hasFacebook && (
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="facebook" id="platform-facebook" />
                      <label htmlFor="platform-facebook">Facebook</label>
                    </div>
                  )}
                  {hasInstagram && (
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="instagram" id="platform-instagram" />
                      <label htmlFor="platform-instagram">Instagram</label>
                    </div>
                  )}
                </RadioGroup>
              </FormControl>
              <FormMessage />
              <p className="text-xs text-muted-foreground">
                Select which platform this automation will work on.
              </p>
            </FormItem>
          )}
        />

        <PostScopeSelector
          form={form}
          platform={form.watch('platform')}
        />

        {!campaignType && (
          <FormField
            control={form.control}
            name="campaign_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Automation Type</FormLabel>
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    value={field.value}
                    className="flex flex-col space-y-1"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="lead" id="campaign-type-lead" />
                      <label htmlFor="campaign-type-lead">Lead</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="custom_message" id="campaign-type-custom" />
                      <label htmlFor="campaign-type-custom">Custom Message</label>
                    </div>
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="keywords"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Keywords</FormLabel>
              <FormControl>
                <Input
                  placeholder="sale, deal, discount"
                  {...field}
                />
              </FormControl>
              <FormMessage />
              <p className="text-xs text-muted-foreground">
                Enter keywords separated by commas. Automation triggers if ANY keyword is found (e.g., "sale, deal, discount").
              </p>
            </FormItem>
          )}
        />

        {activeCampaignType === 'lead' && (
          <>
            <div className="space-y-4">
              <FormLabel>Collect Information</FormLabel>
              <p className="text-sm text-muted-foreground">
                Select at least one field to collect from users:
              </p>

              <FormField
                control={form.control}
                name="collect_email"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Email</FormLabel>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="collect_phone"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Phone</FormLabel>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="collect_address"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Address</FormLabel>
                    </div>
                  </FormItem>
                )}
              />
              <FormMessage />
            </div>

            <FormField
              control={form.control}
              name="url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Resource Link</FormLabel>
                  <FormControl>
                    <Input
                      type="url"
                      placeholder="https://example.com/claim-deal"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                  <p className="text-xs text-muted-foreground">
                    This link will be sent to users after they complete the
                    information collection.
                  </p>
                </FormItem>
              )}
            />
          </>
        )}

        {activeCampaignType === 'custom_message' && (
          <FormField
            control={form.control}
            name="custom_message"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Custom Message</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Enter the message to send via DM..."
                    {...field}
                  />
                </FormControl>
                <FormMessage />
                <p className="text-xs text-muted-foreground">
                  This message will be sent directly to the user via DM when the keyword is detected.
                </p>
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="comment_reply"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Comment Reply (Optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Reply to the comment before sending DM. Leave empty to skip comment reply."
                  {...field}
                />
              </FormControl>
              <FormMessage />
              <p className="text-xs text-muted-foreground">
                Optional: Reply to the comment before sending DM. Leave empty to skip comment reply.
              </p>
            </FormItem>
          )}
        />

        <div className="flex gap-2 justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={
              createLeadCampaignMutation.isPending ||
              updateLeadCampaignMutation.isPending
            }
          >
            {isEditing ? 'Update' : 'Create'} Automation
          </Button>
        </div>
      </form>
    </Form>
  );
}
