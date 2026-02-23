import PageGuard from '@/components/PageGuard';
import PageHeader from '@/components/PageHeader';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { useMain } from '@/contexts/MainContext';
import { useSettings } from '@/hooks/useSettings';
import { cn } from '@/lib/utils';
import { MenuItem } from '@/types';
import { Suspense, lazy, useCallback, useMemo, useState } from 'react';

// Lazy load tab components
const TabSettings = lazy(() =>
  import('@/pages/module-settings/proactive-sales/tabs/TabSettings')
);
const TabProducts = lazy(() =>
  import('@/pages/module-settings/proactive-sales/tabs/TabProducts')
);

export default function ProactiveSales() {
  const [tab, setTab] = useState('Products');
  const { modules } = useMain();
  const { updateSettingsMutation, getModulesQuery } = useSettings();
  const { mutateAsync: updateSettings, isPending } = updateSettingsMutation;
  const isModuleEnabled = Boolean(modules['proactive-sales']);

  const handleModuleToggle = useCallback(async () => {
    const newSettings = { ...modules, 'proactive-sales': !isModuleEnabled };
    await updateSettings(
      {
        key: 'modules',
        data: newSettings,
      },
      {
        onSuccess: () => {
          getModulesQuery.refetch();
        },
      }
    );
  }, [modules, isModuleEnabled, updateSettings, getModulesQuery]);

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
    <PageGuard page="automation-marketing-proactive-sales">
      <Tabs className="gap-0" value={tab} onValueChange={setTab}>
        <PageHeader
          menuItems={MENU_ITEMS}
          title="Proactive Sales"
          rightActions={
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Enable Module</span>
              <Switch
                checked={isModuleEnabled}
                onCheckedChange={handleModuleToggle}
                disabled={isPending}
              />
            </div>
          }
        />
        <TabsContent
          value={tab}
          className={cn(
            'p-6',
            !isModuleEnabled && 'opacity-50 pointer-events-none cursor-not-allowed'
          )}
        >
          <Suspense fallback={<div>Loading...</div>}>
            {tab === 'Products' && <TabProducts />}
            {tab === 'Settings' && <TabSettings />}
          </Suspense>
        </TabsContent>
      </Tabs>
    </PageGuard>
  );
}
