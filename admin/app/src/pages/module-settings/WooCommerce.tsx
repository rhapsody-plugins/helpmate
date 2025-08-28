import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useSettings } from '@/hooks/useSettings';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const formSchema = z.object({
  order_tracker: z.boolean(),
  coupon_delivery: z.boolean(),
});

type FormData = z.infer<typeof formSchema>;

export default function WooCommerce() {
  const { getSettingsMutation, updateSettingsMutation } = useSettings();

  const { mutate: getSettings, isPending: isFetching } = getSettingsMutation;
  const { mutate: updateSettings, isPending: isUpdating } =
    updateSettingsMutation;

  const form = useForm<FormData>({
    defaultValues: {
      order_tracker: false,
      coupon_delivery: false,
    },
    resolver: zodResolver(formSchema),
  });

  /*
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │     Handlers                                                                │
  └─────────────────────────────────────────────────────────────────────────────┘
 */

  useEffect(() => {
    getSettings('woocommerce', {
      onSuccess: (data) => {
        form.reset(data);
      },
    });
  }, [getSettings, form]);

  const handleSubmit = (data: FormData) => {
    updateSettings({ key: 'woocommerce', data });
  };

  /*
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │     Renders                                                                 │
  └─────────────────────────────────────────────────────────────────────────────┘
 */
  return (
    <div className="gap-0">
      <PageHeader title="WooCommerce" />
      <Card className="p-6">
        <CardHeader>
          <CardTitle className="text-xl font-bold">WooCommerce</CardTitle>
          <CardDescription>
            Settings for the WooCommerce module.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-6"
            >
              {isFetching ? (
                <Skeleton className="w-full h-10" />
              ) : (
                <>
                  <div className="grid grid-cols-3 max-md:grid-cols-1 gap-4">
                    <FormField
                      control={form.control}
                      name="order_tracker"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Enable Order Tracker</FormLabel>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="coupon_delivery"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Enable Coupon Delivery</FormLabel>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

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
  );
}
