import PageHeader from '@/components/PageHeader';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { MenuItem } from '@/types';
import { Suspense, lazy, useMemo, useState } from 'react';

// Lazy load tab components
const TabSettings = lazy(() => import('./tabs/TabSettings'));
const TabProducts = lazy(() => import('./tabs/TabProducts'));

// ============================================================================
// COMPONENT
// ============================================================================

export default function ProactiveSales() {
  const [tab, setTab] = useState('Products');

  const MENU_ITEMS = useMemo<MenuItem[]>(
    () => [
      {
        title: 'Products',
        status: true,
      },
      {
        title: 'Settings',
        status: true,
      },
    ],
    []
  );

  return (
    <Tabs className="gap-0" value={tab} onValueChange={setTab}>
      <PageHeader menuItems={MENU_ITEMS} title="Proactive Sales" />
      <TabsContent value={tab} className="p-6">
        <Suspense fallback={<div>Loading...</div>}>
          {tab === 'Products' && <TabProducts />}
          {tab === 'Settings' && <TabSettings />}
        </Suspense>
      </TabsContent>
    </Tabs>
  );
}
