import { MetricCard } from '@/components/MetricCard';
import { ProBadge } from '@/components/ProBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import useAbandonedCart from '@/hooks/useAbandonedCart';
import { useSettings } from '@/hooks/useSettings';
import { cn } from '@/lib/utils';
import {
  Clock,
  DollarSign,
  RotateCcw,
  Shovel,
  TrendingUp,
} from 'lucide-react';

export default function TabAnalytics() {
  const { getProQuery } = useSettings();
  const { getAnalytics } = useAbandonedCart();
  const { data: analytics } = getAnalytics;

  return (
    <div className="space-y-6">
      <div className="relative">
        {!getProQuery.data && (
          <ProBadge
            topMessage="You paid for the click. Don't lose the cart. Recover sales automatically."
            buttonText="Recover Lost Carts Now"
            tooltipMessage={null}
          />
        )}
        <Card
          className={cn(
            !getProQuery.data &&
              'opacity-50 cursor-not-allowed pointer-events-none'
          )}
        >
          <CardHeader>
            <CardTitle className="text-xl font-bold">
              Abandoned Cart Analytics{' '}
              <InfoTooltip message="Overview of abandoned cart performance and recovery metrics." />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                'grid grid-cols-4 gap-4',
                !getProQuery.data &&
                  'opacity-50 cursor-not-allowed pointer-events-none'
              )}
            >
              <MetricCard
                title="Total Abandoned"
                value={analytics?.total_abandoned_count || 0}
                subtitle="Abandoned Carts"
                className="bg-blue-50 border-blue-200"
                topRightIcon={<Shovel className="w-4 h-4" />}
              />
              <MetricCard
                title="Abandoned Value"
                value={`$${(analytics?.total_abandoned_amount || 0).toFixed(
                  2
                )}`}
                subtitle="Total Value"
                className="bg-green-50 border-green-200"
                topRightIcon={<DollarSign className="w-4 h-4" />}
              />
              <MetricCard
                title="Recovered Carts"
                value={analytics?.total_retrieved_count || 0}
                subtitle="Recovered Carts"
                className="bg-blue-50 border-blue-200"
                topRightIcon={<RotateCcw className="w-4 h-4" />}
              />
              <MetricCard
                title="Recovered Value"
                value={`$${(analytics?.total_retrieved_amount || 0).toFixed(
                  2
                )}`}
                subtitle="Total Value"
                className="bg-green-50 border-green-200"
                topRightIcon={<DollarSign className="w-4 h-4" />}
              />
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <MetricCard
                title="Recovery Rate"
                value={`${(analytics?.recovery_rate || 0).toFixed(2)}%`}
                subtitle="Cart Recovery Rate"
                icon={<TrendingUp strokeWidth={1} className="w-4 h-4" />}
                className="bg-green-50 border-green-200"
              />
              <MetricCard
                title="Avg Recovery Time"
                value={`${(analytics?.avg_recovery_time || 0).toFixed(2)}h`}
                subtitle="Average Time to Recovery"
                icon={<Clock strokeWidth={1} className="w-4 h-4" />}
                className="bg-blue-50 border-blue-200"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}