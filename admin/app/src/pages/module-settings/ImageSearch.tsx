import PageHeader from '@/components/PageHeader';
import { ProBadge } from '@/components/ProBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useSettings } from '@/hooks/useSettings';
import { cn } from '@/lib/utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const formSchema = z.object({
  delete_after_search: z.boolean(),
});

type FormData = z.infer<typeof formSchema>;

export default function ImageSearch() {
  const { getSettingsMutation, updateSettingsMutation, getProQuery } =
    useSettings();

  const { mutate: getSettings, isPending: isFetching } = getSettingsMutation;
  const { mutate: updateSettings, isPending: isUpdating } =
    updateSettingsMutation;

  const form = useForm<FormData>({
    defaultValues: {
      delete_after_search: false,
    },
    resolver: zodResolver(formSchema),
  });

  /*
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │     Handlers                                                                │
  └─────────────────────────────────────────────────────────────────────────────┘
 */

  useEffect(() => {
    getSettings('image-search', {
      onSuccess: (data) => {
        form.reset(data);
      },
    });
  }, [getSettings, form]);

  const handleToggleChange = (value: boolean) => {
    form.setValue('delete_after_search', value);
    updateSettings({
      key: 'image-search',
      data: { delete_after_search: value },
    });
  };

  /*
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │     Renders                                                                 │
  └─────────────────────────────────────────────────────────────────────────────┘
 */
  return (
    <div className="gap-0">
      <PageHeader title="Image Search" />
      <div className="relative p-6">
        {!getProQuery.data && (
          <ProBadge
            topMessage="“I saw it, I want it.” Let customers upload a photo and find the exact product instantly."
            buttonText="Turn Photos into Purchases"
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
              Image Search{' '}
              <InfoTooltip message="Customers can upload an image to search for similar or exact products from your store. It’s perfect for mobile-first shoppers who use screenshots or photos to find products." />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form className="space-y-6">
                {isFetching ? (
                  <div className="grid grid-cols-3 gap-4 max-md:grid-cols-1">
                    <Skeleton className="w-full h-12" />
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-4 max-md:grid-cols-1">
                    <FormField
                      control={form.control}
                      name="delete_after_search"
                      render={({ field }) => (
                        <FormItem className="flex justify-between items-center p-2 rounded-md border border-input">
                          <FormLabel>Delete Image After Search</FormLabel>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={handleToggleChange}
                              disabled={isUpdating}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
