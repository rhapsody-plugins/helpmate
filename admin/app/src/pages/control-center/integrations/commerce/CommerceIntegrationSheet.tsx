import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { ReactNode } from 'react';

type CommerceIntegrationSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
};

/**
 * Generic commerce settings shell. Mount provider-specific panels via `children`
 * (e.g. React.lazy + Suspense from {@link getCommercePanel}).
 */
export default function CommerceIntegrationSheet({
  open,
  onOpenChange,
  title = 'Commerce',
  children,
  footer,
}: CommerceIntegrationSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col w-full sm:max-w-lg overflow-hidden">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <div className="p-4 flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto">
          {children}
        </div>
        {footer ? <SheetFooter>{footer}</SheetFooter> : null}
      </SheetContent>
    </Sheet>
  );
}
