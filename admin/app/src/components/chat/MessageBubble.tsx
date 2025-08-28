import HelpmateIcon from '@/assets/helpmate-logo-icon.svg';
import { FormattedContent } from '@/components/chat/FormattedContent';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { useAi } from '@/hooks/useAi';
import { useDataSource } from '@/hooks/useDataSource';
import type { ChatMessage } from '@/types';
import { zodResolver } from '@hookform/resolvers/zod';
import { Copy, ThumbsDown, ThumbsUp, User } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { ChangeSvgColor } from 'svg-color-tools';
import { z } from 'zod';

const formSchema = z.object({
  content: z.string().min(1),
});

interface MessageBubbleProps {
  message: ChatMessage;
  index: number;
  messages: ChatMessage[];
  sessionId: string;
  onRefresh?: () => void;
}

export function MessageBubble({
  message,
  index,
  messages,
  sessionId,
  onRefresh,
}: MessageBubbleProps) {
  const { addSourceMutation } = useDataSource();
  const { mutate: addSource } = addSourceMutation;
  const { updateChatMetadataMutation } = useAi();
  const { mutate: updateChatMetadata } = updateChatMetadataMutation;
  const [isEditing, setIsEditing] = useState(false);
  let aiMessage;
  try {
    aiMessage = JSON.parse(message.content);
  } catch {
    aiMessage = { type: 'text', text: message.content };
  }

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      content: aiMessage.text,
    },
  });

  const handleSubmit = async (data: z.infer<typeof formSchema>) => {
    addSource({
      document_type: 'qa',
      title: messages[index + 1].content,
      content: data.content,
      metadata: {
        show: false,
        type: 'chat',
        session_id: sessionId,
        message_id: index,
      },
    });

    // Update the message metadata to indicate it was edited and store the edited text
    await updateChatMetadata({
      id: message.id,
      key: 'edited',
      value: true,
    });
    await updateChatMetadata({
      id: message.id,
      key: 'edited_text',
      value: data.content,
    });

    // Refresh the chat history after metadata is updated
    onRefresh?.();
    setIsEditing(false);
  };

  return (
    <div
      className={`flex items-start gap-2 ${
        message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
      }`}
    >
      {/* Avatar */}
      <div
        className={`flex-shrink-0 ${message.role === 'user' ? 'ml-2' : 'mr-2'}`}
      >
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center ${
            message.role === 'user'
              ? '[background:var(--primary-2)]'
              : '[background:var(--secondary-2)]'
          }`}
        >
          {message.role === 'user' ? (
            <User size={16} className="text-white" />
          ) : (
            (() => {
              const botIcon = getComputedStyle(document.documentElement)
                .getPropertyValue('--bot-icon')
                .trim();
              return botIcon ? (
                <img src={botIcon} className="w-4" />
              ) : (
                <ChangeSvgColor
                  fill="white"
                  src={HelpmateIcon}
                  className="w-4"
                />
              );
            })()
          )}
        </div>
      </div>

      {/* Message Bubble */}
      <div className="flex flex-col max-w-[80%] items-start">
        <div
          className={`px-3 py-2 rounded-md ${
            message.role === 'user'
              ? '[background:var(--primary-2)] text-white'
              : '[background:var(--primary-2)]/10 text-gray-800'
          }`}
          style={{
            fontSize: 'var(--font-size)',
            lineHeight: '1.2',
          }}
        >
          <FormattedContent
            content={message.role === 'user' ? message.content : aiMessage.text}
            imageUrl={message.imageUrl}
            className={message.role === 'user' ? 'text-white' : 'text-gray-800'}
          />

          {/* Show what UI was displayed on public side for non-text types */}
          {message.role === 'assistant' && aiMessage.type && aiMessage.type !== 'text' && (
            <div className="pt-2 mt-2 border-t border-gray-300">
              <div className="mb-1 text-xs font-medium text-gray-500">
                Shown to user:
              </div>
              <div className="px-2 py-1 text-sm text-gray-700 bg-gray-50 rounded">
                {aiMessage.type === 'product-carousel' && 'Product Carousel'}
                {aiMessage.type === 'coupon' && 'Coupon Display'}
                {aiMessage.type === 'contact-form' && 'Contact Form'}
                {aiMessage.type === 'faq-options' && 'FAQ Options List'}
                {aiMessage.type === 'order-tracker' && 'Order Tracker Form'}
                {aiMessage.type === 'ticket' && 'Ticket Form'}
                {aiMessage.type === 'handover' && 'Human Handover List'}
                {aiMessage.type === 'refund-return' && 'Refund/Return Form'}
              </div>
            </div>
          )}

          {message.role === 'assistant' &&
            message?.metadata?.edited === true && (
              <div className="pt-2 mt-2 border-t border-gray-300">
                <div className="mb-1 text-xs text-gray-500">
                  Edited version:
                </div>
                <FormattedContent
                  content={message.metadata.edited_text as string}
                  className="text-gray-800"
                />
              </div>
            )}
          <div
            className={`text-xs mt-2 flex items-center gap-2 ${
              message.role === 'user' ? 'text-slate-300' : 'text-gray-500'
            }`}
          >
            {message.createdAt.toLocaleDateString()}{' '}
            {message.createdAt.toLocaleTimeString()}
            {message.role === 'assistant' && (
              <div className="flex gap-1 items-center">
                {((message?.metadata?.feedback as string) ||
                  (message?.metadata?.copied as undefined | boolean)) && (
                  <span>User:</span>
                )}
                {message?.metadata?.feedback === 'good' && (
                  <ThumbsUp className="text-green-500" size={10} />
                )}
                {message?.metadata?.feedback === 'bad' && (
                  <ThumbsDown className="text-red-500" size={10} />
                )}
                {message?.metadata?.copied === true && (
                  <Copy className="text-blue-500" size={10} />
                )}
              </div>
            )}
          </div>
        </div>
        {message.role === 'assistant' && (
          <Sheet open={isEditing} onOpenChange={setIsEditing}>
            <SheetTrigger asChild>
              <Button
                variant="link"
                size="sm"
                className="text-xs"
                onClick={() => setIsEditing(true)}
              >
                Edit Response
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader className="pb-0">
                <SheetTitle className="!my-0 !mt-6">Edit Response</SheetTitle>
              </SheetHeader>
              <div className="p-4 pt-0">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleSubmit)}>
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-2 font-medium">
                        <span className="text-muted-foreground">
                          Users Message:
                        </span>
                        <span className="text-sm font-normal">
                          {messages[index + 1]?.content}
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
        )}
      </div>
    </div>
  );
}
