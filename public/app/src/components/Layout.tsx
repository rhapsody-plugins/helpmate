import ChatWidget from '@/components/ChatWidget';
import SalesNotification from '@/components/SalesNotification';
import { useSettings } from '@/hooks/useSettings';

export default function Layout() {
  const { getSettingsQuery } = useSettings();
  const { data: settings } = getSettingsQuery;

  if (!settings?.modules?.chatbot) return;

  return (
    <>
      <SalesNotification />
      <ChatWidget />
    </>
  );
}
