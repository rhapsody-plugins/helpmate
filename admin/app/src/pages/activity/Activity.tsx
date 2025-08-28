import PageHeader from '@/components/PageHeader';
import PageSkeleton from '@/components/PageSkeleton';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { MenuItem } from '@/types';
import { Suspense, lazy, useMemo, useState } from 'react';

// Lazy load tab components
const TabChat = lazy(() => import('@/pages/activity/tabs/TabChat'));
const TabTicket = lazy(() => import('@/pages/activity/tabs/TabTicket'));
const TabLead = lazy(() => import('@/pages/activity/tabs/TabLead'));

export default function Activity() {
  const [tab, setTab] = useState('Chat');

  const MENU_ITEMS = useMemo<MenuItem[]>(
    () => [
      {
        title: 'Chat',
        status: true,
      },
      {
        title: 'Ticket',
        status: true,
      },
      {
        title: 'Leads',
        status: true,
      },
    ],
    []
  );

  return (
    <Tabs className="gap-0" value={tab} onValueChange={setTab}>
      <PageHeader menuItems={MENU_ITEMS} title="Activity" />
      <TabsContent value={tab} className="p-6">
        <Suspense fallback={<PageSkeleton />}>
          {tab === 'Chat' && <TabChat />}
          {tab === 'Ticket' && <TabTicket />}
          {tab === 'Leads' && <TabLead />}
        </Suspense>
      </TabsContent>
    </Tabs>
  );
}
