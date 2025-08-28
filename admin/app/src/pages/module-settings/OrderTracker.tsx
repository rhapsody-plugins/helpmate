import PageHeader from '@/components/PageHeader';
import { ProBadge } from '@/components/ProBadge';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Skeleton } from '@/components/ui/skeleton';
import { useSettings } from '@/hooks/useSettings';
import { cn } from '@/lib/utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const formSchema = z.object({
  order_tracker_email_required: z.boolean(),
  order_tracker_phone_required: z.boolean(),
});

type FormData = z.infer<typeof formSchema>;

export default function WooCommerce() {
  const { getSettingsMutation, updateSettingsMutation, getProQuery } =
    useSettings();

  const { mutate: getSettings, isPending: isFetching } = getSettingsMutation;
  const { mutate: updateSettings, isPending: isUpdating } =
    updateSettingsMutation;

  const form = useForm<FormData>({
    defaultValues: {
      order_tracker_email_required: false,
      order_tracker_phone_required: false,
    },
    resolver: zodResolver(formSchema),
  });

  /*
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │     Handlers                                                                │
  └─────────────────────────────────────────────────────────────────────────────┘
 */

  useEffect(() => {
    getSettings('order_tracker', {
      onSuccess: (data) => {
        form.reset(data);
      },
    });
  }, [getSettings, form]);

  const handleSubmit = (data: FormData) => {
    updateSettings({ key: 'order_tracker', data });
  };

  /*
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │     Renders                                                                 │
  └─────────────────────────────────────────────────────────────────────────────┘
 */
  return (
    <div className="gap-0">
      <PageHeader title="Order Tracker" />
      <div className="relative p-6">
        {!getProQuery.data && (
          <ProBadge
            topMessage="Give them answers before they ask. Real-time order tracking reduces refunds and raises trust."
            buttonText="Make Shipping Transparent"
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
            <CardTitle className="flex gap-1 items-center text-xl font-bold">
              Order Tracker{' '}
              <InfoTooltip message="Customers can track their orders in real-time using email, phone number, or order ID, right from the chat window. It reduces customer anxiety and the feature enhances transparency, which helps build trust and loyalty." />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(handleSubmit)}
                className="space-y-6"
              >
                {isFetching ? (
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <Skeleton className="w-32 h-4" />
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Skeleton className="w-4 h-4 rounded-full" />
                          <Skeleton className="w-24 h-4" />
                        </div>
                        <div className="flex items-center space-x-2">
                          <Skeleton className="w-4 h-4 rounded-full" />
                          <Skeleton className="w-24 h-4" />
                        </div>
                      </div>
                    </div>
                    <Skeleton className="w-20 h-10" />
                  </div>
                ) : (
                  <>
                    <FormField
                      control={form.control}
                      name="order_tracker_email_required"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Required Field</FormLabel>
                          <FormControl>
                            <RadioGroup
                              onValueChange={(value) => {
                                form.setValue(
                                  'order_tracker_email_required',
                                  value === 'email'
                                );
                                form.setValue(
                                  'order_tracker_phone_required',
                                  value === 'phone'
                                );
                              }}
                              value={
                                field.value
                                  ? 'email'
                                  : form.getValues(
                                      'order_tracker_phone_required'
                                    )
                                  ? 'phone'
                                  : 'email'
                              }
                              className="flex flex-col space-y-1"
                            >
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem
                                  value="email"
                                  id="email-required"
                                />
                                <label htmlFor="email-required">
                                  Email Required
                                </label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem
                                  value="phone"
                                  id="phone-required"
                                />
                                <label htmlFor="phone-required">
                                  Phone Required
                                </label>
                              </div>
                            </RadioGroup>
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <Button
                      type="submit"
                      disabled={isUpdating}
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
