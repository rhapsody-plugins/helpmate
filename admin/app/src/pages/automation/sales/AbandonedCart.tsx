import PageGuard from '@/components/PageGuard';
import PageHeader from '@/components/PageHeader';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { useMain } from '@/contexts/MainContext';
import { MenuItem } from '@/types';
import { Suspense, lazy, useMemo, useState } from 'react';

// Lazy load tab components
const TabSettings = lazy(() =>
  import('@/pages/crm/abandoned-cart/tabs/TabSettings')
);
const TabAnalytics = lazy(() =>
  import('@/pages/crm/abandoned-cart/tabs/TabAnalytics')
);
const TabCarts = lazy(() => import('@/pages/crm/abandoned-cart/tabs/TabCarts'));
const TabFollowUpEmails = lazy(() =>
  import('@/pages/crm/abandoned-cart/tabs/TabFollowUpEmails')
);

export default function AbandonedCart() {
  const { page } = useMain();
  const [tab, setTab] = useState('Settings');

  const MENU_ITEMS = useMemo<MenuItem[]>(
    () => [
      {
        title: 'Settings',
        status: true,
      },
      {
        title: 'Follow Up Emails',
        status: true,
      },
      {
        title: 'Carts',
        status: true,
      },
      {
        title: 'Analytics',
        status: true,
      },
    ],
    []
  );

  return (
    <PageGuard page={page}>
      <div className="relative">
        <Tabs className="gap-0" value={tab} onValueChange={setTab}>
        <PageHeader menuItems={MENU_ITEMS} title="Abandoned Cart" />
        <TabsContent value={tab} className="p-6">
          <Suspense fallback={<div>Loading...</div>}>
            {tab === 'Settings' && <TabSettings />}
            {tab === 'Follow Up Emails' && <TabFollowUpEmails />}
            {tab === 'Carts' && <TabCarts />}
            {tab === 'Analytics' && <TabAnalytics />}
          </Suspense>
        </TabsContent>
      </Tabs>
      </div>
    </PageGuard>
  );
}
