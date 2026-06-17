import { ApiKeyChangeConfirmationDialog } from '@/components/ApiKeyChangeConfirmationDialog';
import PageGuard from '@/components/PageGuard';
import PageHeader from '@/components/PageHeader';
import { ProBadge } from '@/components/ProBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { Input } from '@/components/ui/input';
import { ApiKeyActivationResponse, useApi } from '@/hooks/useApi';
import { useSettings } from '@/hooks/useSettings';
import {
  HelpmateLoginURL,
  HelpmatePricingURL,
  HelpmateSignupURL,
  OpenAIApiKeysURL,
  OpenAIBillingURL,
} from '@/lib/constants';
import { __, cn, sprintf } from '@/lib/utils';
import { Eye, EyeOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

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

export default function ManageApi() {
  const { getProQuery } = useSettings();
  const { data: isPro } = getProQuery;
  const {
    apiKeyQuery,
    syncCreditsMutation,
    activateApiKeyMutation,
    saveOpenAiKeyMutation,
    deleteOpenAiKeyMutation,
    openAiKeyQuery,
  } = useApi();
  const [apiKey, setApiKey] = useState('');
  const [openAiKey, setOpenAiKey] = useState('');
  const [showConfirmationDialog, setShowConfirmationDialog] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showOpenAiKey, setShowOpenAiKey] = useState(false);

  const { data: apiKeyData, isPending: isApiKeyPending } = apiKeyQuery;
  const { data: openAiKeyData } = openAiKeyQuery;
  const { mutate: syncCredits, isPending: isFeatureUsagePending } =
    syncCreditsMutation;
  const { mutate: activateApiKey, isPending: isActivateApiKeyPending } =
    activateApiKeyMutation;
  const { mutate: saveOpenAiKey, isPending: isSavingOpenAiKey } =
    saveOpenAiKeyMutation;
  const { mutate: deleteOpenAiKey, isPending: isDeletingOpenAiKey } =
    deleteOpenAiKeyMutation;

  useEffect(() => {
    setApiKey(apiKeyData?.api_key || '');
  }, [apiKeyData]);

  useEffect(() => {
    // Don't set the masked key, just check if one exists
    if (openAiKeyData?.openai_key) {
      // Key exists but we don't want to show the masked version in the input
      setOpenAiKey('');
    } else {
      setOpenAiKey('');
    }
  }, [openAiKeyData]);

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

  const handleActivateSuccess = (data: ApiKeyActivationResponse) => {
    const documents = data.documents;
    if (!documents) {
      return;
    }
    if (documents.imported > 0) {
      toast.success(
        sprintf(__('%d documents synced from your license.'), documents.imported)
      );
    } else if (documents.action === 'synced_all' && !documents.error) {
      toast.info(
        __(
          'API key changed. No trained documents were found for this license in the cloud.'
        )
      );
    }
  };

  const handleApiKeyChange = () => {
    if (apiKeyData?.api_key) {
      // Show confirmation dialog for existing api key
      setShowConfirmationDialog(true);
    } else {
      // Direct activation for new api key
      activateApiKey(apiKey, { onSuccess: handleActivateSuccess });
    }
  };

  const handleConfirmApiKeyChange = () => {
    activateApiKey(apiKey, { onSuccess: handleActivateSuccess });
  };

  const handleSaveOpenAiKey = () => {
    if (!openAiKey.trim()) {
      toast.error(__('Please enter an OpenAI API key'));
      return;
    }
    saveOpenAiKey(openAiKey, {
      onSuccess: () => {
        setOpenAiKey('');
        openAiKeyQuery.refetch();
      },
    });
  };

  const formatOpenAiKey = (key: string | null) => {
    if (!key) return '';
    // Key is already masked from backend (e.g., "sk-1234...")
    return key;
  };

  return (
    <PageGuard page="manage-api" requiredRole="admin">
      <div className="gap-0">
        <PageHeader title={__('Manage API Key')} />
        <div className="p-6">
          {!apiKeyData?.api_key ? (
            <div>{__('Please activate your API key to continue.')}</div>
          ) : (
            <Card className="py-0 mx-auto w-full">
              <CardContent className="p-8">
                <div
                  className={cn(
                    'flex flex-col gap-8 justify-between h-full lg:[flex-direction:row]'
                  )}
                >
                  <div className="flex-1">
                    <div className="mb-4">
                      <div className="flex gap-2 items-center mb-2">
                        <h3 className="text-lg font-medium !my-0">
                          {__('Helpmate API Key')}
                        </h3>
                        <InfoTooltip
                          message={`${__('Get This Key From RhapsodyPlugins')} <a href="${HelpmateLoginURL}" target="_blank">${__('My Account Dashboard')}</a>.`}
                        />
                      </div>
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
                            ? __('Activating...')
                            : apiKeyData?.api_key
                              ? __('Change Api Key')
                              : __('Activate Api Key')}
                        </Button>
                      </div>
                      <div className="mt-2 text-sm text-muted-foreground">
                        {__('API Key Type')}: <Badge variant="outline">{apiKeyData?.product_slug.toUpperCase()}</Badge>
                      </div>
                    </div>
                    <div>
                      <h3 className="mb-2 text-lg font-medium">{__('Credit Usage')}</h3>
                      <div className="flex gap-4 items-center">
                        {isFeatureUsagePending ||
                          isApiKeyPending ||
                          isActivateApiKeyPending ? (
                          <p>{__('Loading credits...')}</p>
                        ) : mainCredit ? (
                          mainCredit
                            .filter(
                              (credit) =>
                                !(
                                  credit.feature_slug === 'extra_credits' &&
                                  Number(credit.credits) === 0 &&
                                  Number(credit.usages) === 0
                                )
                            )
                            .map((credit) => (
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
                          <p>{__('No credits available')}</p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 lg:border-l lg:pl-8">
                    <div className="relative mb-4">
                      {!isPro && (
                        <ProBadge
                          topMessage={__('Unlimited Chat Usage (via Your OpenAI API Key)')}
                          buttonText={__('Enable Unlimited Chats')}
                          tooltipMessage={null}
                        />
                      )}
                      <div
                        className={cn(
                          !isPro &&
                          'opacity-15 cursor-not-allowed pointer-events-none'
                        )}
                      >
                        <h3 className="mb-2 text-lg font-medium !mt-0">
                          {__('OpenAI API Key')}
                        </h3>
                        <p className="mb-3 text-sm text-muted-foreground">
                          {__('Add your own OpenAI API key to use when your credits are exhausted. This is optional.')}
                        </p>
                        <div className="mb-3 space-y-2 text-sm text-muted-foreground">
                          <p>
                            <strong>{__('Get your API key:')}</strong>{' '}
                            <a
                              href={OpenAIApiKeysURL}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary underline hover:no-underline"
                            >
                              {__('OpenAI API keys')}
                            </a>{' '}
                            — {__('sign in at platform.openai.com → API keys →')}
                            {__('Create new secret key.')}
                          </p>
                          <p>
                            <strong>{__('Add credit/balance:')}</strong> {__('You must add credit in your OpenAI account for the API to work without issues:')}
                            <a
                              href={OpenAIBillingURL}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary underline hover:no-underline"
                            >
                              {__('Billing')}
                            </a>
                            .
                          </p>
                          <p>
                            {__('This uses the OpenAI API (pay-as-you-go), not a ChatGPT Plus subscription.')}
                          </p>
                        </div>
                        {openAiKeyData?.openai_key && (
                          <div className="flex flex-wrap gap-2 items-center mb-3">
                            <div className="p-2 text-sm bg-gray-50 rounded-md text-muted-foreground">
                              {__('Current key')}
                              : {formatOpenAiKey(openAiKeyData.openai_key)}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              disabled={isDeletingOpenAiKey}
                              onClick={() => {
                                if (
                                  confirm(
                                    __('Remove your saved OpenAI API key? You can add it again later.')
                                  )
                                ) {
                                  deleteOpenAiKey();
                                }
                              }}
                            >
                              {isDeletingOpenAiKey ? __('Removing...') : __('Delete key')}
                            </Button>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Input
                              type={showOpenAiKey ? 'text' : 'password'}
                              value={openAiKey}
                              onChange={(e) => setOpenAiKey(e.target.value)}
                              placeholder="sk-..."
                              className="!border-input !rounded-md focus-visible:!border-ring focus-visible:!ring-ring/50 focus-visible:!ring-[3px] pr-10"
                              disabled={!isPro}
                            />
                            <button
                              type="button"
                              onClick={() => setShowOpenAiKey(!showOpenAiKey)}
                              className="absolute right-3 top-1/2 text-gray-500 transition-colors -translate-y-1/2 hover:text-gray-700"
                              disabled={!isPro}
                            >
                              {showOpenAiKey ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                          <Button
                            onClick={handleSaveOpenAiKey}
                            disabled={
                              isSavingOpenAiKey || !openAiKey.trim() || !isPro
                            }
                            className="bg-blue-500 hover:bg-blue-600"
                          >
                            {isSavingOpenAiKey
                              ? __('Saving...')
                              : openAiKeyData?.openai_key
                                ? __('Update Key')
                                : __('Save Key')}
                          </Button>
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          {__('Your key will be encrypted and stored securely. It will only be used when your license credits are exhausted.')}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex justify-between items-center pt-6 mt-6 border-t">
                  {apiKeyData?.last_sync && (
                    <div className="text-sm text-muted-foreground">
                      {__('Last synced:')}{' '}
                      {new Date(apiKeyData.last_sync * 1000).toLocaleString()}
                    </div>
                  )}
                  <Button size="sm" onClick={() => syncCredits()}>
                    {__('Sync Credits')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

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
    </PageGuard>
  );
}
