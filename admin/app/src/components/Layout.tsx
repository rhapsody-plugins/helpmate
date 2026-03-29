import { AppSidebar } from '@/components/AppSidebar';
import Loading from '@/components/Loading';
import { SidebarProvider } from '@/components/ui/sidebar';
import { useMain } from '@/contexts/MainContext';
import { useApi } from '@/hooks/useApi';
import DataSource from '@/pages/data-source/DataSource';
import type { SocialChatSettingsProps } from '@/pages/social-chat/SocialChatSettings';
import { lazy, Suspense, useEffect } from 'react';
import type { ComponentType } from 'react';

const Analytics = lazy(() => import('@/pages/control-center/Analytics'));
const Settings = lazy(() => import('@/pages/settings/Settings'));
const OrderTracker = lazy(() => import('@/pages/module-settings/OrderTracker'));
const ImageSearch = lazy(() => import('@/pages/module-settings/ImageSearch'));
const RefundReturn = lazy(
  () => import('@/pages/module-settings/refund-return/RefundReturn')
);
const TestChatbot = lazy(() => import('@/pages/test-chatbot/TestChatbot'));
const SocialChatSettings = lazy<ComponentType<SocialChatSettingsProps>>(
  () => import('@/pages/social-chat/SocialChatSettings')
);
const SocialInbox = lazy(() => import('@/pages/social-chat/SocialInbox'));
const ContactsList = lazy(() => import('@/pages/crm/ContactsList'));
const ContactDetails = lazy(() => import('@/pages/crm/ContactDetails'));
const CustomFields = lazy(() => import('@/pages/crm/CustomFields'));
const Leads = lazy(() => import('@/pages/crm/Leads'));
const Emails = lazy(() => import('@/pages/crm/Emails'));
const Segments = lazy(() => import('@/pages/crm/Segments'));
const Team = lazy(() => import('@/pages/control-center/Team'));
const TasksList = lazy(() => import('@/pages/tasks/TasksList'));
const ControlCenterDashboard = lazy(
  () => import('@/pages/control-center/Dashboard')
);
const ControlCenterAnalytics = lazy(
  () => import('@/pages/control-center/Analytics')
);
const ControlCenterSettings = lazy(
  () => import('@/pages/control-center/Settings')
);
const ControlCenterIntegrations = lazy(
  () => import('@/pages/control-center/Integrations')
);
const ManageApi = lazy(() => import('@/pages/ManageApi'));
const Setup = lazy(() => import('@/pages/control-center/Setup'));
const EmailCampaigns = lazy(
  () => import('@/pages/automation/marketing/EmailCampaigns')
);
const LeadCapture = lazy(
  () => import('@/pages/automation/marketing/LeadCapture')
);
const CouponDeliveryAutomation = lazy(
  () => import('@/pages/automation/marketing/CouponDelivery')
);
const ProactiveSalesAutomation = lazy(
  () => import('@/pages/automation/marketing/ProactiveSales')
);
const EmailSequences = lazy(
  () => import('@/pages/automation/sales/EmailSequences')
);
const Appointments = lazy(
  () => import('@/pages/automation/sales/Appointments')
);
const AbandonedCartAutomation = lazy(
  () => import('@/pages/automation/sales/AbandonedCart')
);
const PromoBanner = lazy(
  () => import('@/pages/module-settings/PromoBanner')
);
const SalesNotifications = lazy(
  () => import('@/pages/module-settings/SalesNotifications')
);
const AutoResponses = lazy(
  () => import('@/pages/automation/support/AutoResponses')
);
const LiveChatSettings = lazy(
  () => import('@/pages/social-chat/LiveChatSettings')
);

