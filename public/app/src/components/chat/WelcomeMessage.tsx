import { useSettings } from '@/hooks/useSettings';
import { ChatMessage } from '@/types';

export function WelcomeMessage() {
  const { getSettingsQuery } = useSettings();
  const welcomeMessage = getSettingsQuery.data?.settings.welcome_message;
  const messages: ChatMessage[] = [];
  if (welcomeMessage) {
    welcomeMessage.forEach((message) => {
      messages.push({
        id: 'welcome',
        role: 'assistant',
        content: message,
        type: 'text',
        createdAt: new Date(),
      });
    });
  }
  return (
    <div className="p-4 pb-0 space-y-4 h-full overflow-y-auto">
      {messages.map((message) => (
        <div
          className="text-lg font-medium text-slate-800 bg-slate-200 p-4 rounded-lg"
          key={message.id}
        >
          {message.content}
        </div>
      ))}
    </div>
  );
}
