import { TestMessage } from './TestChatWidget';
import { FileText, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import ReactMarkdown from 'react-markdown';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import HelpmateIcon from '@/assets/helpmate-logo-icon.svg';
import { ChangeSvgColor } from 'svg-color-tools';
import { useDataSource } from '@/hooks/useDataSource';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useState, useEffect } from 'react';

const formSchema = z.object({
  content: z.string().min(1),
});

interface TestMessageBubbleProps {
  message: TestMessage;
  bot_icon?: string;
  messages: TestMessage[];
  messageIndex: number;
  onEdit: (
    messageId: string,
    metadata: { edited: boolean; edited_text: string }
  ) => void;
  sessionId: string;
}

export function TestMessageBubble({
  message,
  bot_icon,
  messages,
  messageIndex,
  onEdit,
  sessionId,
}: TestMessageBubbleProps) {
  const isUser = message.role === 'user';
  const { addSourceMutation } = useDataSource();
  const { mutate: addSource } = addSourceMutation;
  const [isEditing, setIsEditing] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      content: message.content,
    },
  });

  // Reset form with stripped content when editing opens
  useEffect(() => {
    if (isEditing) {
      form.reset({
        content: message.content,
      });
    }
  }, [isEditing, message.content, form]);

  const handleSubmit = async (data: z.infer<typeof formSchema>) => {
    // Find the previous user message
    const userMessage = messages[messageIndex - 1];

    addSource({
      document_type: 'qa',
      title: userMessage?.content || '',
      content: data.content,
      metadata: {
        show: false,
        type: 'test_chat',
        session_id: sessionId,
        message_id: message.id,
      },
    });

    // Update the message metadata
    onEdit(message.id, {
      edited: true,
      edited_text: data.content,
    });

    setIsEditing(false);
  };

  return (
    <div className={cn('flex flex-col gap-2', isUser && 'items-end')}>
      <div
        className={cn(
          'flex max-w-[75%] items-start gap-3',
          isUser && 'flex-row-reverse'
        )}
      >
        {/* Avatar - Only for bot */}
        {!isUser && (
          <div
            className={cn(
              'flex flex-shrink-0 justify-center items-center w-8 h-8 rounded-full [background:var(--secondary-2)]'
            )}
          >
            {bot_icon ? (
              <img src={bot_icon} alt="Bot Icon" className="w-4 h-4" />
            ) : (
              <ChangeSvgColor fill="white" src={HelpmateIcon} className="w-4" />
            )}
          </div>
        )}

        {/* Message Content */}
        <div
          className={cn(
            'flex-1 p-3 rounded-lg',
            isUser
              ? 'text-white rounded-tr-none [background:var(--secondary-2)]'
              : 'bg-white rounded-tl-none border border-gray-200'
          )}
        >
          {/* Handle different message types */}
          {message.type === 'text' || !message.type ? (
            <div className="[&_p]:!mt-0">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          ) : message.type === 'product-carousel' && message.data ? (
            <div>
              <p className="!mt-0 text-sm">{message.content}</p>
              <div className="text-xs opacity-75">
                [Product carousel would be displayed here in live chat]
              </div>
            </div>
          ) : message.type === 'coupon' && message.data ? (
            <div>
              <p className="!mt-0 text-sm">{message.content}</p>
              <div className="text-xs opacity-75">
                [Coupon would be displayed here in live chat]
              </div>
            </div>
          ) : message.type === 'order-tracker' && message.data ? (
            <div>
              <p className="!mt-0 text-sm">{message.content}</p>
              <div className="text-xs opacity-75">
                [Order tracker would be displayed here in live chat]
              </div>
            </div>
          ) : message.type === 'handover' && message.data ? (
            <div>
              <p className="!mt-0 text-sm">{message.content}</p>
              <div className="text-xs opacity-75">
                [Handover form would be displayed here in live chat]
              </div>
            </div>
          ) : message.type === 'refund-return' && message.data ? (
            <div>
              <p className="!mt-0 text-sm">{message.content}</p>
              <div className="text-xs opacity-75">
                [Refund/return form would be displayed here in live chat]
              </div>
            </div>
          ) : message.type === 'ticket' && message.data ? (
            <div>
              <p className="!mt-0 text-sm">{message.content}</p>
              <div className="text-xs opacity-75">
                [Ticket form would be displayed here in live chat]
              </div>
            </div>
          ) : (
            <div>
              <p className="!mt-0 text-sm">{message.content}</p>
              <div className="text-xs opacity-75">
                [{message.type} would be displayed here in live chat]
              </div>
            </div>
          )}

          {/* Timestamp and Edit Button */}
          <div
            className={cn(
              'flex flex-wrap gap-3 items-center mt-2 text-xs opacity-70',
              isUser ? 'text-white' : 'text-gray-500'
            )}
          >
            <span>{message.timestamp.toLocaleTimeString()}</span>
            {!isUser && (
              <>
                <Sheet open={isEditing} onOpenChange={setIsEditing}>
                  <SheetTrigger asChild>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="link"
                          size="sm"
                          className="flex gap-1 items-center !p-0 !m-0 h-auto text-xs text-gray-800 hover:text-gray-900"
                          onClick={() => setIsEditing(true)}
                        >
                          <Pencil className="!w-2.5 !h-2.5" />
                          Edit Response
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="!p-0 !m-0">
                          If you think the answer is wrong or needs improvement,
                          you can edit the response. It'll be saved in the
                          knowledge base as Q&A.
                          <br />
                          <small><strong>Note:</strong> Don't edit response for
                          products or posts information. Use "Train Chatbot" menu for those.</small>
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
                      <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleSubmit)}>
                          <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-2 font-medium">
                              <span className="text-muted-foreground">
                                User's Message:
                              </span>
                              <span className="text-sm font-normal">
                                {messages[messageIndex - 1]?.content}
                              </span>
                            </div>
                            <FormField
                              control={form.control}
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
                                onClick={() => setIsEditing(false)}
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
                {/* RAG Context Button - Only for assistant messages */}
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      variant="link"
                      size="sm"
                      className="flex gap-2 items-center text-xs text-gray-800 hover:text-gray-900 !p-0 !m-0 h-auto"
                    >
                      <FileText className="!w-2.5 !h-2.5" />
                      See Knowledge Base Used
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="!max-w-3xl max-h-[80vh]">
                    <DialogHeader className="text-left">
                      <DialogTitle className="!flex gap-2 !items-center !m-0 !p-0">
                        <FileText className="w-5 h-5 text-primary" />
                        Knowledge Base Sources Used
                      </DialogTitle>
                      <DialogDescription className="!m-0 !p-0">
                        This is the context retrieved from your knowledge base
                        that was used to generate the AI response.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[60vh] w-full overflow-y-auto rounded-md border">
                      <div className="p-4">
                        {message.rag_context ? (
                          <div className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                            {message.rag_context}
                          </div>
                        ) : (
                          <div className="text-sm italic text-gray-500">
                            No knowledge base context was used for this
                            response. The AI may have answered without needing
                            to search your knowledge base.
                          </div>
                        )}
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </>
            )}
          </div>

          {/* Show edited version if exists */}
          {!isUser && message?.metadata?.edited === true && (
            <div className="pt-2 mt-2 border-t border-gray-300">
              <div className="mb-1 text-xs text-gray-500">Edited version:</div>
              <div className="text-sm text-gray-700">
                <ReactMarkdown>{message.metadata.edited_text}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Training Instructions - Only for assistant messages with training instructions */}
      {!isUser && message.training_instructions && (
        <div className="mt-2 ml-11">
          <div className="p-3 bg-green-50 rounded-lg border border-green-200">
            <div className="text-sm text-green-900 [&_p]:!mt-0 [&_strong]:font-semibold">
              <ReactMarkdown>{message.training_instructions}</ReactMarkdown>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
