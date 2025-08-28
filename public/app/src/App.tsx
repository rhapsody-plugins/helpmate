import Layout from '@/components/Layout';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from '@/context/ThemeContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

function App() {
  return (
    <div className="relative z-[10000]">
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <Layout />
          <Toaster position="bottom-left" closeButton />
        </ThemeProvider>
      </QueryClientProvider>
    </div>
  );
}

export default App;
