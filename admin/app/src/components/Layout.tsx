import { AppSidebar } from '@/components/AppSidebar';
import Loading from '@/components/Loading';
import { SidebarProvider } from '@/components/ui/sidebar';
import { useMain } from '@/context/MainContext';
import { lazy, Suspense } from 'react';

const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Activity = lazy(() => import('@/pages/activity/Activity'));
const DataSource = lazy(() => import('@/pages/data-source/DataSource'));
const Customization = lazy(() => import('@/pages/customization/Customization'));
const Settings = lazy(() => import('@/pages/settings/Settings'));
const Modules = lazy(() => import('@/pages/modules/Modules'));
const ProactiveSales = lazy(
  () => import('@/pages/module-settings/proactive-sales/ProactiveSales')
);
const SalesNotifications = lazy(
  () => import('@/pages/module-settings/SalesNotifications')
);
const AbandonedCart = lazy(
  () => import('@/pages/module-settings/abandoned-cart/AbandonedCart')
);
const CouponDelivery = lazy(
  () => import('@/pages/module-settings/coupon-delivery/CouponDelivery')
);
const OrderTracker = lazy(() => import('@/pages/module-settings/OrderTracker'));
const ImageSearch = lazy(() => import('@/pages/module-settings/ImageSearch'));
const PromoBanner = lazy(() => import('@/pages/module-settings/PromoBanner'));
const RefundReturn = lazy(() => import('@/pages/module-settings/refund-return/RefundReturn'));
const Behavior = lazy(() => import('@/pages/behavior/Behavior'));

export default function Layout() {
  const { page } = useMain();

  const renderPage = () => {
    switch (page) {
      case 'dashboard':
        return <Dashboard />;
      case 'activity':
        return <Activity />;
      case 'data-source':
        return <DataSource />;
      case 'customization':
        return <Customization />;
      case 'behavior':
        return <Behavior />;
      case 'settings':
        return <Settings />;
      case 'apps':
        return <Modules />;
      case 'proactive-sales':
        return <ProactiveSales />;
      case 'sales-notifications':
        return <SalesNotifications />;
      case 'abandoned-cart':
        return <AbandonedCart />;
      case 'coupon-delivery':
        return <CouponDelivery />;
      case 'order-tracker':
        return <OrderTracker />;
      case 'image-search':
        return <ImageSearch />;
      case 'promo-banner':
        return <PromoBanner />;
      case 'refund-return':
        return <RefundReturn />;
      default:
        return null;
    }
  };

  return (
    <SidebarProvider>
      <AppSidebar />
      <div className="w-full h-full bg-sidebar">
        <main className="overflow-auto w-full bg-white rounded-xl">
          <div className="flex flex-col gap-2">
            <Suspense fallback={<Loading />}>{renderPage()}</Suspense>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
