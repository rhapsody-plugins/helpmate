import PageHeader from '@/components/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
} from '@/components/ui/chart';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useDashboard } from '@/hooks/useDashboard';
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  CircleDollarSign,
  HandCoins,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
} from 'recharts';

// Types
type DateFilter =
  | 'today'
  | 'yesterday'
  | 'last_week'
  | 'last_month'
  | 'last_year';

// Skeleton Components
const StatCardSkeleton = () => (
  <Card className="p-0 h-full">
    <div className="px-6 py-[26px] h-full flex gap-3 justify-between items-center">
      <div className="flex flex-col flex-1 justify-center h-full">
        <Skeleton className="mb-2 w-20 h-4" />
        <div className="flex flex-col gap-2">
          <Skeleton className="w-24 h-8" />
          <Skeleton className="w-16 h-4" />
        </div>
      </div>
      <Skeleton className="w-8 h-8 rounded-full" />
    </div>
  </Card>
);

const MetricCardSkeleton = () => (
  <Card className="p-0 h-full">
    <div className="flex flex-col justify-between p-6 h-full">
      <Skeleton className="w-16 h-4" />
      <Skeleton className="w-20 h-8" />
      <Skeleton className="w-24 h-4" />
    </div>
  </Card>
);

const OrdersCardSkeleton = () => (
  <Card className="p-0 h-full bg-primary/10">
    <div className="flex flex-col gap-2 justify-between p-6 h-full">
      <div className="flex flex-col gap-1">
        <Skeleton className="w-24 h-4" />
        <div className="flex gap-1 justify-between items-center">
          <Skeleton className="w-16 h-8" />
          <Skeleton className="w-16 h-6" />
        </div>
      </div>
      <Separator />
      <div className="flex flex-col gap-1">
        <Skeleton className="w-32 h-4" />
        <div className="flex gap-1 justify-between items-center">
          <Skeleton className="w-16 h-8" />
          <Skeleton className="w-16 h-6" />
        </div>
      </div>
      <Separator />
      <div className="flex flex-col gap-1">
        <Skeleton className="w-28 h-4" />
        <div className="flex gap-1 justify-between items-center">
          <Skeleton className="w-16 h-8" />
          <Skeleton className="w-16 h-6" />
        </div>
      </div>
    </div>
  </Card>
);

const ChartCardSkeleton = () => (
  <Card className="p-0 h-full">
    <div className="p-6 h-full">
      <Skeleton className="mb-4 w-32 h-4" />
      <div className="flex flex-col h-[calc(100%-24px)]">
        <div className="flex flex-col justify-center items-center h-full text-muted-foreground">
          <Skeleton className="mb-2 w-8 h-8 rounded" />
          <Skeleton className="w-48 h-4" />
        </div>
      </div>
    </div>
  </Card>
);

// Components
const StatCard = ({
  title,
  value,
  change,
  icon: Icon,
  iconColor,
  bgColor,
  formatValue = (v: number) => v.toFixed(2),
  suffix = '',
}: {
  title: string;
  value: number;
  change: number;
  icon?: React.ElementType;
  iconColor?: string;
  bgColor?: string;
  formatValue?: (v: number) => string;
  suffix?: string;
}) => (
  <Card className={`p-0 ${bgColor || ''} h-full`}>
    <div className="px-6 py-[26px] h-full flex gap-3 justify-between items-center">
      <div className="flex flex-col justify-center h-full">
        <h5 className="!text-sm !font-normal !my-0 !py-0">{title}</h5>
        <div className="flex flex-col">
          <span className="!text-2xl !font-semibold">
            {formatValue(value)}
            {suffix}
          </span>
          <span className="!text-sm !font-normal !my-0 !py-0 !text-muted-foreground">
            {formatPercentage(change)}
          </span>
        </div>
      </div>
      {Icon && <Icon size={30} strokeWidth={1.5} className={iconColor} />}
    </div>
  </Card>
);

const MetricCard = ({
  value,
  change,
  subtitle,
}: {
  title: string;
  value: number;
  change: number;
  subtitle: string;
}) => (
  <Card className="p-0 h-full">
    <div className="flex flex-col justify-between p-6 h-full">
      <div className="flex gap-1 items-center text-sm text-muted-foreground">
        {formatPercentage(change)}
        {change > 0 ? (
          <ArrowUp size={16} className="inline-block text-green-500" />
        ) : change < 0 ? (
          <ArrowDown size={16} className="inline-block text-red-500" />
        ) : null}
      </div>
      <span className="!text-2xl !font-semibold">{value}</span>
      <h5 className="!text-sm !font-normal !my-0 !py-0">{subtitle}</h5>
    </div>
  </Card>
);

