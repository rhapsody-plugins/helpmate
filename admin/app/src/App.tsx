import Layout from '@/components/Layout';
import TopBar from '@/components/TopBar';
import { Toaster } from '@/components/ui/sonner';
import { MainProvider } from '@/contexts/MainContext';
import License from '@/pages/License';
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
  const [page, setPage] = useState('home');
  return (
    <QueryClientProvider client={queryClient}>
      <MainProvider>
        <TopBar onPageChange={setPage} />
        {page === 'home' && <Layout />}
        {page === 'license' && <License setPage={setPage} />}
        <Toaster />
      </MainProvider>
    </QueryClientProvider>
  );
}

export default App;
