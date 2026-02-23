import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { CouponData, Product } from '@/types';
import { Coupon } from '@public/components/chat/Coupon';
import { FormattedContent } from '@public/components/chat/FormattedContent';
import { ProductCarousel } from '@public/components/chat/ProductCarousel';
import { Ticket } from '@public/components/chat/Ticket';
import { useDataSource } from '@/hooks/useDataSource';
import type { SocialConversation, SocialMessage } from '@/hooks/useSocialChat';
import { parseUTCDate } from '@/pages/crm/contacts/utils';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import {
  Copy,
  Database,
  Edit,
  Pencil,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const editResponseSchema = z.object({
  content: z.string().min(1),
});

const toolWrapperClass = 'mt-2 rounded-lg bg-white px-2 py-1 text-gray-900';
const toolWrapperClass2 = 'mt-2 text-gray-900';

function ToolDisplay({
  toolType,
  toolData,
  messageId,
}: {
  toolType: string;
  toolData: Record<string, unknown>;
  messageId: number;
}) {
  switch (toolType) {
    case 'product-carousel':
      if (
        Array.isArray(toolData.products) &&
        (toolData.products as unknown[]).length > 0
      ) {
        return (
          <div className={toolWrapperClass}>
            <ProductCarousel
              data={toolData.products as unknown as Product[]}
            />
          </div>
        );
      }
      return null;

    case 'coupon':
      if ('code' in toolData && toolData.code) {
        return (
          <div className={toolWrapperClass2}>
            <Coupon
              data={toolData as unknown as CouponData}
              skipLeadGate={true}
            />
          </div>
        );
      }
      return null;

    case 'ticket':
      return (
        <div className={toolWrapperClass2}>
          <Ticket
            data={toolData as { submitted?: boolean }}
            messageId={String(messageId)}
            onSubmit={() => {}}
            displayOnly={true}
          />
        </div>
      );

    case 'order-tracker':
      if (typeof window?.HelpmatePro?.components?.OrderTracker === 'function') {
        try {
          const OT = window.HelpmatePro.components.OrderTracker;
          return (
            <div className={toolWrapperClass2}>
              <OT
                data={toolData}
                messageId={String(messageId)}
                onSubmit={() => {}}
              />
            </div>
          );
        } catch {
          return (
            <div className={toolWrapperClass}>
              <span className="text-sm text-gray-600">
                Order Tracker
                {toolData.orderId ? ` — Order #${String(toolData.orderId)}` : ''}
              </span>
            </div>
          );
        }
      }
      return (
        <div className={toolWrapperClass}>
          <span className="text-sm text-gray-600">
            Order Tracker
            {toolData.orderId ? ` — Order #${String(toolData.orderId)}` : ''}
          </span>
        </div>
      );

    case 'refund-return':
      if (typeof window?.HelpmatePro?.components?.RefundReturn === 'function') {
        try {
          const RR = window.HelpmatePro.components.RefundReturn;
          return (
            <div className={toolWrapperClass2}>
              <RR
                data={toolData}
                messageId={String(messageId)}
                onSubmit={() => {}}
              />
            </div>
          );
        } catch {
          return (
            <div className={toolWrapperClass}>
              <span className="text-sm text-gray-600">
                Refund & Return
                {toolData.submitted ? ' — Submitted' : ''}
              </span>
            </div>
          );
        }
      }
      return (
        <div className={toolWrapperClass}>
          <span className="text-sm text-gray-600">
            Refund & Return
            {toolData.submitted ? ' — Submitted' : ''}
          </span>
        </div>
      );

    default:
      return null;
  }
}

export interface InboxMessageBubbleProps {
  message: SocialMessage;
  messages: SocialMessage[];
  messageIndex: number;
  conversationId: number | string;
  getSenderIcon: (sentBy: string, userAvatar?: string) => React.ReactNode;
  getSenderName: (message: SocialMessage) => string;
  conversation?: SocialConversation;
  onEdit?: (messageId: number, newContent: string) => void;
  onDelete?: (messageId: number) => void;
  onEditResponseSaved?: () => void;
}

export function InboxMessageBubble({
  message,
  messages,
  messageIndex,
  conversationId,
  getSenderIcon,
  getSenderName,
  conversation,
  onEdit,
  onDelete,
  onEditResponseSaved,
}: InboxMessageBubbleProps) {
  const { addSourceMutation } = useDataSource();
  const { mutate: addSource } = addSourceMutation;
  const isInbound = message.direction === 'inbound';
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingResponse, setIsEditingResponse] = useState(false);
  const [isRagContextOpen, setIsRagContextOpen] = useState(false);
  const [editContent, setEditContent] = useState(message.content);

  const isComment =
    conversation &&
    (conversation.platform === 'fb_comment' ||
      conversation.platform === 'ig_comment');
  const isFacebookComment = conversation?.platform === 'fb_comment';
  const canEditComment =
    !isInbound && message.sent_by === 'ai' && isFacebookComment && onEdit;
  const canDelete =
    !isInbound && message.sent_by === 'ai' && isComment && onDelete;
  const canEditResponse = !isInbound && message.sent_by === 'ai';

  const getPreviousUserMessage = () => {
    for (let i = messageIndex - 1; i >= 0; i--) {
      if (messages[i].direction === 'inbound') {
        return messages[i];
      }
    }
    return null;
  };

  // RAG context: on assistant message, or on previous user message (for backwards compat)
  const ragContextContent =
    (typeof message.meta_data?.rag_context === 'string' &&
      message.meta_data.rag_context.trim()) ||
    (getPreviousUserMessage()?.meta_data?.rag_context as string)?.trim() ||
    '';
  const hasRagContext =
    !isInbound && message.sent_by === 'ai' && ragContextContent.length > 0;

  const isTicket = conversation?.platform === 'ticket';
  const showRagContext = hasRagContext && !isTicket;
  const showEditResponse = canEditResponse && !isTicket;

  const toolType = message.meta_data?.tool_type as string | undefined;
  const toolData = message.meta_data?.tool_data;

  const editResponseForm = useForm<z.infer<typeof editResponseSchema>>({
    resolver: zodResolver(editResponseSchema),
    defaultValues: {
      content: message.content,
    },
  });

  useEffect(() => {
    if (isEditingResponse) {
      editResponseForm.reset({
        content: message.content,
      });
    }
  }, [isEditingResponse, message.content, editResponseForm]);

  const handleSaveEdit = () => {
    if (onEdit && editContent.trim()) {
      onEdit(message.id, editContent.trim());
      setIsEditing(false);
    }
  };

  const handleCancelEdit = () => {
    setEditContent(message.content);
    setIsEditing(false);
  };

  const handleEditResponseSubmit = async (
    data: z.infer<typeof editResponseSchema>
  ) => {
    const userMessage = getPreviousUserMessage();

    addSource({
      document_type: 'qa',
      title: userMessage?.content || '',
      content: data.content,
      metadata: {
        show: false,
        type: 'chat',
        session_id: String(conversationId),
        message_id: message.id,
      },
    });

    onEditResponseSaved?.();
    setIsEditingResponse(false);
  };

  return (
    <div className={cn('flex', isInbound ? 'justify-start' : 'justify-end')}>
      <div
        className={cn(
          'max-w-[70%] rounded-lg px-3 py-2',
          isInbound ? 'bg-gray-100' : 'bg-primary text-primary-foreground'
        )}
      >
        {isEditing ? (
          <div className="space-y-2">
            <Input
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="bg-background text-foreground"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancelEdit}
                className="h-7"
              >
                <X className="mr-1 w-3 h-3" />
                Cancel
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleSaveEdit}
                className="h-7"
                disabled={!editContent.trim()}
              >
                Save
              </Button>
            </div>
          </div>
        ) : (
          <>
            <FormattedContent
              content={message.content}
              imageUrl={
                isInbound
                  ? (message.meta_data?.image_url as string | undefined)
                  : undefined
              }
              className={
                isInbound ? 'text-foreground' : 'text-primary-foreground'
              }
            />
            {!isInbound && message.sent_by === 'ai' && toolType && toolData && (
              <ToolDisplay
                toolType={toolType}
                toolData={toolData}
                messageId={message.id}
              />
            )}
            <div
              className={cn(
                'flex flex-wrap gap-2 items-center mt-1 text-xs',
                isInbound
                  ? 'text-muted-foreground'
                  : 'text-primary-foreground/70'
              )}
            >
              {!isTicket && getSenderIcon(message.sent_by, message.user_avatar)}
              <span>{getSenderName(message)}</span>
              {canEditComment && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="px-1 ml-1 h-5 text-xs"
                  onClick={() => setIsEditing(true)}
                >
                  <Edit className="w-3 h-3" />
                </Button>
              )}
              {canDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="px-1 ml-1 h-5 text-xs"
                  onClick={() => onDelete?.(message.id)}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              )}
              {(canEditComment || canDelete) && <span>·</span>}
              <span>
                {formatDistanceToNow(parseUTCDate(message.created_at), {
                  addSuffix: true,
                })}
              </span>
              {message.error_message && (
                <span className="ml-2 text-red-500">Failed to send</span>
              )}
              {/* User feedback indicators (display only - from frontend) */}
              {!isTicket &&
                !isInbound &&
                message.sent_by === 'ai' &&
                (message.meta_data?.feedback || message.meta_data?.copied) && (
                  <>
                    <span>·</span>
                    <span className="flex gap-0.5 items-center">
                      {message.meta_data?.feedback === 'good' && (
                        <ThumbsUp className="w-3 h-3 text-green-500" />
                      )}
                      {message.meta_data?.feedback === 'bad' && (
                        <ThumbsDown className="w-3 h-3 text-red-500" />
                      )}
                      {message.meta_data?.copied && (
                        <Copy className="w-3 h-3 text-blue-300" />
                      )}
                    </span>
                  </>
                )}
              {/* RAG context button */}
              {showRagContext && (
                <>
                  <span>·</span>
                  <Sheet open={isRagContextOpen} onOpenChange={setIsRagContextOpen}>
                    <SheetTrigger asChild>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="link"
                            size="sm"
                            className="flex gap-1 items-center !p-0 !m-0 h-auto text-xs text-primary-foreground/70 hover:text-primary-foreground"
                            onClick={() => setIsRagContextOpen(true)}
                          >
                            <Database className="!w-2.5 !h-2.5" />
                            View context
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="!p-0 !m-0">View RAG context used for this response</p>
                        </TooltipContent>
                      </Tooltip>
                    </SheetTrigger>
                    <SheetContent className="sm:!max-w-xl overflow-hidden">
                      <SheetHeader className="pb-0 shrink-0">
                        <SheetTitle>RAG Context</SheetTitle>
                      </SheetHeader>
                      <div className="flex flex-1 flex-col min-h-0 overflow-hidden p-4 pt-2">
                        <ScrollArea className="flex-1 min-h-0 w-full rounded-md border">
                          <pre className="p-3 font-mono text-xs whitespace-pre-wrap">
                            {ragContextContent}
                          </pre>
                        </ScrollArea>
                      </div>
                    </SheetContent>
                  </Sheet>
                </>
              )}
              {showEditResponse && (
                <>
                  <span>·</span>
                  <Sheet
                    open={isEditingResponse}
                    onOpenChange={setIsEditingResponse}
                  >
                    <SheetTrigger asChild>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="link"
                            size="sm"
                            className="flex gap-1 items-center !p-0 !m-0 h-auto text-xs text-primary-foreground/70 hover:text-primary-foreground"
                            onClick={() => setIsEditingResponse(true)}
                          >
                            <Pencil className="!w-2.5 !h-2.5" />
                            Edit Response
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="!p-0 !m-0">
                            If you think the answer is wrong or needs
                            improvement, you can edit the response. It&apos;ll be
                            saved in the knowledge base as Q&A.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </SheetTrigger>
                    <SheetContent>
                      <SheetHeader className="pb-0">
                        <SheetTitle className="!my-0 !mt-6">
                          Edit Response
                        </SheetTitle>
                      </SheetHeader>
                      <div className="p-4 pt-0">
                        <Form {...editResponseForm}>
                          <form
                            onSubmit={editResponseForm.handleSubmit(
                              handleEditResponseSubmit
                            )}
                          >
                            <div className="flex flex-col gap-4">
                              <div className="flex flex-col gap-2 font-medium">
                                <span className="text-muted-foreground">
                                  User&apos;s Message:
                                </span>
                                <span className="text-sm font-normal">
                                  {getPreviousUserMessage()?.content || 'N/A'}
                                </span>
                              </div>
                              <FormField
                                control={editResponseForm.control}
                                name="content"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Response</FormLabel>
                                    <FormControl>
                                      <Textarea {...field} />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                              <div className="flex gap-2">
                                <Button type="submit">Save</Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => setIsEditingResponse(false)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          </form>
                        </Form>
                      </div>
                    </SheetContent>
                  </Sheet>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
