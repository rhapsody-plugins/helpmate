import PageHeader from '@/components/PageHeader';
import PageSkeleton from '@/components/PageSkeleton';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { MenuItem } from '@/types';
import { BotMessageSquare } from 'lucide-react';
import { lazy, Suspense, useMemo, useState } from 'react';

// Lazy load tab components
const TabAi = lazy(() => import('@/pages/settings/tabs/TabAi'));

export default function Settings() {
  const [tab, setTab] = useState('Chatbot');

  const MENU_ITEMS = useMemo<MenuItem[]>(
    () => [
      {
        title: 'Chatbot',
        icon: <BotMessageSquare />,
        status: true,
      },
    ],
    []
  );

  /*
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │   Renders                                                                   │
  └─────────────────────────────────────────────────────────────────────────────┘
 */

  return (
    <Tabs className="gap-0" value={tab} onValueChange={setTab}>
      <PageHeader menuItems={MENU_ITEMS} title="Settings" />
      <TabsContent value={tab} className="p-6">
        <Suspense fallback={<PageSkeleton />}>
          {tab === 'Chatbot' && <TabAi />}
        </Suspense>
      </TabsContent>
    </Tabs>
  );
}
