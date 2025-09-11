import { OptInDialog } from '@/components/OptInDialog';
import PageHeader from '@/components/PageHeader';
import PageSkeleton from '@/components/PageSkeleton';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { useConsent } from '@/contexts/ConsentContext';
import { useDataSource } from '@/hooks/useDataSource';
import { useLicense } from '@/hooks/useLicense';
import { useWooCommerce } from '@/hooks/useWooCommerce';
import { MenuItem } from '@/types';
import { RefreshCw } from 'lucide-react';
import { Suspense, lazy, useEffect, useMemo, useState } from 'react';

// Lazy load tab components
const TabText = lazy(() => import('@/pages/data-source/tabs/TabText'));
const TabUrl = lazy(() => import('@/pages/data-source/tabs/TabUrl'));
const TabPost = lazy(() => import('@/pages/data-source/tabs/TabPost'));
const TabProducts = lazy(() => import('@/pages/data-source/tabs/TabProducts'));
const TabQnA = lazy(() => import('@/pages/data-source/tabs/TabQnA'));
const TabFile = lazy(() => import('@/pages/data-source/tabs/TabFile'));
const TabGeneral = lazy(() => import('@/pages/data-source/tabs/TabGeneral'));

// Simple component for right actions - no hooks to avoid violations
function RightActions({
  isLicensePending,
  tab,
  licenseData,
  syncCredits,
  isSyncing
}: {
  isLicensePending: boolean;
  tab: string;
  licenseData: {
    local_credits?: {
      feature_slug: string;
      credits: number;
      usages: number;
    }[];
  } | null | undefined;
  syncCredits: () => void;
  isSyncing: boolean;
}) {
  if (isLicensePending) {
    return <Skeleton className="w-10 h-10" />;
  }

  const isProductTab = tab === 'Products';
  const creditsToShow = isProductTab
    ? licenseData?.local_credits?.filter(
        (credit) => credit.feature_slug === 'product'
      ) || []
    : licenseData?.local_credits?.filter(
        (credit) =>
          credit.feature_slug &&
          credit.feature_slug.includes('data')
      ) || [];

  return (
    <div className="flex gap-2 justify-center items-center text-sm">
      {creditsToShow.map((credit, i: number) => {
        const spent = credit.usages ?? 0;
        const total = credit.credits ?? 1;
        const isUnlimited = Number(credit.credits) === -1;
        return (
          <div key={i} className="min-w-[80px]">
            <span className="flex gap-1 items-center text-xs leading-none">
              {isProductTab ? 'Trained Products' : 'Trained Sources'}: {isUnlimited ? `${spent}/∞` : `${spent}/${total}`}
              <button
                className="p-0.5 text-gray-400 hover:text-primary-600 disabled:opacity-50"
                title="Sync Credits"
                onClick={() => syncCredits()}
                disabled={isSyncing}
                style={{ lineHeight: 0, cursor: 'pointer' }}
              >
                <RefreshCw
                  className={
                    isSyncing
                      ? 'w-3 h-3 animate-spin'
                      : 'w-3 h-3 text-primary'
                  }
                />
              </button>
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function DataSourceContent() {
  // All hooks must be called at the top level in the same order every time
  const { licenseQuery, syncCreditsMutation } = useLicense();
  const { getSourcesMutation } = useDataSource();
  const { isWooCommerceInstalled } = useWooCommerce();
  const [tab, setTab] = useState('Start Here');
  const [hasGeneralContent, setHasGeneralContent] = useState(false);
  const {
    isConsentDialogOpen,
    setIsConsentDialogOpen,
    pendingTrainingAction,
    setPendingTrainingAction,
  } = useConsent();

  // Extract data from queries after all hooks are called
  const { data: licenseData, isPending: isLicensePending } = licenseQuery;
  const { mutate: syncCredits, isPending: isSyncing } = syncCreditsMutation;

  // Move useMemo after all other hooks
  const MENU_ITEMS = useMemo<MenuItem[]>(() => {
    const baseItems: MenuItem[] = [
      {
        title: 'Start Here',
        status: true,
      },
    ];

    if (isWooCommerceInstalled) {
      baseItems.push({
        title: 'Products',
        status: hasGeneralContent,
      });
    }

    baseItems.push(
      {
        title: 'WP Posts',
        status: hasGeneralContent,
      },
      {
        title: 'Text',
        status: hasGeneralContent,
      },
      {
        title: 'Url',
        status: hasGeneralContent,
      },
      {
        title: 'Q&A',
        status: hasGeneralContent,
      },
      {
        title: 'File',
        status: hasGeneralContent,
      }
    );

    return baseItems;
  }, [hasGeneralContent, isWooCommerceInstalled]);

  // Check if general data source has content
  useEffect(() => {
    getSourcesMutation.mutate('general', {
      onSuccess: (data) => {
        const hasContent = Boolean(
          data &&
          data.length > 0 &&
          data[0].content &&
          data[0].content.trim().length > 0
        );
        setHasGeneralContent(hasContent);
      },
      onError: () => {
        setHasGeneralContent(false);
      },
    });
  }, []);

  // Listen to general data changes from the mutation
  useEffect(() => {
    if (getSourcesMutation.data) {
      const data = getSourcesMutation.data;
      const hasContent = Boolean(
        data &&
        data.length > 0 &&
        data[0].content &&
        data[0].content.trim().length > 0
      );
      setHasGeneralContent(hasContent);
    }
  }, []);

  // Handle tab change with validation
  const handleTabChange = (newTab: string) => {
    // Allow "Start Here" tab always
    if (newTab === 'Start Here') {
      setTab(newTab);
      return;
    }

    // Only allow other tabs if general content exists
    if (hasGeneralContent) {
      setTab(newTab);
    }
  };

  return (
    <>
      <Tabs className="gap-0" value={tab} onValueChange={handleTabChange}>
        <PageHeader
          menuItems={MENU_ITEMS}
          title="Train Chatbot"
          rightActions={
            <RightActions
              isLicensePending={isLicensePending}
              tab={tab}
              licenseData={licenseData}
              syncCredits={syncCredits}
              isSyncing={isSyncing}
            />
          }
        />
        <TabsContent value={tab} className="p-6">
          <Suspense fallback={<PageSkeleton />}>
            {tab === 'Start Here' && <TabGeneral setHasGeneralContent={setHasGeneralContent} />}
            {isWooCommerceInstalled && tab === 'Products' && <TabProducts />}
            {tab === 'WP Posts' && <TabPost />}
            {tab === 'Text' && <TabText />}
            {tab === 'Url' && <TabUrl />}
            {tab === 'Q&A' && <TabQnA />}
            {tab === 'File' && <TabFile />}
          </Suspense>
        </TabsContent>
      </Tabs>

      <OptInDialog
        open={isConsentDialogOpen}
        onOpenChange={setIsConsentDialogOpen}
        onConsent={() => {
          if (pendingTrainingAction) {
            pendingTrainingAction();
            setPendingTrainingAction(null);
          }
        }}
      />
    </>
  );
}