function LayoutContent() {
  const { page, setPage } = useMain();
  const { apiKeyQuery } = useApi();
  const { data: apiKeyData, isLoading: isApiKeyLoading } = apiKeyQuery;

  // Redirect to setup if no API key and not already on setup page
  useEffect(() => {
    if (!isApiKeyLoading && !apiKeyData?.api_key && page !== 'setup') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', 'setup');
      window.history.pushState({}, '', url.toString());
      setPage('setup');
    }
  }, [isApiKeyLoading, apiKeyData?.api_key, page, setPage]);

  // Redirect legacy social-chat and social-chat-campaigns to Facebook settings
  useEffect(() => {
    if (page === 'social-chat' || page === 'social-chat-campaigns') {
      setPage('social-chat-facebook');
    }
  }, [page, setPage]);

  // If on setup page, render without sidebar/header
  if (page === 'setup') {
    return (
      <Suspense fallback={<Loading />}>
        <Setup setPage={setPage} />
      </Suspense>
    );
  }

  const renderPage = () => {
    switch (page) {
      case 'analytics':
        return <Analytics />;
      case 'data-source':
        return <DataSource />;
      case 'test-chatbot':
        return <TestChatbot />;
      case 'settings':
        return <Settings />;
      case 'proactive-sales':
        return <ProactiveSalesAutomation />;
      case 'abandoned-cart':
        return <AbandonedCartAutomation />;
      case 'appointments-bookings':
        return <Appointments />;
      case 'coupon-delivery':
        return <CouponDeliveryAutomation />;
      case 'automation-marketing-email-campaigns':
        return <EmailCampaigns />;
      case 'automation-marketing-lead-capture':
        return <LeadCapture />;
      case 'automation-marketing-coupon-delivery':
        return <CouponDeliveryAutomation />;
      case 'automation-marketing-proactive-sales':
        return <ProactiveSalesAutomation />;
      case 'automation-sales-email-sequences':
        return <EmailSequences />;
      case 'automation-sales-abandoned-cart':
        return <AbandonedCartAutomation />;
      case 'automation-sales-promo-banner':
        return <PromoBanner />;
      case 'automation-sales-sales-notifications':
        return <SalesNotifications />;
      case 'automation-support-auto-responses':
        return <AutoResponses />;
      case 'order-tracker':
        return <OrderTracker />;
      case 'image-search':
        return <ImageSearch />;
      case 'refund-return':
        return <RefundReturn />;
      case 'social-chat':
      case 'social-chat-campaigns':
        return <Loading />;
      case 'social-chat-facebook':
        return <SocialChatSettings page="social-chat-facebook" platform="facebook" />;
      case 'social-chat-instagram':
        return <SocialChatSettings page="social-chat-instagram" platform="instagram" />;
      case 'social-chat-whatsapp':
        return <SocialChatSettings page="social-chat-whatsapp" platform="whatsapp" />;
      case 'social-chat-tiktok':
        return <SocialChatSettings page="social-chat-tiktok" platform="tiktok" />;
      case 'live-chat-settings':
        return <LiveChatSettings />;
      case 'social-chat-inbox':
      case 'inbox-all':
      case 'inbox-chatbot':
      case 'inbox-live-chat':
      case 'inbox-tickets':
      case 'inbox-social-messages':
      case 'inbox-comments':
      case 'inbox-archived':
        return <SocialInbox />;
      case 'crm-contacts':
        return <ContactsList />;
      case 'crm-contact-details':
        return <ContactDetails />;
      case 'crm-custom-fields':
        return <CustomFields />;
      case 'crm-leads':
        return <Leads />;
      case 'crm-emails':
        return <Emails />;
      case 'crm-segments':
        return <Segments />;
      case 'tasks':
        return <TasksList />;
      case 'control-center-dashboard':
        return <ControlCenterDashboard />;
      case 'control-center-analytics':
        return <ControlCenterAnalytics />;
      case 'control-center-settings':
        return <ControlCenterSettings />;
      case 'control-center-integrations':
        return <ControlCenterIntegrations />;
      case 'control-center-team':
        return <Team />;
      case 'manage-api':
        return <ManageApi />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-1 w-full h-full min-h-0">
      <AppSidebar />
      <div className="flex-1 min-w-0 h-full min-h-0 bg-sidebar">
        <main className="overflow-auto w-full h-full bg-white rounded-xl">
          <div className="flex flex-col gap-2 h-full">
            <Suspense fallback={<Loading />}>{renderPage()}</Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function Layout() {
  return (
    <SidebarProvider>
      <LayoutContent />
    </SidebarProvider>
  );
}