const chartConfig = {
  revenue: {
    label: 'Revenue',
    color: 'hsl(var(--chart-1))',
  },
} satisfies ChartConfig;

// Helper functions
const formatPercentage = (value: number) => {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
};

const getBadgeVariant = (value: number) => {
  if (value > 0) return 'secondary';
  if (value < 0) return 'destructive';
  return 'default';
};

export default function Analytics() {
  const { getDashboardDataMutation } = useDashboard();
  const { mutate: getDashboardData, data, isPending } = getDashboardDataMutation;
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');

  useEffect(() => {
    getDashboardData({ date_filter: dateFilter });
  }, [dateFilter]);

  // Transform revenue data for the chart
  const chartData = useMemo(() => {
    if (!data?.revenue?.chart_data) return [];

    return Object.entries(data.revenue.chart_data).map(([date, revenue]) => ({
      date,
      revenue: Number(revenue),
    }));
  }, [data?.revenue?.chart_data]);

  return (
    <div className="gap-0">
      <PageHeader title="Analytics" />
      <div className="p-6">
        <div className="flex gap-2 justify-between items-center">
          <h1 className="!text-2xl !font-bold !my-0 !py-0 !mb-3">
            Welcome Admin
          </h1>
          <div className="flex gap-2 items-center">
            <Select
              value={dateFilter}
              onValueChange={(value) => setDateFilter(value as DateFilter)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a date" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="last_week">Last Week</SelectItem>
                <SelectItem value="last_month">Last Month</SelectItem>
                <SelectItem value="last_year">Last Year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Orders Section */}
        <div className="grid grid-cols-4 gap-4 items-end mt-2 max-md:grid-cols-1">
          <div className="flex flex-col h-full">
            <h4 className="!text-sm !font-bold !my-0 !py-0 !mb-2">Orders</h4>
            {isPending ? (
              <OrdersCardSkeleton />
            ) : (
              <Card className="p-0 h-full bg-primary/10">
                <div className="flex flex-col gap-2 justify-between p-6 h-full">
                  <div className="flex flex-col gap-1">
                    <h5 className="!text-sm !font-normal !my-0 !py-0">
                      Total Orders
                    </h5>
                    <div className="flex gap-1 justify-between items-center">
                      <span className="!text-2xl !font-semibold">
                        {data?.orders?.total_orders || 0}
                      </span>
                      <Badge
                        variant={getBadgeVariant(
                          data?.orders?.comparison?.orders_change || 0
                        )}
                      >
                        {formatPercentage(
                          data?.orders?.comparison?.orders_change || 0
                        )}
                      </Badge>
                    </div>
                  </div>
                  <Separator />
                  <div className="flex flex-col gap-1">
                    <h5 className="!text-sm !font-normal !my-0 !py-0">
                      Total Chat Sessions
                    </h5>
                    <div className="flex gap-1 justify-between items-center">
                      <span className="!text-2xl !font-semibold">
                        {data?.orders?.total_chat_sessions || 0}
                      </span>
                      <Badge
                        variant={getBadgeVariant(
                          data?.orders?.comparison?.sessions_change || 0
                        )}
                      >
                        {formatPercentage(
                          data?.orders?.comparison?.sessions_change || 0
                        )}
                      </Badge>
                    </div>
                  </div>
                  <Separator />
                  <div className="flex flex-col gap-1">
                    <h5 className="!text-sm !font-normal !my-0 !py-0">
                      Conversion Rate
                    </h5>
                    <div className="flex gap-1 justify-between items-center">
                      <span className="!text-2xl !font-semibold">
                        {data?.orders?.conversion_rate?.toFixed(2) || '0.00'}%
                      </span>
                      <Badge
                        variant={getBadgeVariant(
                          data?.orders?.comparison?.conversion_change || 0
                        )}
                      >
                        {formatPercentage(
                          data?.orders?.comparison?.conversion_change || 0
                        )}
                      </Badge>
                    </div>
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* Sales Section */}
          <div className="flex flex-col col-span-3">
            <h4 className="!text-sm !font-bold !my-0 !py-0 !mb-2">Sales</h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-4">
                {isPending ? (
                  <>
                    <StatCardSkeleton />
                    <StatCardSkeleton />
                  </>
                ) : (
                  <>
                    <StatCard
                      title="ROI"
                      value={data?.sales?.roi || 0}
                      change={data?.sales?.comparison?.roi_change || 0}
                      icon={CircleDollarSign}
                      iconColor="text-red-500"
                      bgColor="bg-red-50"
                      suffix="%"
                    />
                    <StatCard
                      title="AOV"
                      value={data?.sales?.aov || 0}
                      change={data?.sales?.comparison?.aov_change || 0}
                      icon={HandCoins}
                      iconColor="text-green-500"
                      bgColor="bg-green-50"
                    />
                  </>
                )}
              </div>
              <div className="col-span-2">
                {isPending ? (
                  <ChartCardSkeleton />
                ) : (
                  <Card className="p-0 h-full">
                    <div className="p-6 h-full">
                      <h5 className="!text-sm !font-normal !my-0 !py-0">
                        Total Revenue
                      </h5>
                      <div className="flex flex-col h-[calc(100%-24px)]">
                        {chartData.length > 0 ? (
                          <ChartContainer config={chartConfig}>
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart
                                data={chartData}
                                margin={{
                                  left: 12,
                                  right: 12,
                                  top: 12,
                                  bottom: 12,
                                }}
                              >
                                <CartesianGrid
                                  vertical={false}
                                  strokeDasharray="3 3"
                                />
                                <XAxis
                                  dataKey="date"
                                  tickLine={false}
                                  axisLine={false}
                                  tickMargin={8}
                                  tickFormatter={(value) => value.slice(5)}
                                />
                                <ChartTooltip
                                  cursor={false}
                                  content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                      const value = payload[0].value as number;
                                      return (
                                        <div className="p-2 rounded-lg border shadow-sm bg-background">
                                          <div className="grid grid-cols-2 gap-2">
                                            <div className="flex flex-col">
                                              <span className="text-[0.70rem] uppercase text-muted-foreground">
                                                {payload[0].payload.date}
                                              </span>
                                              <span className="font-bold text-muted-foreground">
                                                ${value.toFixed(2)}
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    }
                                    return null;
                                  }}
                                />
                                <defs>
                                  <linearGradient
                                    id="fillRevenue"
                                    x1="0"
                                    y1="0"
                                    x2="0"
                                    y2="1"
                                  >
                                    <stop
                                      offset="5%"
                                      stopColor="var(--color-primary)"
                                      stopOpacity={0.2}
                                    />
                                    <stop
                                      offset="95%"
                                      stopColor="var(--color-primary)"
                                      stopOpacity={0}
                                    />
                                  </linearGradient>
                                </defs>
                                <Area
                                  dataKey="revenue"
                                  type="monotone"
                                  fill="url(#fillRevenue)"
                                  fillOpacity={0.4}
                                  stroke="var(--color-primary)"
                                  strokeWidth={2}
                                />
                              </AreaChart>
                            </ResponsiveContainer>
                          </ChartContainer>
                        ) : (
                          <div className="flex flex-col justify-center items-center h-full text-muted-foreground">
                            <BarChart3 className="mb-2 w-8 h-8" />
                            <p className="text-sm">No revenue data available</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Statistics Section */}
        <div className="flex flex-col mt-6">
          <h4 className="!text-sm !font-bold !my-0 !py-0 !mb-2">Statistics</h4>
          <div className="grid grid-cols-4 gap-4">
            {isPending ? (
              <>
                <MetricCardSkeleton />
                <MetricCardSkeleton />
                <MetricCardSkeleton />
                <MetricCardSkeleton />
              </>
            ) : (
              <>
                <MetricCard
                  title="Total Tickets"
                  value={data?.statistics?.total_tickets || 0}
                  change={data?.statistics?.comparison?.tickets_change || 0}
                  subtitle="Total Tickets"
                />
                <MetricCard
                  title="Total Leads"
                  value={data?.statistics?.total_leads || 0}
                  change={data?.statistics?.comparison?.leads_change || 0}
                  subtitle="Total Leads"
                />
                <MetricCard
                  title="Avg Messages/Session"
                  value={data?.statistics?.avg_messages_per_session || 0}
                  change={data?.statistics?.comparison?.avg_messages_change || 0}
                  subtitle="Avg Messages/Session"
                />
                <MetricCard
                  title="Avg Resolution Time"
                  value={data?.statistics?.avg_resolution_time || 0}
                  change={data?.statistics?.comparison?.resolution_time_change || 0}
                  subtitle="Avg Resolution Time (h)"
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
