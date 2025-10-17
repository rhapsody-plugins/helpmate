import Layout from '@/components/Layout';
import TopBar from '@/components/TopBar';
import { Toaster } from '@/components/ui/sonner';
import { MainProvider } from '@/contexts/MainContext';
import Dashboard from '@/pages/Dashboard';
import ManageApi from '@/pages/ManageApi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

const queryClient = new QueryClient();

declare global {
  interface Window {
    wp: {
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
    };
  }
}

function App() {
  // Get tab from URL search params
  const urlParams = new URLSearchParams(window.location.search);
  const tab = urlParams.get('tab') ?? '';
  const [page, setPage] = useState(tab ? 'home' : 'dashboard');

  return (
    <QueryClientProvider client={queryClient}>
      <MainProvider>
        <TopBar onPageChange={setPage} page={page} />
        {page === 'home' && <Layout />}
        {page === 'dashboard' && <Dashboard setAppPage={setPage} />}
        {page === 'manage-api' && <ManageApi setPage={setPage} />}
        <Toaster />
      </MainProvider>
    </QueryClientProvider>
  );
}

export default App;
