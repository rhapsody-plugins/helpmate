import PageHeader from '@/components/PageHeader';
import PageSkeleton from '@/components/PageSkeleton';
import PageGuard from '@/components/PageGuard';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { MenuItem } from '@/types';
import { Palette, Settings2 } from 'lucide-react';
import { lazy, Suspense, useMemo, useState } from 'react';
import behavior from '@/assets/apps/behavior.svg';
import { ChangeSvgColor } from 'svg-color-tools';
import { __ } from '@/lib/utils';

// Lazy load tab components
const TabAi = lazy(() => import('@/pages/settings/tabs/TabAi'));
const TabWidget = lazy(() => import('@/pages/customization/tabs/TabWidget'));
const BehaviorTab = lazy(() => import('@/pages/behavior/BehaviorTab'));

export default function Settings() {
  const MENU_ITEMS = useMemo<MenuItem[]>(
    () => [
      {
        title: __('Chatbot'),
        icon: <Settings2 className="w-4 h-4" strokeWidth={1.5} />,
        status: true,
      },
      {
        title: __('Appearance'),
        icon: <Palette className="w-4 h-4" strokeWidth={1.5} />,
        status: true,
      },
      {
        title: __('Behavior'),
        icon: <ChangeSvgColor src={behavior} strokeWidth="1.5px" className="w-4 h-4" />,
        status: true,
      },
    ],
    []
  );

  const [tab, setTab] = useState(MENU_ITEMS[0]?.title ?? '');

  const tabChatbot = MENU_ITEMS[0]?.title ?? '';
  const tabAppearance = MENU_ITEMS[1]?.title ?? '';
  const tabBehavior = MENU_ITEMS[2]?.title ?? '';

  return (
    <PageGuard page="settings">
      <Tabs className="gap-0" value={tab} onValueChange={setTab}>
        <PageHeader menuItems={MENU_ITEMS} title={__('Settings')} />
        <TabsContent value={tab} className="p-6">
          <Suspense fallback={<PageSkeleton />}>
            {tab === tabChatbot && <TabAi />}
            {tab === tabAppearance && <TabWidget />}
            {tab === tabBehavior && <BehaviorTab />}
          </Suspense>
        </TabsContent>
      </Tabs>
    </PageGuard>
  );
}
