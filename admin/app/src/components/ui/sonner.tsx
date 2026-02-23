import { Toaster as Sonner, ToasterProps } from 'sonner';
import { getPortalContainer } from '@/lib/utils';
import { useEffect, useState } from 'react';

const Toaster = ({ ...props }: ToasterProps) => {
  // Use state to ensure we get the portal container after mount
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setContainer(getPortalContainer());
  }, []);

  // Don't render until we have the container to prevent body fallback
  if (!container) return null;

  return (
    <Sonner
      theme="light"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton:
            'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton:
            'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
