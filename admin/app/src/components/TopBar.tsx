import logo from '@/assets/helpmate-logo-bg-icon.svg';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useApi } from '@/hooks/useApi';
import {
  HelpmateDocsURL,
  HelpmateLoginURL,
  HelpmatePricingURL,
  HelpmateSupportURL,
} from '@/lib/constants';
import { ArrowUpRight, HandCoins, KeyRound, RefreshCw } from 'lucide-react';

interface TopBarProps {
  onPageChange: (page: string) => void;
  page: string;
}

export default function TopBar({ onPageChange, page }: TopBarProps) {
  const { apiKeyQuery, syncCreditsMutation } = useApi();
  const { data: apiKeyData } = apiKeyQuery;
  const { mutate: syncCredits, isPending: isSyncing } = syncCreditsMutation;

  const total_credits =
    apiKeyData?.local_credits
      ?.filter(
        (credit) =>
          (credit.feature_slug &&
            credit.feature_slug.includes('ai_response')) ||
          credit.feature_slug === 'extra_credits'
      )
      .reduce((acc, credit) => acc + Number(credit.credits), 0) ?? 0;

  const total_spent_credits =
    apiKeyData?.local_credits
      ?.filter(
        (credit) =>
          (credit.feature_slug &&
            credit.feature_slug.includes('ai_response')) ||
          credit.feature_slug === 'extra_credits'
      )
      .reduce((acc, credit) => acc + Number(credit.usages), 0) ?? 0;

  const percent = Math.min(
    100,
    Math.round((total_spent_credits / total_credits) * 100)
  );

  return (
    <Card className="p-3 mb-3 bg-primary-800">
      <div className="flex gap-2 justify-between items-center">
        <div className="flex gap-3 items-center">
          <h1 className="!text-2xl !font-normal !text-white !my-0 !py-0 !flex items-center gap-2">
            <img src={logo} alt="Helpmate" className="w-8 h-8" />
            Helpmate
          </h1>
          {apiKeyData?.api_key && page !== 'dashboard' && (
            <>
              <Separator orientation="vertical" className="!h-5" />
              <Button
                variant="outline"
                size="sm"
                className="px-2 py-1 h-6 text-gray-100 bg-transparent rounded-sm border-gray-100 hover:bg-primary hover:text-white hover:border-primary"
                onClick={() => onPageChange('manage-api')}
              >
                Manage Api Key <KeyRound className="!w-3" />
              </Button>
            </>
          )}
        </div>
        <div className="flex gap-3 items-center">
          <Button
            variant="link"
            size="sm"
            className="!p-0 h-auto text-white"
            onClick={() => {
              window.open(HelpmateSupportURL, '_blank');
            }}
          >
            Support <ArrowUpRight className="!w-3" />
          </Button>
          <Button
            variant="link"
            size="sm"
            className="!p-0 h-auto text-white"
            onClick={() => {
              window.open(HelpmateDocsURL, '_blank');
            }}
          >
            Docs <ArrowUpRight className="!w-3" />
          </Button>
          {apiKeyData?.api_key ? (
            <div className="flex gap-2 items-center px-2 py-1 bg-white rounded-sm">
              <div className="flex flex-col">
                <div className="mb-1 min-w-[80px]">
                  <div className="flex gap-1 items-center text-xs leading-none">
                    Monthly Usages: {total_spent_credits}/{total_credits}
                    <button
                      className="p-0.5 text-gray-400 hover:text-primary-600 disabled:opacity-50"
                      title="Sync Credits"
                      onClick={() => syncCredits()}
                      disabled={isSyncing}
                      style={{ lineHeight: 0 }}
                    >
                      <RefreshCw
                        className={
                          isSyncing ? 'w-3 h-3 animate-spin' : 'w-3 h-3'
                        }
                      />
                    </button>
                  </div>
                  <div className="mt-0.5 w-full h-1 bg-gray-200 rounded">
                    <div
                      className="h-1 rounded"
                      style={{
                        width: `${percent}%`,
                        background:
                          'linear-gradient(90deg, #3b82f6 0%, #9333ea 100%)',
                      }}
                    />
                  </div>
                </div>
              </div>
              <Button
                size="sm"
                className="py-1 h-auto !font-medium !text-xs -mr-0.5"
                onClick={() => {
                  if (apiKeyData?.product_slug !== 'helpmate-free') {
                    window.open(HelpmateLoginURL, '_blank');
                  } else {
                    window.open(HelpmatePricingURL, '_blank');
                  }
                }}
              >
                {apiKeyData?.product_slug &&
                apiKeyData?.product_slug !== 'helpmate-free'
                  ? 'Buy Credits'
                  : 'Start Automating My Store'}
                <HandCoins className="!w-3" />
              </Button>
            </div>
          ) : (
            <Button
              className="!font-medium"
              onClick={() => {
                if (
                  apiKeyData?.product_slug &&
                  apiKeyData?.product_slug !== 'helpmate-free'
                ) {
                  window.open(HelpmateLoginURL, '_blank');
                } else {
                  window.open(HelpmatePricingURL, '_blank');
                }
              }}
            >
              {apiKeyData?.product_slug &&
              apiKeyData?.product_slug !== 'helpmate-free'
                ? 'Buy Credits'
                : 'Start Automating My Store'}
              <HandCoins className="!w-3" />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
