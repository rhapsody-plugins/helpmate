import PageHeader from '@/components/PageHeader';
import PageGuard from '@/components/PageGuard';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
} from '@/components/ui/chart';
import { useDashboard } from '@/hooks/useDashboard';
import { useSocialChat, SocialAnalytics } from '@/hooks/useSocialChat';
import { useCrmAnalytics } from '@/hooks/useCrmAnalytics';
import { usePermissions } from '@/hooks/usePermissions';
import { TeamMember, useTeam } from '@/hooks/useTeam';
import { useReviews } from '@/hooks/useReviews';
import { CrmAnalyticsData, DateFilter } from '@/types/crm-analytics';
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  CircleDollarSign,
  HandCoins,
  MessageSquare,
  Star,
  Users,
  TrendingUp,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
} from 'recharts';
import TasksReport from '@/components/crm/analytics/TasksReport';
import ContactsReport from '@/components/crm/analytics/ContactsReport';
import LeadsReport from '@/components/crm/analytics/LeadsReport';
import TicketsReport from '@/components/crm/analytics/TicketsReport';
import TeamPerformanceReport from '@/components/crm/analytics/TeamPerformanceReport';
import ActivityTimeline from '@/components/crm/analytics/ActivityTimeline';

// Helper functions
const formatPercentage = (value: number) => {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
};

// Convert date filter to social chat format
const convertDateFilterToSocialFormat = (
  dateFilter: DateFilter
): string => {
  switch (dateFilter) {
    case 'today':
      return '1d';
    case 'yesterday':
      return '2d';
    case 'last_week':
      return '7d';
    case 'last_month':
      return '30d';
    case 'last_year':
      return '365d';
    default:
      return '30d';
  }
};

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

// Overview Components
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
  value: string | number;
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

interface DashboardData {
  revenue: {
    total: number;
    chart_data: Record<string, number>;
    comparison: {
      revenue_change: number;
    };
  };
  orders: {
    total_orders: number;
    total_chat_sessions: number;
    conversion_rate: number;
    comparison: {
      orders_change: number;
      sessions_change: number;
      conversion_change: number;
    };
  };
  sales: {
    roi: number;
    aov: number;
    comparison: {
      roi_change: number;
      aov_change: number;
    };
  };
  statistics: {
    total_tickets: number;
    total_leads: number;
    avg_messages_per_session: number;
    avg_resolution_time: number;
    comparison: {
      tickets_change: number;
      leads_change: number;
      avg_messages_change: number;
      resolution_time_change: number;
    };
  };
};

