import PageHeader from '@/components/PageHeader';
import PageGuard from '@/components/PageGuard';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { MenuItem } from '@/types';
import { useMarkReadByType } from '@/hooks/useNotifications';
import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { __ } from '@/lib/utils';

// Lazy load tab components
const TabSettings = lazy(() =>
  import('@/pages/crm/smart-scheduling/tabs/TabSettings')
);
const TabSchedules = lazy(() =>
  import('@/pages/crm/smart-scheduling/tabs/TabSchedules')
);

export default function Appointments() {
  const [tab, setTab] = useState('Schedules');
  const { mutate: markReadByType } = useMarkReadByType();

  useEffect(() => {
    markReadByType('appointment');
  }, [markReadByType]);

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
    <PageGuard page="appointments-bookings">
      <div className="relative">
        <Tabs className="gap-0" value={tab} onValueChange={setTab}>
          <PageHeader menuItems={MENU_ITEMS} title={__('Appointments & Bookings')} />
          <TabsContent value={tab} className="p-6">
            <Suspense fallback={<div>{__('Loading...')}</div>}>
              {tab === 'Schedules' && <TabSchedules />}
              {tab === 'Settings' && <TabSettings />}
            </Suspense>
          </TabsContent>
        </Tabs>
      </div>
    </PageGuard>
  );
}
