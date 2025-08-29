import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useLicense } from '@/hooks/useLicense';
import { HelpmatePricingURL, HelpmateSignupURL, HelpmateURL } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Icon } from '@iconify/react';
import { CrownIcon, HandCoins } from 'lucide-react';
import { useEffect, useState } from 'react';

// Simple SVG circular progress
function CircularProgress({ value, max }: { value: number; max: number }) {
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
    </svg>
  );
}

export default function License({
  setPage,
}: {
  setPage: (page: string) => void;
}) {
  const {
    licenseQuery,
    syncCreditsMutation,
    activateLicenseMutation,
    claimCreditsMutation,
  } = useLicense();
  const [licenseKey, setLicenseKey] = useState('');

  const { data: licenseData, isPending: isLicensePending } = licenseQuery;
  const { mutate: syncCredits, isPending: isFeatureUsagePending } =
    syncCreditsMutation;
  const { mutate: activateLicense, isPending: isActivateLicensePending } =
    activateLicenseMutation;

  useEffect(() => {
    setLicenseKey(licenseData?.license_key || '');
  }, [licenseData]);

  // Format license key to show only last 4 digits
  const formatLicenseKey = (key: string) => {
    if (!key || key.length < 4) return key;
    const lastFour = key.slice(-4);
    return `xxxx-xxxx-xxxx-${lastFour}`;
  };

  // Get first credit type for the circular progress (or fallback)
  const mainCredit = licenseData?.local_credits;

  return (
    <div className="min-h-[30vh] flex flex-col justify-between">
      <Card className="py-0 mx-auto w-full">
        <CardContent className="p-8">
          <div
            className={cn(
              'grid grid-cols-1',
              licenseData?.product_slug === 'helpmate-free'
                ? 'md:grid-cols-2'
                : 'md:grid-cols-1'
            )}
          >
            {/* Left column */}
            <div
              className={cn(
                'flex flex-col gap-6 justify-between pr-8 h-full ',
                licenseData?.product_slug === 'helpmate-free'
                  ? 'border-r border-gray-200 max-md:border-none'
                  : 'border-none'
              )}
            >
              <div>
                <div className="mb-4">
                  <h3 className="mb-2 text-lg font-medium">License Key</h3>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      value={formatLicenseKey(licenseKey)}
                      onChange={(e) => setLicenseKey(e.target.value)}
                      className="!border-input !rounded-md focus-visible:!border-ring focus-visible:!ring-ring/50 focus-visible:!ring-[3px]"
                    />
                    <Button
                      onClick={() => activateLicense(licenseKey)}
                      disabled={isActivateLicensePending}
                      className="bg-green-500 hover:bg-green-600"
                    >
                      {isActivateLicensePending
                        ? 'Activating...'
                        : licenseData?.license_key
                        ? 'Change License'
                        : 'Activate License'}
                    </Button>
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    License type: {licenseData?.product_slug.toUpperCase()}
                  </div>
                </div>
                <div>
                  <h3 className="mb-2 text-lg font-medium">Credit Usage</h3>
                  <div className="flex gap-4 items-center">
                    {isFeatureUsagePending ||
                    isLicensePending ||
                    isActivateLicensePending ? (
                      <p>Loading credits...</p>
                    ) : mainCredit ? (
                      mainCredit
                        .filter(
                          (credit) => credit.feature_slug !== 'max_tokens'
                        )
                        .map((credit) => (
                          <div
                            className="flex flex-col items-center"
                            key={credit.feature_slug}
                          >
                            <div className="p-2 bg-gray-100 rounded-xl">
                              <CircularProgress
                                value={credit.usages}
                                max={credit.credits}
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
              <div className="flex justify-between items-center">
                {licenseData?.last_sync && (
                  <div className="text-sm text-muted-foreground">
                    Last synced:{' '}
                    {new Date(licenseData.last_sync * 1000).toLocaleString()}
                  </div>
                )}
                <Button size="sm" onClick={() => syncCredits()}>
                  Sync Credits
                </Button>
              </div>
            </div>
            {/* Right column */}
            {licenseData?.product_slug === 'helpmate-free' && (
                <>
                  <div className="flex flex-col justify-center items-center h-full text-center divide-y divide-gray-200">
                    {!licenseData?.signup_credits ? (
                      <div className="flex flex-col flex-1 justify-center items-center p-8 w-full">
                        <h2 className="mb-4 !text-2xl font-semibold !text-muted-foreground max-w-sm">
                          Get 200 Free Chat Credits Just for Signing Up – It's
                          That Simple!
                        </h2>
                        <Button
                          size="lg"
                          onClick={() =>
                            window.open(
                              `${HelpmateSignupURL}?customer_id=${licenseData?.customer_id}&license_key=${licenseData?.license_key}`,
                              '_blank'
                            )
                          }
                        >
                          Claim My Free Credits <HandCoins className="!w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col flex-1 justify-center items-center p-8 w-full">
                        <h3 className="mb-4 !text-xl !font-medium !text-muted-foreground max-w-sm">
                          Increase your sales by upgrading to a Pro Plan.
                        </h3>
                        <Button
                          size="lg"
                          onClick={() =>
                            window.open(
                              HelpmatePricingURL,
                              '_blank'
                            )
                          }
                        >
                          Upgrade to Pro <CrownIcon className="!w-3" />
                        </Button>
                      </div>
                    )}
                    {!licenseData?.social_credits && (
                      <div className="flex flex-col flex-1 justify-center items-center p-8 w-full">
                        <h3 className="mb-4 !text-xl !font-medium !text-muted-foreground max-w-sm">
                          You Help Us Grow, We Reward You: 100 Credits for
                          Sharing
                        </h3>
                        <div className="flex gap-2">
                          <Button
                            variant="secondary"
                            size="icon"
                            onClick={() => {
                              claimCreditsMutation.mutate();
                              window.open(
                                `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(HelpmateURL)}`,
                                '_blank'
                              );
                            }}
                          >
                            <Icon icon="simple-icons:facebook" />
                          </Button>
                          <Button
                            variant="secondary"
                            size="icon"
                            onClick={() => {
                              claimCreditsMutation.mutate();
                              window.open(
                                `https://twitter.com/intent/tweet?url=${encodeURIComponent(HelpmateURL)}&text=${encodeURIComponent('Check out this amazing WooCommerce AI chatbot plugin!')}`,
                                '_blank'
                              );
                            }}
                          >
                            <Icon icon="simple-icons:x" />
                          </Button>
                          <Button
                            variant="secondary"
                            size="icon"
                            onClick={() => {
                              claimCreditsMutation.mutate();
                              window.open(
                                `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(HelpmateURL)}`,
                                '_blank'
                              );
                            }}
                          >
                            <Icon icon="simple-icons:linkedin" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
          </div>
        </CardContent>
      </Card>
      <div className="mt-3">
        <Button variant="outline" className="" onClick={() => setPage('home')}>
          ← Go Back
        </Button>
      </div>
    </div>
  );
}
