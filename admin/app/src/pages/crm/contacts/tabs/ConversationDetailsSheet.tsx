import Loading from '@/components/Loading';
import { InboxMessageBubble } from '@/components/chat/InboxMessageBubble';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { useSocialChat, type SocialMessage } from '@/hooks/useSocialChat';
import { Bot, Send, User, UserCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface ConversationDetailsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: number | string | null;
  contactId: number | null;
}

export function ConversationDetailsSheet({
  open,
  onOpenChange,
  conversationId,
  contactId,
}: ConversationDetailsSheetProps) {
  const {
    useConversations,
    useMessages,
    sendReplyMutation,
    updateStatusMutation,
    editCommentMutation,
    deleteCommentMutation,
  } = useSocialChat();
  const [replyText, setReplyText] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('open');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch conversation details
  const { data: conversationsData } = useConversations({
    contact_id: contactId || undefined,
    per_page: 100,
  });

  const conversation = conversationsData?.conversations.find(
    (c) => c.id === conversationId
  );

  // Fetch messages
  const { data: messagesData, isLoading: messagesLoading } = useMessages(
    conversationId ?? 0,
    conversationId !== null && open
  );
  const messages = messagesData?.messages ?? [];

  // Update status when conversation data loads
  useEffect(() => {
    if (conversation?.status) {
      setSelectedStatus(conversation.status);
    }
  }, [conversation?.status]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0 && open) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, open]);

  const getSenderIcon = (sentBy: string, userAvatar?: string) => {
    if (sentBy === 'human' && userAvatar) {
      return <img src={userAvatar} alt="" className="w-3 h-3 rounded-full" />;
    }
    switch (sentBy) {
      case 'customer':
        return <User className="w-3 h-3" />;
      case 'ai':
        return <Bot className="w-3 h-3" />;
      case 'human':
        return <UserCheck className="w-3 h-3" />;
      default:
        return null;
    }
  };

  const getSenderName = (message: SocialMessage) => {
    if (message.sent_by === 'human' && message.user_name) {
      return message.user_name;
    }
    return message.sent_by.charAt(0).toUpperCase() + message.sent_by.slice(1);
  };

  const handleSendReply = () => {
    if (!conversationId || !replyText.trim()) return;

    sendReplyMutation.mutate(
      { conversationId, message: replyText },
      {
        onSuccess: () => setReplyText(''),
      }
    );
  };

  const handleStatusChange = async (status: string) => {
    if (!conversationId) return;

    updateStatusMutation.mutate({
      conversationId,
      status,
    });

    setSelectedStatus(status);
  };

  const handleEditComment = (messageId: number, newContent: string) => {
    editCommentMutation.mutate({
      messageId,
      content: newContent,
    });
  };

  const handleDeleteComment = (messageId: number) => {
    if (confirm('Are you sure you want to delete this comment reply?')) {
      deleteCommentMutation.mutate(messageId);
    }
  };

  const getDisplayName = () => {
    if (!conversation) return 'Conversation';
    if (conversation.contact_first_name || conversation.contact_last_name) {
      const fullName = [
        conversation.contact_first_name,
        conversation.contact_last_name,
      ]
        .filter(Boolean)
        .join(' ');
      if (fullName) return fullName;
    }
    if (conversation.contact_email) {
      return conversation.contact_email;
    }
    if (
      conversation.platform === 'whatsapp' &&
      conversation.participant_id &&
      !conversation.participant_name
    ) {
      return conversation.participant_id;
    }
    return conversation.participant_name || 'Unknown';
  };

  if (!conversationId) {
    return null;
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:!max-w-2xl flex flex-col h-full gap-0 p-0">
        <SheetHeader className="border-b p-4">
          <SheetTitle className="!text-lg !font-semibold !m-0 !p-0">
            {getDisplayName()}
          </SheetTitle>
        </SheetHeader>

        <div className="flex relative flex-col flex-1 h-full">
          {/* Header Section */}
          <div className="p-4 border-b">
            <div className="flex justify-between items-center">
              <Select
                value={selectedStatus}
                onValueChange={handleStatusChange}
                disabled={updateStatusMutation.isPending}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex gap-2 items-center">
                {conversation?.account_name && (
                  <Badge variant="outline">{conversation.account_name}</Badge>
                )}
              </div>
            </div>
          </div>

          {/* Messages Area */}
          <div className="overflow-y-auto flex-1 p-4">
            {messagesLoading ? (
              <Loading />
            ) : messages.length > 0 ? (
              <div className="flex flex-col gap-4">
                {messages.map((message, index) => (
                  <InboxMessageBubble
                    key={message.id}
                    message={message}
                    messages={messages}
                    messageIndex={index}
                    conversationId={conversationId ?? ''}
                    getSenderIcon={getSenderIcon}
                    getSenderName={getSenderName}
                    conversation={conversation}
                    onEdit={handleEditComment}
                    onDelete={handleDeleteComment}
                  />
                ))}
                <div ref={messagesEndRef} />
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                No messages yet.
              </div>
            )}
          </div>

          {/* Reply Input */}
          <div className="p-4 border-t">
            <div className="flex gap-2">
              <Input
                placeholder="Type your reply..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendReply();
                  }
                }}
                disabled={sendReplyMutation.isPending}
              />
              <Button
                onClick={handleSendReply}
                disabled={!replyText.trim() || sendReplyMutation.isPending}
              >
                {sendReplyMutation.isPending ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

