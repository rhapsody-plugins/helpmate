import Layout from '@/components/Layout';
import { NotificationTitleSync } from '@/components/NotificationTitleSync';
import { NotificationsProvider } from '@/components/NotificationsProvider';
import TopBar from '@/components/TopBar';
import { Toaster } from '@/components/ui/sonner';
import { MainProvider, useMain } from '@/contexts/MainContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

declare global {
  interface Window {
    wp?: {
      media: (options: {
        title?: string;
        button?: { text?: string };
        multiple?: boolean;
      }) => {
        on: (event: 'select', callback: () => void) => void;
        open: () => void;
        state: () => {
          get: (key: string) => {
            first: () => {
              toJSON: () => {
                id: number;
                url: string;
                alt: string;
                title: string;
              };
            };
          };
        };
      };
    };
    helpmateApiSettings: {
      nonce: string;
      site_url: string;
      rest_url: string;
    };
  }
}

function AppContent() {
  const { page } = useMain();

  // Hide TopBar on setup page
  const showTopBar = page !== 'setup';

  return (
    <div className="flex flex-col h-[90vh] min-h-0">
      {showTopBar ? (
        <NotificationsProvider>
          <NotificationTitleSync />
          <TopBar />
          <Layout />
        </NotificationsProvider>
      ) : (
        <>
          <Layout />
        </>
      )}
      <Toaster />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MainProvider>
        <AppContent />
      </MainProvider>
    </QueryClientProvider>
  );
}

export default App;
