import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { type ContactFormData } from '@/pages/crm/contacts/schemas';
import { ConversationsTab } from '@/pages/crm/contacts/tabs/ConversationsTab';
import { EmailsTab } from '@/pages/crm/contacts/tabs/EmailsTab';
import { NotesTab } from '@/pages/crm/contacts/tabs/NotesTab';
import { OrdersTab } from '@/pages/crm/contacts/tabs/OrdersTab';
import { OverviewTab } from '@/pages/crm/contacts/tabs/OverviewTab';
import { TasksTab } from '@/pages/crm/contacts/tabs/TasksTab';
import { TicketsTab } from '@/pages/crm/contacts/tabs/TicketsTab';
import { CustomField } from '@/types/crm';
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  Mail,
  MessageCircle,
  ShoppingBag,
  TicketPercent,
  User,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { UseFormReturn } from 'react-hook-form';

interface ContactSidebarContentProps {
  contactId: number;
  form: UseFormReturn<ContactFormData>;
  customFields: CustomField[];
  statuses: string[];
}

export default function ContactSidebarContent({
  contactId,
  form,
  customFields,
  statuses,
}: ContactSidebarContentProps) {
  const tabsScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScrollPosition = useCallback(() => {
    const element = tabsScrollRef.current;
    if (!element) return;

    const { scrollLeft, scrollWidth, clientWidth } = element;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 1);
  }, []);

  useEffect(() => {
    const element = tabsScrollRef.current;
    if (!element) return;

    // Check scroll position using requestAnimationFrame for better timing
    const checkPosition = () => {
      requestAnimationFrame(() => {
        checkScrollPosition();
      });
    };

    // Initial check
    checkPosition();

    // Also check after a short delay to ensure layout is complete
    const timeoutId = setTimeout(checkPosition, 100);

    element.addEventListener('scroll', checkScrollPosition);
    window.addEventListener('resize', checkPosition);

    return () => {
      clearTimeout(timeoutId);
      element.removeEventListener('scroll', checkScrollPosition);
      window.removeEventListener('resize', checkPosition);
    };
  }, [contactId, checkScrollPosition]);

  const handleScrollLeft = () => {
    const element = tabsScrollRef.current;
    if (element) {
      element.scrollBy({ left: -200, behavior: 'smooth' });
    }
  };

  const handleScrollRight = () => {
    const element = tabsScrollRef.current;
    if (element) {
      element.scrollBy({ left: 200, behavior: 'smooth' });
    }
  };

  return (
    <div className="p-4">
      <Tabs defaultValue="overview" className="w-full">
        <div className="grid relative">
          {canScrollLeft && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute -left-3 top-1/2 z-10 w-6 h-6 rounded-full border shadow-md -translate-y-1/2 bg-background border-border"
              onClick={handleScrollLeft}
            >
              <ChevronLeft className="w-3 h-3" />
            </Button>
          )}
          <div
            ref={tabsScrollRef}
            className="overflow-x-auto w-full [&::-webkit-scrollbar]:hidden"
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
            onScroll={checkScrollPosition}
          >
            <TabsList className="flex" style={{ minWidth: 'max-content', width: 'max-content' }}>
              <TabsTrigger value="overview" className="flex-shrink-0 text-xs">
                <User className="w-3 h-3" />
                Info
              </TabsTrigger>
              <TabsTrigger value="emails" className="flex-shrink-0 text-xs">
                <Mail className="w-3 h-3" />
                Emails
              </TabsTrigger>
              <TabsTrigger value="orders" className="flex-shrink-0 text-xs">
                <ShoppingBag className="w-3 h-3" />
                Orders
              </TabsTrigger>
              <TabsTrigger value="conversations" className="flex-shrink-0 text-xs">
                <MessageCircle className="w-3 h-3" />
                Conversations
              </TabsTrigger>
              <TabsTrigger value="tickets" className="flex-shrink-0 text-xs">
                <TicketPercent className="w-3 h-3" />
                Tickets
              </TabsTrigger>
              <TabsTrigger value="tasks" className="flex-shrink-0 text-xs">
                <ClipboardList className="w-3 h-3" />
                Tasks
              </TabsTrigger>
              <TabsTrigger value="notes" className="flex-shrink-0 text-xs">
                <FileText className="w-3 h-3" />
                Notes
              </TabsTrigger>
            </TabsList>
          </div>
          {canScrollRight && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute -right-3 top-1/2 z-10 w-6 h-6 rounded-full border shadow-md -translate-y-1/2 bg-background border-border"
              onClick={handleScrollRight}
            >
              <ChevronRight className="w-3 h-3" />
            </Button>
          )}
        </div>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab
            form={form}
            customFields={customFields}
            statuses={statuses}
          />
        </TabsContent>

        <TabsContent value="emails" className="mt-4">
          <EmailsTab contactId={contactId} />
        </TabsContent>

        <TabsContent value="orders" className="mt-4">
          <OrdersTab contactId={contactId} />
        </TabsContent>

        <TabsContent value="conversations" className="mt-4">
          <ConversationsTab contactId={contactId} />
        </TabsContent>

        <TabsContent value="tickets" className="mt-4">
          <TicketsTab contactId={contactId} />
        </TabsContent>

        <TabsContent value="tasks" className="mt-4">
          <TasksTab contactId={contactId} />
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          <NotesTab contactId={contactId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
