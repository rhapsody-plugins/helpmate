import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useSettings } from '@/hooks/useSettings';
import { useWooCommerce } from '@/hooks/useWooCommerce';
import { cn } from '@/lib/utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

// Import template images
import template1 from '@/assets/templates/sales-notification-template-1.webp';
import template2 from '@/assets/templates/sales-notification-template-2.webp';
import template3 from '@/assets/templates/sales-notification-template-3.webp';
import { HelpmatePricingURL } from '@/lib/constants';

const formSchema = z.object({
  sales_notification: z.boolean().optional(),
  review: z.boolean().optional(),
  // email_subscription: z.boolean().optional(),
  download: z.boolean().optional(),
  // comment: z.boolean().optional(),
  // page_analytics: z.boolean().optional(),
  sales_notification_show_frequency: z
    .string()
    .min(1, { message: 'Frequency is required' }),
  sales_notification_hide_frequency: z
    .string()
    .min(1, { message: 'Frequency is required' }),
  sales_notification_template: z
    .string()
    .min(1, { message: 'Template is required' }),
});

type FormData = z.infer<typeof formSchema>;

export default function SalesNotifications() {
  const { getSettingsMutation, updateSettingsMutation, getProQuery } =
    useSettings();
  const { isWooCommerceInstalled, isLoading: isWooCommerceLoading } =
    useWooCommerce();
  // const icons = useCustomIcons(['woocommerce']);

  const { mutate: getSettings, isPending: isFetching } = getSettingsMutation;
  const { mutate: updateSettings, isPending: isUpdating } =
    updateSettingsMutation;

  const form = useForm<FormData>({
    defaultValues: {
      sales_notification: false,
      review: false,
      // email_subscription: false,
      download: false,
      // comment: false,
      // page_analytics: false,
      sales_notification_show_frequency: '0.08',
      sales_notification_hide_frequency: '0.08',
      sales_notification_template: '1',
    },
    resolver: zodResolver(formSchema),
  });

  /*
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │     Handlers                                                                │
  └─────────────────────────────────────────────────────────────────────────────┘
 */

  useEffect(() => {
    getSettings('sales_notifications', {
      onSuccess: (data) => {
        form.reset(data);
      },
    });
  }, [getSettings, form]);

  const handleSubmit = (data: FormData) => {
    updateSettings({ key: 'sales_notifications', data });
  };

  /*
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │     Renders                                                                 │
  └─────────────────────────────────────────────────────────────────────────────┘
 */
  return (
    <div className="gap-0">
      <PageHeader title="Sales Notifications" />
      <div className="relative p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex gap-1 items-center text-xl font-bold">
              Sales Notifications{' '}
              <InfoTooltip message="Display real-time sales activity like “Someone just purchased this” to create social proof. It helps to build urgency and trust by showing that others are buying the product. This feature requires WooCommerce plugin to be installed and activated." />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(handleSubmit)}
                className="space-y-6"
              >
                {isFetching || isWooCommerceLoading ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-6 max-md:grid-cols-1">
                      {/* <div className="flex flex-row justify-between items-center self-end p-2 h-9 rounded-md border border-input">
                        <Skeleton className="w-32 h-4" />
                        <Skeleton className="w-12 h-6" />
                      </div> */}
                      <div className="space-y-2">
                        <Skeleton className="w-24 h-4" />
                        <Skeleton className="w-full h-10" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Skeleton className="w-16 h-4" />
                      <div className="grid grid-cols-3 gap-4">
                        <Skeleton className="w-full h-32 rounded-lg" />
                        <Skeleton className="w-full h-32 rounded-lg" />
                        <Skeleton className="w-full h-32 rounded-lg" />
                      </div>
                    </div>

                    <Skeleton className="w-20 h-10" />
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-6 max-md:grid-cols-1">
                      {/* <FormField
                        control={form.control}
                        name="sales_notification"
                        render={({ field }) => (
                          <FormItem className="flex flex-row justify-between items-center self-end p-2 h-9 rounded-md border border-input">
                            <FormLabel>Turn on Order Notification</FormLabel>
                            <div className="flex gap-2 items-center">
                              {!isWooCommerceInstalled && icons['woocommerce'] && (
                                <div className="flex items-center">
                                  <div className="w-6 h-6">
                                    {icons['woocommerce']}
                                  </div>
                                  <InfoTooltip message="WooCommerce plugin is required to use Sales Notifications. Please install and activate WooCommerce first." />
                                </div>
                              )}
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  disabled={!isWooCommerceInstalled}
                                />
                              </FormControl>
                            </div>
                          </FormItem>
                        )}
                      /> */}

                      <FormField
                        control={form.control}
                        name="sales_notification_show_frequency"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Show Frequency</FormLabel>
                            <FormControl>
                              <Select
                                value={field.value}
                                onValueChange={field.onChange}
                                disabled={!isWooCommerceInstalled}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Select a frequency" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="0.08">
                                    5 Seconds
                                  </SelectItem>
                                  <SelectItem value="0.16">
                                    10 Seconds
                                  </SelectItem>
                                  <SelectItem value="0.5">
                                    30 Seconds
                                  </SelectItem>
                                  <SelectItem value="1">1 Minute</SelectItem>
                                  <SelectItem value="2">2 Minutes</SelectItem>
                                  <SelectItem value="5">5 Minutes</SelectItem>
                                  <SelectItem value="15">15 Minutes</SelectItem>
                                  <SelectItem value="30">30 Minutes</SelectItem>
                                  <SelectItem value="60">1 Hour</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="sales_notification_template"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Template</FormLabel>
                          <FormControl>
                            <div className="grid grid-cols-3 gap-4">
                              <div
                                className={cn(
                                  'relative cursor-pointer rounded-lg border transition-all hover:border-primary',
                                  field.value === '1'
                                    ? 'border-primary'
                                    : 'border-border/50',
                                  !isWooCommerceInstalled
                                    ? 'opacity-50 cursor-not-allowed'
                                    : ''
                                )}
                                onClick={() =>
                                  isWooCommerceInstalled && field.onChange('1')
                                }
                              >
                                <img
                                  src={template1}
                                  alt="Template 1"
                                  className="mt-3 -mb-20 w-full h-auto rounded-md"
                                />
                                <div className="flex absolute inset-0 justify-center items-center rounded-md opacity-0 transition-opacity bg-white/70 hover:opacity-100">
                                  <span className="text-lg font-semibold drop-shadow-lg">
                                    Template 1
                                  </span>
                                </div>
                              </div>

                              <div
                                className={cn(
                                  'relative cursor-pointer rounded-lg border transition-all',
                                  field.value === '2'
                                    ? 'border-primary'
                                    : 'border-border/50',
                                  !getProQuery.data || !isWooCommerceInstalled
                                    ? 'opacity-50'
                                    : 'hover:border-primary'
                                )}
                                onClick={() => {
                                  if (
                                    getProQuery.data &&
                                    isWooCommerceInstalled
                                  ) {
                                    field.onChange('2');
                                  }
                                  if (!getProQuery.data) {
                                    window.open(HelpmatePricingURL, '_blank');
                                  }
                                }}
                              >
                                <img
                                  src={template2}
                                  alt="Template 2"
                                  className="w-full h-auto rounded-md"
                                />
                                <div className="flex absolute inset-0 justify-center items-center rounded-md opacity-0 transition-opacity bg-white/70 hover:opacity-100">
                                  <span className="text-lg font-semibold drop-shadow-lg">
                                    Template 2{' '}
                                    {!getProQuery.data && '(Pro Only)'}
                                  </span>
                                </div>
                                {!getProQuery.data && (
                                  <div className="absolute top-2 right-2 px-2 py-1 text-xs text-white bg-orange-500 rounded">
                                    Pro Only
                                  </div>
                                )}
                              </div>

                              <div
                                className={cn(
                                  'relative cursor-pointer rounded-lg border transition-all',
                                  field.value === '3'
                                    ? 'border-primary'
                                    : 'border-border/50',
                                  !getProQuery.data || !isWooCommerceInstalled
                                    ? 'opacity-50'
                                    : 'hover:border-primary'
                                )}
                                onClick={() => {
                                  if (
                                    getProQuery.data &&
                                    isWooCommerceInstalled
                                  ) {
                                    field.onChange('3');
                                  }
                                  if (!getProQuery.data) {
                                    window.open(HelpmatePricingURL, '_blank');
                                  }
                                }}
                              >
                                <img
                                  src={template3}
                                  alt="Template 3"
                                  className="mt-3 -mb-20 w-full h-auto rounded-md"
                                />
                                <div className="flex absolute inset-0 justify-center items-center rounded-md opacity-0 transition-opacity bg-white/70 hover:opacity-100">
                                  <span className="text-lg font-semibold drop-shadow-lg">
                                    Template 3{' '}
                                    {!getProQuery.data && '(Pro Only)'}
                                  </span>
                                </div>
                                {!getProQuery.data && (
                                  <div className="absolute top-2 right-2 px-2 py-1 text-xs text-white bg-orange-500 rounded">
                                    Pro Only
                                  </div>
                                )}
                              </div>
                            </div>
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <Button
                      type="submit"
                      disabled={isUpdating || !isWooCommerceInstalled}
                      loading={isUpdating}
                    >
                      {isUpdating ? 'Saving...' : 'Save'}
                    </Button>
                  </>
                )}
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
