import { ApiKeyChangeConfirmationDialog } from '@/components/ApiKeyChangeConfirmationDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useApi } from '@/hooks/useApi';
import { useSettings } from '@/hooks/useSettings';
import { HelpmatePricingURL, HelpmateSignupURL } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Eye, EyeOff } from 'lucide-react';
import { useEffect, useState } from 'react';

// Simple SVG circular progress
function CircularProgress({
  value,
  max,
  isUnlimited = false,
}: {
  value: number;
  max: number;
  isUnlimited?: boolean;
}) {
  const radius = 80;
  const stroke = 4;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const percent = Math.min(value / max, 1);
  const strokeDashoffset = circumference - percent * circumference;
  return (
    <svg height={radius * 2} width={radius * 2}>
      <circle
        stroke="#e5e7eb"
        fill="transparent"
        strokeWidth={stroke}
        r={normalizedRadius}
        cx={radius}
        cy={radius}
      />
      {/* Progress circle - only show if not unlimited */}
      {!isUnlimited && (
        <circle
          stroke="#3b82f6"
          fill="transparent"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference + ' ' + circumference}
          style={{
            strokeDashoffset,
            transition: 'stroke-dashoffset 0.35s',
            transform: 'rotate(-90deg)',
            transformOrigin: '50% 50%',
          }}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
      )}
      {isUnlimited ? (
        <>
          <text
            x="50%"
            y="45%"
            textAnchor="middle"
            dy=".3em"
            fontSize="1.25rem"
            fill="#16a34a"
            fontWeight="bold"
          >
            {value}/∞
          </text>
          <text
            x="50%"
            y="60%"
            textAnchor="middle"
            dy=".3em"
            fontSize="0.75rem"
            fill="#6b7280"
          >
            Unlimited
          </text>
        </>
      ) : (
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dy=".3em"
          fontSize="1.25rem"
          fill="#3b82f6"
          fontWeight="bold"
        >
          {value}/{max}
        </text>
      )}
    </svg>
  );
}

export default function ManageApi({
  setPage,
}: {
  setPage: (page: string) => void;
}) {
  const { getProQuery } = useSettings();
  const { data: isPro } = getProQuery;
  const { apiKeyQuery, syncCreditsMutation, activateApiKeyMutation } = useApi();
  const [apiKey, setApiKey] = useState('');
  const [showConfirmationDialog, setShowConfirmationDialog] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  const { data: apiKeyData, isPending: isApiKeyPending } = apiKeyQuery;
  const { mutate: syncCredits, isPending: isFeatureUsagePending } =
    syncCreditsMutation;
  const { mutate: activateApiKey, isPending: isActivateApiKeyPending } =
    activateApiKeyMutation;

  useEffect(() => {
    setApiKey(apiKeyData?.api_key || '');
  }, [apiKeyData]);

  // Format api key to show only last 4 digits
  const formatApiKey = (key: string) => {
    if (!key || key.length < 6) return key;
    const lastSix = key.slice(-6);
    return `xxxxx-xxxxx-xxxxx-${lastSix}`;
  };

  // Get display value for the input
  const getDisplayValue = () => {
    if (showApiKey) {
      return apiKey;
    }
    return formatApiKey(apiKey);
  };

  // Get first credit type for the circular progress (or fallback)
  const mainCredit = apiKeyData?.local_credits;

  const handleApiKeyChange = () => {
    if (apiKeyData?.api_key) {
      // Show confirmation dialog for existing api key
      setShowConfirmationDialog(true);
    } else {
      // Direct activation for new api key
      activateApiKey(apiKey);
    }
  };

  const handleConfirmApiKeyChange = () => {
    activateApiKey(apiKey);
  };

  return (
    <div className="min-h-[30vh] flex flex-col justify-between">
      {!apiKeyData?.api_key ? (
        <div className="p-6">Please activate your API key to continue.</div>
      ) : (
        <>
          <Card className="py-0 mx-auto w-full">
            <CardContent className="p-8">
              <div className={cn('flex flex-col gap-6 justify-between h-full')}>
                <div>
                  <div className="mb-4">
                    <h3 className="mb-2 text-lg font-medium !mt-0">Api Key</h3>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          type="text"
                          value={getDisplayValue()}
                          onChange={(e) => setApiKey(e.target.value)}
                          className="!border-input !rounded-md focus-visible:!border-ring focus-visible:!ring-ring/50 focus-visible:!ring-[3px] pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute right-3 top-1/2 text-gray-500 transition-colors -translate-y-1/2 hover:text-gray-700"
                        >
                          {showApiKey ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                      <Button
                        onClick={handleApiKeyChange}
                        disabled={isActivateApiKeyPending}
                        className="bg-green-500 hover:bg-green-600"
                      >
                        {isActivateApiKeyPending
                          ? 'Activating...'
                          : apiKeyData?.api_key
                          ? 'Change Api Key'
                          : 'Activate Api Key'}
                      </Button>
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      Api key type: {apiKeyData?.product_slug.toUpperCase()}
                    </div>
                  </div>
                  <div>
                    <h3 className="mb-2 text-lg font-medium">Credit Usage</h3>
                    <div className="flex gap-4 items-center">
                      {isFeatureUsagePending ||
                      isApiKeyPending ||
                      isActivateApiKeyPending ? (
                        <p>Loading credits...</p>
                      ) : mainCredit ? (
                        mainCredit.map((credit) => (
                          <div
                            className="flex flex-col items-center"
                            key={credit.feature_slug}
                          >
                            <div className="p-2 bg-gray-100 rounded-xl">
                              <CircularProgress
                                value={credit.usages}
                                max={
                                  Number(credit.credits) === -1
                                    ? 1
                                    : credit.credits
                                }
                                isUnlimited={Number(credit.credits) === -1}
                              />
                            </div>
                            <span className="mt-1 text-xs capitalize text-muted-foreground">
                              {credit.feature_slug.replace(/_/g, ' ')}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p>No credits available</p>
                      )}
                    </div>
                  </div>
                </div>
                {isPro && (
                  <div className="flex justify-between items-center">
                    {apiKeyData?.last_sync && (
                      <div className="text-sm text-muted-foreground">
                        Last synced:{' '}
                        {new Date(apiKeyData.last_sync * 1000).toLocaleString()}
                      </div>
                    )}
                    <Button size="sm" onClick={() => syncCredits()}>
                      Sync Credits
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="mt-3">
            <Button
              variant="outline"
              className=""
              onClick={() => setPage('home')}
            >
              ← Go Back
            </Button>
          </div>
        </>
      )}

      <ApiKeyChangeConfirmationDialog
        open={showConfirmationDialog}
        onOpenChange={setShowConfirmationDialog}
        onConfirm={handleConfirmApiKeyChange}
        onUpgrade={() =>
          apiKeyData?.product_slug === 'helpmate-free'
            ? window.open(
                `${HelpmateSignupURL}?customer_id=${apiKeyData?.customer_id}&api_key=${apiKeyData?.api_key}`,
                '_blank'
              )
            : window.open(HelpmatePricingURL, '_blank')
        }
      />
    </div>
  );
}