// Overview Tab Component
function OverviewTab({
  chatbotData,
  socialData,
  crmData,
  isLoading,
  dateFilter,
}: {
  chatbotData: DashboardData | undefined;
  socialData: SocialAnalytics | undefined;
  crmData: CrmAnalyticsData | undefined;
  isLoading: boolean;
  dateFilter: DateFilter;
}) {
  const { useReviewAnalytics } = useReviews();
  const { data: reviewData, isPending: reviewsLoading } = useReviewAnalytics(dateFilter);
  const chartData = useMemo(() => {
    if (!chatbotData?.revenue?.chart_data) return [];
    return Object.entries(chatbotData.revenue.chart_data).map(
      ([date, revenue]) => ({
        date,
        revenue: Number(revenue),
      })
    );
  }, [chatbotData?.revenue?.chart_data]);

  return (
    <div className="space-y-6">
      {/* Key Metrics Overview */}
      <div>
        <h4 className="!text-sm !font-bold !my-0 !py-0 !mb-4">Overview</h4>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {isLoading ? (
            <>
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </>
          ) : (
            <>
              <StatCard
                title="Total Revenue"
                value={chatbotData?.revenue?.total || 0}
                change={chatbotData?.revenue?.comparison?.revenue_change || 0}
                icon={CircleDollarSign}
                iconColor="text-green-500"
                bgColor="bg-green-50"
                formatValue={(v) => `$${v.toFixed(2)}`}
              />
              <StatCard
                title="Total Messages"
                value={
                  (socialData?.total_messages_inbound || 0) +
                  (socialData?.total_messages_outbound || 0)
                }
                change={0}
                icon={MessageSquare}
                iconColor="text-blue-500"
                bgColor="bg-blue-50"
              />
              <StatCard
                title="Total Contacts"
                value={crmData?.contacts?.total || 0}
                change={crmData?.contacts?.comparison?.created_change || 0}
                icon={Users}
                iconColor="text-purple-500"
                bgColor="bg-purple-50"
              />
              <StatCard
                title="Total Orders"
                value={chatbotData?.orders?.total_orders || 0}
                change={chatbotData?.orders?.comparison?.orders_change || 0}
                icon={TrendingUp}
                iconColor="text-orange-500"
                bgColor="bg-orange-50"
              />
              <StatCard
                title="Average Rating"
                value={reviewData?.average_rating || 0}
                change={0}
                icon={Star}
                iconColor="text-yellow-500"
                bgColor="bg-yellow-50"
                formatValue={(v) => v > 0 ? `${v.toFixed(1)}/5` : 'N/A'}
              />
              <StatCard
                title="Total Reviews"
                value={reviewData?.total_reviews || 0}
                change={0}
                icon={MessageSquare}
                iconColor="text-indigo-500"
                bgColor="bg-indigo-50"
              />
            </>
          )}
        </div>
      </div>

      {/* Reviews Section */}
      <div>
        <h4 className="!text-sm !font-bold !my-0 !py-0 !mb-4">Reviews</h4>
        {reviewsLoading ? (
          <Card className="p-0 h-full">
            <div className="p-6 h-full">
              <Skeleton className="mb-4 w-32 h-4" />
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="w-full h-16" />
                ))}
              </div>
            </div>
          </Card>
        ) : reviewData && reviewData.reviews_list.length > 0 ? (
          <Card className="p-0 h-full">
            <div className="p-6 h-full">
              <div className="space-y-4">
                {reviewData.reviews_list.map((review) => (
                  <div
                    key={review.id}
                    className="flex justify-between items-start p-4 rounded-lg border"
                  >
                    <div className="flex-1">
                      <div className="flex gap-2 items-center mb-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            size={16}
                            className={
                              star <= review.rating
                                ? 'fill-yellow-400 text-yellow-400'
                                : 'fill-gray-200 text-gray-200'
                            }
                          />
                        ))}
                        <span className="text-sm font-medium">
                          {review.rating}/5
                        </span>
                      </div>
                      {review.message && (
                        <p className="mb-2 text-sm text-muted-foreground">
                          {review.message}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {new Date(review.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        ) : (
          <Card className="p-0 h-full">
            <div className="p-6 h-full text-center text-muted-foreground">
              No reviews found for this period
            </div>
          </Card>
        )}
      </div>

      {/* Revenue Chart */}
      <div>
        <h4 className="!text-sm !font-bold !my-0 !py-0 !mb-4">
          Revenue Overview
        </h4>
        {isLoading ? (
          <Card className="p-0 h-full">
            <div className="p-6 h-full">
              <Skeleton className="mb-4 w-32 h-4" />
              <Skeleton className="w-full h-64" />
            </div>
          </Card>
        ) : (
          <Card className="p-0 h-full">
            <div className="p-6 h-full">
              <h5 className="!text-sm !font-normal !my-0 !py-0 mb-4">
                Total Revenue
              </h5>
              <div className="h-64">
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

      {/* Additional Metrics */}
      <div>
        <h4 className="!text-sm !font-bold !my-0 !py-0 !mb-4">
          Performance Metrics
        </h4>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {isLoading ? (
            <>
              <MetricCardSkeleton />
              <MetricCardSkeleton />
              <MetricCardSkeleton />
              <MetricCardSkeleton />
            </>
          ) : (
            <>
              <MetricCard
                value={chatbotData?.orders?.conversion_rate?.toFixed(2) || '0.00'}
                change={chatbotData?.orders?.comparison?.conversion_change || 0}
                subtitle="Conversion Rate (%)"
              />
              <MetricCard
                value={chatbotData?.statistics?.avg_messages_per_session || 0}
                change={
                  chatbotData?.statistics?.comparison?.avg_messages_change || 0
                }
                subtitle="Avg Messages/Session"
              />
              <MetricCard
                value={socialData?.handoff_rate?.toFixed(2) || '0.00'}
                change={0}
                subtitle="Handoff Rate (%)"
              />
              <MetricCard
                value={crmData?.tasks?.completion_rate?.toFixed(2) || '0.00'}
                change={
                  crmData?.tasks?.comparison?.completion_rate_change || 0
                }
                subtitle="Task Completion Rate (%)"
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// By Source Tab Component
function BySourceTab({
  chatbotData,
  socialData,
  crmData,
  isLoading,
  isAdmin,
}: {
  chatbotData: DashboardData | undefined;
  socialData: SocialAnalytics | undefined;
  crmData: CrmAnalyticsData | undefined;
  isLoading: boolean;
  isAdmin: boolean;
}) {
  const chartData = useMemo(() => {
    if (!chatbotData?.revenue?.chart_data) return [];
    return Object.entries(chatbotData.revenue.chart_data).map(
      ([date, revenue]) => ({
        date,
        revenue: Number(revenue),
      })
    );
  }, [chatbotData?.revenue?.chart_data]);

  return (
    <div className="space-y-8">
      {/* Chatbot Analytics Section */}
      <div>
        <h4 className="!text-lg !font-bold !my-0 !py-0 !mb-4">
          Chatbot Analytics
        </h4>
        <div className="space-y-4">
          {/* Orders & Conversion Metrics */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              value={chatbotData?.orders?.total_orders || 0}
              change={chatbotData?.orders?.comparison?.orders_change || 0}
              subtitle="Total Orders"
            />
            <MetricCard
              value={chatbotData?.orders?.total_chat_sessions || 0}
              change={chatbotData?.orders?.comparison?.sessions_change || 0}
              subtitle="Chat Sessions"
            />
            <MetricCard
              value={`${chatbotData?.orders?.conversion_rate?.toFixed(2) || '0.00'}%`}
              change={chatbotData?.orders?.comparison?.conversion_change || 0}
              subtitle="Conversion Rate"
            />
          </div>

          {/* Sales & Revenue Metrics */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <StatCard
              title="Total Revenue"
              value={chatbotData?.revenue?.total || 0}
              change={chatbotData?.revenue?.comparison?.revenue_change || 0}
              icon={CircleDollarSign}
              iconColor="text-green-500"
              bgColor="bg-green-50"
              formatValue={(v) => `$${v.toFixed(2)}`}
            />
            <StatCard
              title="ROI"
              value={chatbotData?.sales?.roi || 0}
              change={chatbotData?.sales?.comparison?.roi_change || 0}
              icon={CircleDollarSign}
              iconColor="text-blue-500"
              bgColor="bg-blue-50"
              suffix="%"
            />
            <StatCard
              title="AOV"
              value={chatbotData?.sales?.aov || 0}
              change={chatbotData?.sales?.comparison?.aov_change || 0}
              icon={HandCoins}
              iconColor="text-purple-500"
              bgColor="bg-purple-50"
              formatValue={(v) => `$${v.toFixed(2)}`}
            />
          </div>

          {/* Revenue Chart */}
          {chartData.length > 0 && (
            <Card className="p-0">
              <div className="p-6">
                <h5 className="!text-sm !font-semibold !my-0 !py-0 mb-4">
                  Revenue Over Time
                </h5>
                <div className="h-64">
                  <ChartContainer config={chartConfig}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
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
                                  <span className="font-bold">
                                    ${value.toFixed(2)}
                                  </span>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <defs>
                          <linearGradient
                            id="fillRevenueChart"
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
                          fill="url(#fillRevenueChart)"
                          fillOpacity={0.4}
                          stroke="var(--color-primary)"
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </div>
              </div>
            </Card>
          )}

          {/* Statistics */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              value={chatbotData?.statistics?.total_tickets || 0}
              change={chatbotData?.statistics?.comparison?.tickets_change || 0}
              subtitle="Total Tickets"
            />
            <MetricCard
              value={chatbotData?.statistics?.total_leads || 0}
              change={chatbotData?.statistics?.comparison?.leads_change || 0}
              subtitle="Total Leads"
            />
            <MetricCard
              value={chatbotData?.statistics?.avg_messages_per_session || 0}
              change={
                chatbotData?.statistics?.comparison?.avg_messages_change || 0
              }
              subtitle="Avg Messages/Session"
            />
            <MetricCard
              value={chatbotData?.statistics?.avg_resolution_time || 0}
              change={
                chatbotData?.statistics?.comparison?.resolution_time_change || 0
              }
              subtitle="Avg Resolution Time (h)"
            />
          </div>
        </div>
      </div>

      {/* Social & Live Chat Analytics Section */}
      <div>
        <h4 className="!text-lg !font-bold !my-0 !py-0 !mb-4">
          Social & Live Chat Analytics
        </h4>
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card className="p-0 h-full">
              <div className="p-6">
                <h5 className="!text-sm !font-normal !my-0 !py-0 mb-4">
                  Messages
                </h5>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Inbound Messages
                    </p>
                    <p className="text-2xl font-semibold">
                      {socialData?.total_messages_inbound || 0}
                    </p>
                  </div>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Outbound Messages
                    </p>
                    <p className="text-2xl font-semibold">
                      {socialData?.total_messages_outbound || 0}
                    </p>
                  </div>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground">Total</p>
                    <p className="text-2xl font-semibold">
                      {(socialData?.total_messages_inbound || 0) +
                        (socialData?.total_messages_outbound || 0)}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
            <Card className="p-0 h-full">
              <div className="p-6">
                <h5 className="!text-sm !font-normal !my-0 !py-0 mb-4">
                  Response Types
                </h5>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground">AI Responses</p>
                    <p className="text-2xl font-semibold">
                      {socialData?.ai_responses || 0}
                    </p>
                  </div>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Human Responses
                    </p>
                    <p className="text-2xl font-semibold">
                      {socialData?.human_responses || 0}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
            <Card className="p-0 h-full">
              <div className="p-6">
                <h5 className="!text-sm !font-normal !my-0 !py-0 mb-4">
                  Conversations
                </h5>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Total</p>
                    <p className="text-2xl font-semibold">
                      {socialData?.total_conversations || 0}
                    </p>
                  </div>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground">Handoffs</p>
                    <p className="text-2xl font-semibold">
                      {socialData?.handoff_conversations || 0}
                    </p>
                  </div>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground">Handoff Rate</p>
                    <p className="text-2xl font-semibold">
                      {socialData?.handoff_rate?.toFixed(2) || '0.00'}%
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* CRM Analytics Section */}
      <div>
        <h4 className="!text-lg !font-bold !my-0 !py-0 !mb-4">
          CRM Analytics
        </h4>
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="p-0 h-full">
                <div className="p-6">
                  <Skeleton className="mb-4 w-32 h-4" />
                  <Skeleton className="w-full h-32" />
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {crmData?.tasks && <TasksReport data={crmData.tasks} />}
            {crmData?.contacts && (
              <ContactsReport data={{
                ...crmData.contacts,
                emails_sent: crmData.emails?.sent
              }} />
            )}
            {crmData?.leads && <LeadsReport data={crmData.leads} />}
            {crmData?.tickets && (
              <TicketsReport data={crmData.tickets} />
            )}
            {isAdmin && crmData?.team_performance && (
              <div className="md:col-span-2 lg:col-span-2">
                <TeamPerformanceReport data={crmData.team_performance} />
              </div>
            )}
            {crmData?.activity_timeline && (
              <div className="col-span-full">
                <ActivityTimeline data={crmData.activity_timeline} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// By Team Tab Component (Admin Only)
function ByTeamTab({
  chatbotData,
  socialData,
  crmData,
  isLoading,
  selectedUserId,
  onUserChange,
  teamMembers,
}: {
  chatbotData: DashboardData | undefined;
  socialData: SocialAnalytics | undefined;
  crmData: CrmAnalyticsData | undefined;
  isLoading: boolean;
  selectedUserId: number | null;
  onUserChange: (userId: number | null) => void;
  teamMembers: TeamMember[];
}) {
  return (
    <div className="space-y-6">
      {/* Team Member Selector */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h4 className="!text-sm !font-bold !my-0 !py-0">
            Filter by Team Member
          </h4>
          <Select
            value={selectedUserId?.toString() || 'all'}
            onValueChange={(value) =>
              onUserChange(value === 'all' ? null : parseInt(value, 10))
            }
          >
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Select team member" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Teams</SelectItem>
              {teamMembers.map((member) => (
                <SelectItem
                  key={member.user_id}
                  value={member.user_id.toString()}
                >
                  {member.user?.display_name || member.user?.email || 'Unknown'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          {selectedUserId
            ? `Showing analytics for selected team member. Orders, Revenue, and some social metrics remain system-wide.`
            : `Showing system-wide analytics for all teams.`}
        </p>
      </div>

      {/* Display filtered analytics - reuse By Source tab structure */}
      <BySourceTab
        chatbotData={chatbotData}
        socialData={socialData}
        crmData={crmData}
        isLoading={isLoading}
        isAdmin={true}
      />
    </div>
  );
}

export default function Analytics() {
  const { hasRole } = usePermissions();
  const { useTeamMembers } = useTeam();
  const isAdmin = hasRole('admin');
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Get current user ID for team members
  const { useUserPermissions } = useTeam();
  const { data: userPermissions } = useUserPermissions();
  const currentUserId = userPermissions?.user_id || null;

  // Fetch team members for admin
  const { data: teamMembers = [] } = useTeamMembers();

  // Fetch analytics data
  const { getDashboardDataMutation } = useDashboard();
  const { mutate: getDashboardData, data: chatbotData, isPending: chatbotLoading } = getDashboardDataMutation;
  const { useAnalytics: useSocialAnalytics } = useSocialChat();
  const socialDateFilter = convertDateFilterToSocialFormat(dateFilter);
  const { useCrmAnalytics: useCrmAnalyticsQuery } = useCrmAnalytics();

  // For team members, always filter by their own user_id
  // For admins: only filter when on "by-team" tab and a user is selected
  const crmUserId = isAdmin
    ? activeTab === 'by-team' ? selectedUserId : null
    : currentUserId;

  // Chatbot analytics user filtering (same logic as CRM)
  const chatbotUserId = isAdmin
    ? activeTab === 'by-team' ? selectedUserId : null
    : currentUserId;

  // Social analytics user filtering (same logic as CRM)
  const socialUserId = isAdmin
    ? activeTab === 'by-team' ? selectedUserId : null
    : currentUserId;

  const { data: socialData, isPending: socialLoading } = useSocialAnalytics(socialDateFilter, socialUserId);
  const { data: crmData, isPending: crmLoading } = useCrmAnalyticsQuery(dateFilter, crmUserId);

  const isLoading = chatbotLoading || socialLoading || crmLoading;

  useEffect(() => {
    getDashboardData({
      date_filter: dateFilter,
      user_id: chatbotUserId || undefined
    });
  }, [dateFilter, chatbotUserId, getDashboardData]);

  // Reset selected user when switching tabs away from By Team
  useEffect(() => {
    if (activeTab !== 'by-team') {
      setSelectedUserId(null);
    }
  }, [activeTab]);

  return (
    <PageGuard page="control-center-analytics">
      <div className="gap-0">
        <PageHeader title="Analytics" />
        <div className="p-6">
          <div className="flex gap-2 justify-between items-center mb-6">
            <h1 className="!text-2xl !font-bold !my-0 !py-0">Analytics</h1>
            <div className="flex gap-2 items-center">
              <Select
                value={dateFilter}
                onValueChange={(value) => setDateFilter(value as DateFilter)}
              >
                <SelectTrigger className="w-[180px]">
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

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="by-source">By Source</TabsTrigger>
              {isAdmin && <TabsTrigger value="by-team">By Team</TabsTrigger>}
            </TabsList>

            <TabsContent value="overview" className="mt-6">
              <OverviewTab
                chatbotData={chatbotData}
                socialData={socialData}
                crmData={crmData}
                isLoading={isLoading}
                dateFilter={dateFilter}
              />
            </TabsContent>

            <TabsContent value="by-source" className="mt-6">
              <BySourceTab
                chatbotData={chatbotData}
                socialData={socialData}
                crmData={crmData}
                isLoading={isLoading}
                isAdmin={isAdmin}
              />
            </TabsContent>

            {isAdmin && (
              <TabsContent value="by-team" className="mt-6">
                <ByTeamTab
                  chatbotData={chatbotData}
                  socialData={socialData}
                  crmData={crmData}
                  isLoading={isLoading}
                  selectedUserId={selectedUserId}
                  onUserChange={setSelectedUserId}
                  teamMembers={teamMembers}
                />
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>
    </PageGuard>
  );
}
