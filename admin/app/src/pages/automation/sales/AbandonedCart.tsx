import PageGuard from '@/components/PageGuard';
import PageHeader from '@/components/PageHeader';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { useMain } from '@/contexts/MainContext';
import { MenuItem } from '@/types';
import { Suspense, lazy, useMemo, useState } from 'react';
import { __ } from '@/lib/utils';

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
        title: 'Abandoned List',
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
        <PageHeader menuItems={MENU_ITEMS} title={__('Abandoned Cart')} />
        <TabsContent value={tab} className="p-6">
          <Suspense fallback={<div>{__('Loading...')}</div>}>
            {tab === 'Settings' && <TabSettings />}
            {tab === 'Follow Up Emails' && <TabFollowUpEmails />}
            {tab === 'Abandoned List' && <TabCarts />}
            {tab === 'Analytics' && <TabAnalytics />}
          </Suspense>
        </TabsContent>
      </Tabs>
      </div>
    </PageGuard>
  );
}
