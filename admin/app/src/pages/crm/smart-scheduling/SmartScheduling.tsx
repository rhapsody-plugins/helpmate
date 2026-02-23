import PageHeader from '@/components/PageHeader';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { MenuItem } from '@/types';
import { Suspense, lazy, useMemo, useState } from 'react';

// Lazy load tab components
const TabSettings = lazy(() => import('./tabs/TabSettings'));
const TabSchedules = lazy(() => import('./tabs/TabSchedules'));

// ============================================================================
// COMPONENT
// ============================================================================

export default function SmartScheduling() {
  const [tab, setTab] = useState('Schedules');

  const MENU_ITEMS = useMemo<MenuItem[]>(
    () => [
      {
        title: 'Schedules',
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
    <div className="relative">
      <Tabs className="gap-0" value={tab} onValueChange={setTab}>
        <PageHeader menuItems={MENU_ITEMS} title="Scheduling" />
        <TabsContent value={tab} className="p-6">
          <Suspense fallback={<div>Loading...</div>}>
            {tab === 'Schedules' && <TabSchedules />}
            {tab === 'Settings' && <TabSettings />}
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}

