import PageHeader from '@/components/PageHeader';
import { MenuItem } from '@/types';
import { Suspense, lazy, useMemo, useState } from 'react';
import { Tabs, TabsContent } from '@/components/ui/tabs';

// Lazy load tab components
const TabNeuroServe = lazy(() => import('./tabs/TabNeuroServe'));
const TabNeuroSales = lazy(() => import('./tabs/TabNeuroSales'));

export default function Modules() {
  const [tab, setTab] = useState('NeuroServe');

  const MENU_ITEMS = useMemo<MenuItem[]>(
    () => [
      {
        title: 'NeuroServe',
        status: true,
      },
      {
        title: 'NeuroSales',
        status: true,
      },
    ],
    []
  );

  return (
    <Tabs className="gap-0" value={tab} onValueChange={setTab}>
      <PageHeader
        menuItems={MENU_ITEMS}
        title="Apps"
      />
      <TabsContent value={tab} className="p-6">
        <Suspense fallback={<div>Loading...</div>}>
          {tab === 'NeuroServe' && <TabNeuroServe />}
          {tab === 'NeuroSales' && <TabNeuroSales />}
        </Suspense>
      </TabsContent>
    </Tabs>
  );
}
