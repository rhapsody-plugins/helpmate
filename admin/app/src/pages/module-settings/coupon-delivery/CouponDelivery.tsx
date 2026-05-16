import PageGuard from '@/components/PageGuard';
import PageHeader from '@/components/PageHeader';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { MenuItem } from '@/types';
import { Suspense, lazy, useMemo, useState } from 'react';
import { __ } from '@/lib/utils';

// Lazy load tab components
const TabSettings = lazy(() => import('./tabs/TabSettings'));
const TabCoupons = lazy(() => import('./tabs/TabCoupons'));

// ============================================================================
// COMPONENT
// ============================================================================

export default function CouponDelivery() {
  const [tab, setTab] = useState('Coupons');

  const MENU_ITEMS = useMemo<MenuItem[]>(
    () => [
      {
        title: 'Coupons',
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
    <PageGuard page="coupon-delivery">
      <Tabs className="gap-0" value={tab} onValueChange={setTab}>
        <PageHeader
          menuItems={MENU_ITEMS}
          title={__('Coupon Delivery')}
        />
        <TabsContent value={tab} className="p-6">
          <Suspense fallback={<div>{__('Loading...')}</div>}>
            {tab === 'Coupons' && <TabCoupons />}
            {tab === 'Settings' && <TabSettings />}
          </Suspense>
        </TabsContent>
      </Tabs>
    </PageGuard>
  );
}
