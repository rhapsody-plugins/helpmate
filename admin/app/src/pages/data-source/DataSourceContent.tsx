import PageHeader from '@/components/PageHeader';
import PageSkeleton from '@/components/PageSkeleton';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { OptInDialog } from '@/components/OptInDialog';
import { useLicense } from '@/hooks/useLicense';
import { HelpmateLoginURL, HelpmatePricingURL } from '@/lib/constants';
import { MenuItem } from '@/types';
import { RefreshCw } from 'lucide-react';
import { Suspense, lazy, useMemo, useState } from 'react';
import { useConsent } from '@/contexts/ConsentContext';

// Lazy load tab components
const TabText = lazy(() => import('@/pages/data-source/tabs/TabText'));
const TabUrl = lazy(() => import('@/pages/data-source/tabs/TabUrl'));
const TabPost = lazy(() => import('@/pages/data-source/tabs/TabPost'));
const TabQnA = lazy(() => import('@/pages/data-source/tabs/TabQnA'));
const TabFile = lazy(() => import('@/pages/data-source/tabs/TabFile'));

export function DataSourceContent() {
  const { licenseQuery, syncCreditsMutation } = useLicense();
  const [tab, setTab] = useState('WP Post');
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
        title: 'WP Post',
        status: true,
      },
      {
        title: 'Text',
        status: true,
      },
      {
        title: 'Url',
        status: true,
      },
      {
        title: 'Q&A',
        status: true,
      },
      {
        title: 'File',
        status: true,
      },
    ],
    []
  );

  return (
    <>
      <Tabs className="gap-0" value={tab} onValueChange={setTab}>
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
                                Trained: {spent}/{total}
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
            {tab === 'WP Post' && <TabPost />}
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
