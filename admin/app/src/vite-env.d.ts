/// <reference types="vite/client" />
/// <reference types="react" />

declare global {
  interface Window {
    wp?: {
      media?: (opts: { title?: string; button?: { text?: string }; multiple?: boolean }) => {
        on: (event: string, cb: () => void) => void;
        open: () => void;
        state: () => { get: (key: string) => { first: () => { toJSON: () => { url?: string; alt?: string; title?: string } } } };
      };
    };
    HelpmatePro?: {
      isPro?: boolean;
      components?: {
        OrderTracker?: React.ComponentType<{
          data: Record<string, unknown>;
          messageId: string;
          onSubmit: () => void;
        }>;
        RefundReturn?: React.ComponentType<{
          data: Record<string, unknown>;
          messageId: string;
          onSubmit: () => void;
        }>;
      };
    };
  }
}

export {}