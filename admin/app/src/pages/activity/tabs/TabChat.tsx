import { MessageBubble } from '@/components/chat/MessageBubble';
import { ActivityLayout } from '@/components/layout/ActivityLayout';
import { SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import useActivity from '@/hooks/useActivity';
import { useSettings } from '@/hooks/useSettings';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/types';
import { useEffect, useState } from 'react';

export default function TabChat() {
  const { getSessions, getChatHistory } = useActivity();
  const { getSettingsMutation } = useSettings();
  const { mutate: getSettings } = getSettingsMutation;
  const [page, setPage] = useState(1);
  const [perPage] = useState(10);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: sessions, isPending: sessionsLoading } = getSessions;
  const { data: chatHistory, isPending: chatHistoryLoading } = getChatHistory;

  const isLoading = Boolean(sessionsLoading || (selectedSession && chatHistoryLoading));

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await getSessions.mutateAsync({
        page,
        per_page: perPage,
      });
      if (selectedSession) {
        await getChatHistory.mutateAsync({
          session_id: selectedSession,
        });
      }
    } finally {
      setIsRefreshing(false);
    }
  };

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

  useEffect(() => {
    getSessions.mutate(
      {
        page,
        per_page: perPage,
      },
      {
        onSuccess: (data) => {
          if (page === 1) {
            setSelectedSession(data.sessions[0]?.session_id ?? null);
          }
        },
      }
    );
  }, [page, perPage]);

  useEffect(() => {
    if (selectedSession) {
      getChatHistory.mutate({
        session_id: selectedSession,
      });
    }
  }, [selectedSession, sessions]);

      // Convert chat history to ChatMessage format and sort properly
  const messages: ChatMessage[] =
    chatHistory?.history
      ?.map((msg) => ({
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        content: msg.message,
        createdAt: new Date(parseInt(msg.timestamp, 10) * 1000),
        type: 'text' as const,
        metadata: msg.metadata as Record<string, unknown>,
      }))
      .sort((a, b) => {
        // First sort by timestamp
        const timeDiff = a.createdAt.getTime() - b.createdAt.getTime();
        if (timeDiff !== 0) return timeDiff;

        // If same timestamp, user messages should come before assistant messages
        if (a.role === 'user' && b.role === 'assistant') return -1;
        if (a.role === 'assistant' && b.role === 'user') return 1;

        // If same role, sort by ID
        return a.id - b.id;
      }) ?? [];

  const sidebarContent = (sessions?.sessions ?? []).map((session, index) => (
    <SidebarMenuItem key={index}>
      <SidebarMenuButton
        onClick={() => setSelectedSession(session.session_id)}
        isActive={selectedSession === session.session_id}
        className={cn('p-3 h-auto rounded-none')}
      >
        <div className={cn('flex flex-col items-start')}>
          <span className="font-medium text-sm truncate max-w-[180px]">
            {session.start_time}
          </span>
          <div className="flex gap-2 items-center">
            <span className="text-xs">{session.message_count} messages</span>
            {/* <span className="text-xs">{session.total_tokens} tokens</span> */}
          </div>
        </div>
      </SidebarMenuButton>
    </SidebarMenuItem>
  ));

  const mainContent = (
    <div className="overflow-y-auto flex-1 p-4 h-full">
      {selectedSession ? (
        <div className="flex flex-col gap-4">
          {messages.map((message, index) => (
            <MessageBubble
              key={index}
              message={message}
              messages={messages}
              index={index}
              sessionId={selectedSession}
              onRefresh={handleRefresh}
            />
          ))}
        </div>
      ) : (
        <div className="py-12 text-center text-muted-foreground">
          No active chat sessions.
        </div>
      )}
    </div>
  );

  return (
    <ActivityLayout
      title="Chat"
      description="View all your chat conversations."
      isRefreshing={isRefreshing}
      onRefresh={handleRefresh}
      sidebarContent={sidebarContent}
      mainContent={mainContent}
      isLoading={isLoading}
      pagination={
        sessions?.pagination
          ? {
              currentPage: sessions.pagination.current_page,
              totalPages: sessions.pagination.total_pages,
              onPageChange: setPage,
            }
          : undefined
      }
    />
  );
}
