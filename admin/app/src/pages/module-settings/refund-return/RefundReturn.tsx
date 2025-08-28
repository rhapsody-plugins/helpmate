import PageHeader from '@/components/PageHeader';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { MenuItem } from '@/types';
import { Suspense, lazy, useMemo, useState } from 'react';

// Lazy load tab components
const TabSettings = lazy(() => import('./tabs/TabSettings'));
const TabRequests = lazy(() => import('./tabs/TabRequests'));

// ============================================================================
// COMPONENT
// ============================================================================

export default function RefundReturn() {
  const [tab, setTab] = useState('Settings');

  const MENU_ITEMS = useMemo<MenuItem[]>(
    () => [
      {
        title: 'Settings',
        status: true,
      },
      {
        title: 'Requests',
        status: true,
      },
    ],
    []
  );

  return (
    <Tabs className="gap-0" value={tab} onValueChange={setTab}>
      <PageHeader
        menuItems={MENU_ITEMS}
        title="Refund & Return"
      />
      <TabsContent value={tab} className="p-6">
        <Suspense fallback={<div>Loading...</div>}>
          {tab === 'Settings' && <TabSettings />}
          {tab === 'Requests' && <TabRequests />}
        </Suspense>
      </TabsContent>
    </Tabs>
  );
}
