import PageHeader from '@/components/PageHeader';
import PageSkeleton from '@/components/PageSkeleton';
import PageGuard from '@/components/PageGuard';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { MenuItem } from '@/types';
import { Palette, Settings2 } from 'lucide-react';
import { lazy, Suspense, useMemo, useState } from 'react';
import behavior from '@/assets/apps/behavior.svg';
import { ChangeSvgColor } from 'svg-color-tools';

// Lazy load tab components
const TabAi = lazy(() => import('@/pages/settings/tabs/TabAi'));
const TabWidget = lazy(() => import('@/pages/customization/tabs/TabWidget'));
const BehaviorTab = lazy(() => import('@/pages/behavior/BehaviorTab'));

export default function Settings() {
  const [tab, setTab] = useState('Chatbot');

  const MENU_ITEMS = useMemo<MenuItem[]>(
    () => [
      {
        title: 'Chatbot',
        icon: <Settings2 className="w-4 h-4" strokeWidth={1.5} />,
        status: true,
      },
      {
        title: 'Appearance',
        icon: <Palette className="w-4 h-4" strokeWidth={1.5} />,
        status: true,
      },
      {
        title: 'Behavior',
        icon: <ChangeSvgColor src={behavior} strokeWidth="1.5px" className="w-4 h-4" />,
        status: true,
      },
    ],
    []
  );

  return (
    <PageGuard page="settings">
      <Tabs className="gap-0" value={tab} onValueChange={setTab}>
        <PageHeader menuItems={MENU_ITEMS} title="Settings" />
        <TabsContent value={tab} className="p-6">
          <Suspense fallback={<PageSkeleton />}>
            {tab === 'Chatbot' && <TabAi />}
            {tab === 'Appearance' && <TabWidget />}
            {tab === 'Behavior' && <BehaviorTab />}
          </Suspense>
        </TabsContent>
      </Tabs>
    </PageGuard>
  );
}
