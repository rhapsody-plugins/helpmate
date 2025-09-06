import PageHeader from '@/components/PageHeader';
import PageSkeleton from '@/components/PageSkeleton';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { OptInDialog } from '@/components/OptInDialog';
import { useLicense } from '@/hooks/useLicense';
import { useDataSource } from '@/hooks/useDataSource';
import { HelpmateLoginURL, HelpmatePricingURL } from '@/lib/constants';
import { MenuItem } from '@/types';
import { RefreshCw } from 'lucide-react';
import { Suspense, lazy, useMemo, useState, useEffect } from 'react';
import { useConsent } from '@/contexts/ConsentContext';

// Lazy load tab components
const TabText = lazy(() => import('@/pages/data-source/tabs/TabText'));
const TabUrl = lazy(() => import('@/pages/data-source/tabs/TabUrl'));
const TabPost = lazy(() => import('@/pages/data-source/tabs/TabPost'));
const TabQnA = lazy(() => import('@/pages/data-source/tabs/TabQnA'));
const TabFile = lazy(() => import('@/pages/data-source/tabs/TabFile'));
const TabGeneral = lazy(() => import('@/pages/data-source/tabs/TabGeneral'));

export function DataSourceContent() {
  const { licenseQuery, syncCreditsMutation } = useLicense();
  const { getSourcesMutation } = useDataSource();
  const [tab, setTab] = useState('Start Here');
  const [hasGeneralContent, setHasGeneralContent] = useState(false);
  const {
    isConsentDialogOpen,
    setIsConsentDialogOpen,
    pendingTrainingAction,
    setPendingTrainingAction,
  } = useConsent();

  const { data: licenseData, isPending: isLicensePending } = licenseQuery;
  const { mutate: syncCredits, isPending: isSyncing } = syncCreditsMutation;

  const MENU_ITEMS = useMemo<MenuItem[]>(
    () => [
      {
        title: 'Start Here',
        status: true,
      },
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
      },
    ],
    [hasGeneralContent]
  );

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
            <>
              {isLicensePending ? (
                <Skeleton className="w-10 h-10" />
              ) : (
                (() => {
                  return (
                    <div className="flex gap-2 justify-center items-center text-sm">
                      {licenseData?.local_credits
                        .filter(
                          (credit) =>
                            credit.feature_slug &&
                            credit.feature_slug.includes('data')
                        )
                        .map((credit, i) => {
                          const spent = credit.usages ?? 0;
                          const total = credit.credits ?? 1;
                          return (
                            <div key={i} className="min-w-[80px]">
                              <span className="flex gap-1 items-center text-xs leading-none">
                                Trained Sources: {spent}/{total}
                                <button
                                  className="p-0.5 text-gray-400 hover:text-primary-600 disabled:opacity-50"
                                  title="Sync Credits"
                                  onClick={() => syncCredits()}
                                  disabled={isSyncing}
                                  style={{ lineHeight: 0 }}
                                >
                                  <RefreshCw
                                    className={
                                      isSyncing
                                        ? 'w-3 h-3 animate-spin'
                                        : 'w-3 h-3'
                                    }
                                  />
                                </button>
                              </span>
                            </div>
                          );
                        })}
                      <Button
                        size="xs"
                        className="rounded-full bg-secondary-600 hover:bg-secondary-600/90"
                        onClick={() => {
                          window.open(
                            licenseData?.product_slug !== 'helpmate-free'
                              ? HelpmateLoginURL
                              : HelpmatePricingURL,
                            '_blank'
                          );
                        }}
                      >
                        {licenseData?.product_slug !== 'helpmate-free'
                          ? 'Upgrade'
                          : 'Automate Support Now'}
                      </Button>
                    </div>
                  );
                })()
              )}
            </>
          }
        />
        <TabsContent value={tab} className="p-6">
          <Suspense fallback={<PageSkeleton />}>
            {tab === 'Start Here' && <TabGeneral setHasGeneralContent={setHasGeneralContent} />}
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
