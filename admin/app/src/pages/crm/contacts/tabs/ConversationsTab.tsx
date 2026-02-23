import { ReusableTable } from '@/components/ReusableTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSocialChat, type SocialConversation } from '@/hooks/useSocialChat';
import { cn } from '@/lib/utils';
import { ColumnDef } from '@tanstack/react-table';
import { formatDistanceToNow } from 'date-fns';
import { parseUTCDate, defaultLocale } from '../utils';
import {
  Eye,
  Facebook,
  Instagram,
  MessageCircle,
  MessageSquare,
  Phone,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ConversationDetailsSheet } from './ConversationDetailsSheet';

interface ConversationsTabProps {
  contactId: number | null;
}

const PAGE_SIZE = 10;

const getPlatformIcon = (platform: string, className = 'w-4 h-4') => {
  switch (platform) {
    case 'messenger':
      return <MessageCircle className={cn(className, 'text-blue-500')} />;
    case 'instagram':
      return <Instagram className={cn(className, 'text-pink-500')} />;
    case 'fb_comment':
      return <Facebook className={cn(className, 'text-blue-600')} />;
    case 'ig_comment':
      return <Instagram className={cn(className, 'text-purple-500')} />;
    case 'whatsapp':
      return <Phone className={cn(className, 'text-green-500')} />;
    case 'website':
      return <MessageSquare className={cn(className, 'text-indigo-500')} />;
    default:
      return <MessageCircle className={className} />;
  }
};

const getPlatformLabel = (platform: string) => {
  switch (platform) {
    case 'messenger':
      return 'Messenger';
    case 'instagram':
      return 'Instagram DM';
    case 'fb_comment':
      return 'FB Comment';
    case 'ig_comment':
      return 'IG Comment';
    case 'whatsapp':
      return 'WhatsApp';
    case 'website':
      return 'Website';
    default:
      return platform;
  }
};

export function ConversationsTab({ contactId }: ConversationsTabProps) {
  const { useConversations } = useSocialChat();
  const [showConversationSheet, setShowConversationSheet] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<
    number | string | null
  >(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Reset to page 1 when contactId changes
  useEffect(() => {
    setCurrentPage(1);
  }, [contactId]);

  // Fetch conversations filtered by contact_id
  // Exclude tickets since those are shown in Tickets tab
  const { data: conversationsData, isLoading: conversationsLoading } =
    useConversations({
      contact_id: contactId || undefined,
      page: currentPage,
      per_page: PAGE_SIZE,
    });

  // Filter out tickets and get only website, social messages, and comments
  const conversations = useMemo(() => {
    const allConversations = conversationsData?.conversations || [];
    return allConversations.filter(
      (conv) =>
        conv.platform !== 'ticket' &&
        [
          'website',
          'messenger',
          'instagram',
          'whatsapp',
          'fb_comment',
          'ig_comment',
        ].includes(conv.platform)
    );
  }, [conversationsData?.conversations]);

  const pagination = conversationsData?.pagination as
    | {
        total?: number;
        total_pages?: number;
        current_page?: number;
      }
    | undefined;

  const handleConversationClick = (conversationId: number | string) => {
    setSelectedConversationId(conversationId);
    setShowConversationSheet(true);
  };

  const getDisplayName = (conversation: SocialConversation) => {
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

  const columns: ColumnDef<SocialConversation>[] = [
    {
      id: 'platform',
      header: 'Platform',
      cell: ({ row }) => (
        <div className="flex gap-2 items-center">
          {getPlatformIcon(row.original.platform, 'w-4 h-4')}
          <span>{getPlatformLabel(row.original.platform)}</span>
        </div>
      ),
    },
    {
      id: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <span className="font-medium">{getDisplayName(row.original)}</span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <div className="flex gap-2 items-center">
          <Badge
            variant={
              row.original.status === 'open'
                ? 'default'
                : row.original.status === 'resolved'
                ? 'secondary'
                : 'outline'
            }
            className="capitalize"
          >
            {row.original.status}
          </Badge>
          {row.original.is_human_handoff && (
            <Badge
              variant="outline"
              className="px-2 py-0 text-xs text-amber-700 bg-amber-50 border-amber-200"
            >
              Handoff
            </Badge>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'account_name',
      header: 'Account',
      cell: ({ row }) =>
        row.original.account_name || (
          <span className="text-sm text-muted-foreground">-</span>
        ),
    },
    {
      accessorKey: 'last_message_at',
      header: 'Last Message',
      cell: ({ row }) =>
        row.original.last_message_at ? (
          formatDistanceToNow(parseUTCDate(row.original.last_message_at), {
            addSuffix: true,
            locale: defaultLocale,
          })
        ) : (
          <span className="text-sm text-muted-foreground">-</span>
        ),
    },
    {
      id: 'actions',
      header: '',
      meta: { className: 'text-right' },
      cell: ({ row }) => (
        <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleConversationClick(row.original.id)}
          >
            <Eye className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
  ];

  if (!contactId) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        No contact selected.
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="!text-lg !my-0">
            Conversations ({pagination?.total || conversations.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ReusableTable
            columns={columns}
            data={conversations}
            loading={conversationsLoading}
            showPagination={true}
            serverSidePagination={true}
            totalCount={pagination?.total || 0}
            currentPage={currentPage}
            pageSize={PAGE_SIZE}
            onPageChange={setCurrentPage}
            onRowClick={(row) => handleConversationClick(row.id)}
          />
        </CardContent>
      </Card>

      <ConversationDetailsSheet
        open={showConversationSheet}
        onOpenChange={setShowConversationSheet}
        conversationId={selectedConversationId}
        contactId={contactId}
      />
    </>
  );
}
