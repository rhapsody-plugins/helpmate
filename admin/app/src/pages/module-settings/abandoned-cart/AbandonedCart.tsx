import PageHeader from '@/components/PageHeader';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { MenuItem } from '@/types';
import { Suspense, lazy, useMemo, useState } from 'react';

// Lazy load tab components
const TabSettings = lazy(() => import('./tabs/TabSettings'));
const TabAnalytics = lazy(() => import('./tabs/TabAnalytics'));
const TabCarts = lazy(() => import('./tabs/TabCarts'));

// ============================================================================
// COMPONENT
// ============================================================================

export default function AbandonedCart() {
  const [tab, setTab] = useState('Settings');

  const MENU_ITEMS = useMemo<MenuItem[]>(
    () => [
      {
        title: 'Settings',
        status: true,
      },
      {
        title: 'Analytics',
        status: true,
      },
      {
        title: 'Carts',
        status: true,
      },
    ],
    []
  );

  return (
    <Tabs className="gap-0" value={tab} onValueChange={setTab}>
      <PageHeader
        menuItems={MENU_ITEMS}
        title="Abandoned Cart"
      />
      <TabsContent value={tab} className="p-6">
        <Suspense fallback={<div>Loading...</div>}>
          {tab === 'Settings' && <TabSettings />}
          {tab === 'Analytics' && <TabAnalytics />}
          {tab === 'Carts' && <TabCarts />}
        </Suspense>
      </TabsContent>
    </Tabs>
  );
}
