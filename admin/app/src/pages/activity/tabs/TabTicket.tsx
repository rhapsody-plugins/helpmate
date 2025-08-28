import { TicketBubble } from '@/components/chat/TicketBubble';
import { ActivityLayout } from '@/components/layout/ActivityLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import useActivity from '@/hooks/useActivity';
import { useSettings } from '@/hooks/useSettings';
import { cn } from '@/lib/utils';
import type { TicketMessage } from '@/types';
import { Send } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function TabTicket() {
  const { getTickets, getTicketMessages, replyToTicket, updateTicketStatus } =
    useActivity();
  const { getSettingsMutation } = useSettings();
  const { mutate: getSettings } = getSettingsMutation;
  const [page, setPage] = useState(1);
  const [perPage] = useState(10);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('open');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRefreshingAfterReply, setIsRefreshingAfterReply] = useState(false);

  const { data: tickets, isPending: ticketsLoading } = getTickets;
  const { data: ticketMessages, isPending: messagesLoading } = getTicketMessages;
  const { isPending: replyLoading } = replyToTicket;

  // Don't show loading screen when replying to tickets or when refreshing after a reply
  const isLoading = Boolean(ticketsLoading || (selectedSession && messagesLoading && !replyLoading && !isRefreshingAfterReply));

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await getTickets.mutateAsync({
        page,
        per_page: perPage,
      });
      if (selectedSession) {
        await getTicketMessages.mutateAsync({
          ticket_id: selectedSession,
        });
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    getTickets.mutate(
      {
        page,
        per_page: perPage,
      },
      {
        onSuccess: (data) => {
          if (page === 1) {
            setSelectedSession(data.tickets[0]?.ticket_id.toString() ?? null);
            setSelectedStatus(data.tickets[0]?.status ?? 'open');
          }
        },
      }
    );
  }, [page, perPage]);

  useEffect(() => {
    if (selectedSession) {
      getTicketMessages.mutate({
        ticket_id: selectedSession,
      });
    }
  }, [selectedSession]);

  // Apply customization styles
  useEffect(() => {
    getSettings('customization', {
      onSuccess: (data) => {
        if (data) {
          const {
            primary_color,
            primary_gradient,
            secondary_color,
            secondary_gradient,
            font_size,
            icon_size,
            position,
            bot_icon,
          } = data;
          document.documentElement.style.setProperty(
            '--primary-2',
            primary_color as unknown as string
          );
          document.documentElement.style.setProperty(
            '--primary-gradient',
            primary_gradient as unknown as string
          );
          document.documentElement.style.setProperty(
            '--secondary-2',
            secondary_color as unknown as string
          );
          document.documentElement.style.setProperty(
            '--secondary-gradient',
            secondary_gradient as unknown as string
          );
          document.documentElement.style.setProperty(
            '--font-size',
            font_size as unknown as string
          );
          document.documentElement.style.setProperty(
            '--icon-size',
            icon_size as unknown as string
          );
          document.documentElement.style.setProperty(
            '--position',
            position as unknown as string
          );
          document.documentElement.style.setProperty(
            '--bot-icon',
            bot_icon as unknown as string
          );
        }
      },
    });
  }, [getSettings]);

  const handleReply = async () => {
    if (!replyMessage.trim() || !selectedSession) return;

    const replyMessageText = replyMessage;
    setReplyMessage('');

    await replyToTicket.mutateAsync({
      ticket_id: selectedSession,
      message: replyMessageText,
    });

    // Refresh messages to show the new reply without showing loading screen
    setIsRefreshingAfterReply(true);
    getTicketMessages.mutate({
      ticket_id: selectedSession,
    }, {
      onSuccess: () => {
        setIsRefreshingAfterReply(false);
      },
      onError: () => {
        setIsRefreshingAfterReply(false);
      }
    });
  };

  const handleStatusChange = async (status: string) => {
    if (!selectedSession) return;

    await updateTicketStatus.mutateAsync({
      ticket_id: selectedSession,
      status,
    });

    setSelectedStatus(status);
  };

  // Convert chat history to ChatMessage format
  const messages: TicketMessage[] = ticketMessages?.messages ?? [];

  const sidebarContent = (tickets?.tickets ?? []).map((ticket, index) => (
    <SidebarMenuItem key={index} className="pb-2">
      <SidebarMenuButton
        onClick={() => {
          setSelectedSession(ticket.ticket_id.toString());
          setSelectedStatus(ticket.status);
        }}
        isActive={selectedSession === ticket.ticket_id.toString()}
        className={cn('p-3 h-auto rounded-none')}
      >
        <div className={cn('flex flex-col items-start')}>
          <span className="font-medium text-sm truncate max-w-[180px]">
            {ticket.subject}
          </span>
          <div className="flex gap-2 items-center">
            <span className="text-xs">{ticket.datetime}</span>
          </div>
        </div>
      </SidebarMenuButton>
    </SidebarMenuItem>
  ));

  const mainContent = (
    <div className="flex relative flex-col flex-1 h-full">
      {selectedSession ? (
        <>
          <div className="p-4 border-b">
            <div className="flex justify-between items-center">
              <Select value={selectedStatus} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="pending">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>

              {(() => {
                const firstMessage = messages[0];
                const userName = firstMessage?.metadata?.name as string;
                const userEmail = firstMessage?.metadata?.email as string;

                return (userName || userEmail) ? (
                  <div className="flex gap-3 items-center text-sm">
                    <div className="flex flex-col items-end">
                      <span className="font-medium">{userName || userEmail}</span>
                      {userName && userEmail && (
                        <span className="text-muted-foreground">{userEmail}</span>
                      )}
                    </div>
                    <div className="flex justify-center items-center w-8 h-8 rounded-full bg-primary/10">
                      <span className="text-xs font-medium text-primary">
                        {(userName || userEmail).charAt(0).toUpperCase()}
                      </span>
                    </div>
                  </div>
                ) : null;
              })()}
            </div>
          </div>
          <div className="overflow-y-auto flex-1 p-4">
            <div className="flex flex-col gap-4">
              {messages.map((message) => (
                <TicketBubble key={message.id} message={message} />
              ))}
            </div>
          </div>
          <div className="p-4 border-t">
            <div className="flex gap-2">
              <Input
                placeholder="Type your reply..."
                value={replyMessage}
                onChange={(e) => setReplyMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleReply();
                  }
                }}
              />
              <Button onClick={handleReply} disabled={!replyMessage.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </>
      ) : (
        <div className="py-12 text-center text-muted-foreground">
          No active ticket sessions.
        </div>
      )}
    </div>
  );

  return (
    <ActivityLayout
      title="Tickets"
      description="View and manage support tickets."
      isRefreshing={isRefreshing}
      onRefresh={handleRefresh}
      sidebarContent={sidebarContent}
      mainContent={mainContent}
      isLoading={isLoading}
      pagination={
        tickets?.pagination
          ? {
              currentPage: tickets.pagination.current_page,
              totalPages: tickets.pagination.total_pages,
              onPageChange: setPage,
            }
          : undefined
      }
    />
  );
}
