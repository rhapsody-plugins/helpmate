'use client';

import { useState } from 'react';
import { Copy, Check, Scissors } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CouponData } from '@/types';
import { useSettings } from '@/hooks/useSettings';
import LeadCollection from '@/components/LeadCollection';

interface CouponProps {
  data: CouponData;
}

export function Coupon({ data }: CouponProps) {
  const [copied, setCopied] = useState(false);
  const [collectLead, setCollectLead] = useState(false);
  const { getSettingsQuery } = useSettings();
  const { data: settings } = getSettingsQuery;
  const couponCollectLead = settings?.settings?.coupon_collect_lead;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(data.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  return (
    <div className="overflow-hidden my-3 rounded-lg border border-dashed border-slate-300">
      {!collectLead && couponCollectLead ? (
        <LeadCollection
          setCollectLead={setCollectLead}
          title="To get your coupon, please fill out the form below."
          variant="small"
          textColor="text-slate-800 !text-base font-normal text-left"
        />
      ) : (
        <>
          <div className="relative p-3 bg-slate-50">
            <div className="absolute top-3 right-3">
              <Scissors size={16} className="text-slate-400" />
            </div>

            <div className="flex flex-col items-center">
              <div className="mb-1 text-sm font-medium text-slate-500">
                Special Offer
              </div>
              <div
                className="text-2xl font-bold text-slate-800"
                dangerouslySetInnerHTML={{ __html: data.discount }}
              />
              <div className="mt-1 text-xs text-slate-500">
                Valid until {data.validUntil}
              </div>
            </div>
          </div>

          <div className="flex gap-2 justify-between items-center p-3 bg-white">
            <div className="font-mono text-sm font-bold tracking-wider text-slate-800">
              {data.code}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={copyToClipboard}
            >
              {copied ? (
                <>
                  <Check size={14} className="mr-1 text-green-600" /> Copied
                </>
              ) : (
                <>
                  <Copy size={14} className="mr-1" /> Copy Code
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
