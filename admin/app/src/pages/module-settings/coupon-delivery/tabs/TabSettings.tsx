import { ProBadge } from '@/components/ProBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import useCoupons from '@/hooks/useCoupons';
import { useSettings } from '@/hooks/useSettings';
import { cn } from '@/lib/utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const formSchema = z.object({
  exit_intent_coupon: z.string().optional(),
  ask_ai_coupon: z.boolean(),
  specific_product_query_coupon: z.boolean(),
  coupon_collect_lead: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

export default function TabSettings() {
  const { getCouponsQuery } = useCoupons();
  const { getSettingsMutation, updateSettingsMutation, getProQuery } =
    useSettings();
  const {
    data: settings = { coupons: [] as number[] },
    mutate: getSettings,
    isPending: isFetchingSettings,
  } = getSettingsMutation;
  const { data: coupons } = getCouponsQuery;
  const { mutate: updateSettings, isPending: isUpdating } =
    updateSettingsMutation;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      exit_intent_coupon: '',
      ask_ai_coupon: false,
      specific_product_query_coupon: false,
      coupon_collect_lead: false,
    },
    disabled: !getProQuery.data,
  });

  useEffect(() => {
    getSettings('coupons', {
      onSuccess: (data) => {
        form.reset({
          exit_intent_coupon: (data.exit_intent_coupon as string) || '',
          ask_ai_coupon: (data.ask_ai_coupon as boolean) || false,
          specific_product_query_coupon:
            (data.specific_product_query_coupon as boolean) || false,
          coupon_collect_lead: (data.coupon_collect_lead as boolean) || false,
        });
      },
    });
  }, []);

  const handleSubmit = (data: FormValues) => {
    updateSettings({
      key: 'coupons',
      data: {
        ...settings,
        exit_intent_coupon: data.exit_intent_coupon,
        ask_ai_coupon: data.ask_ai_coupon,
        specific_product_query_coupon: data.specific_product_query_coupon,
        coupon_collect_lead: data.coupon_collect_lead,
      },
    });
  };

  return (
    <div className="relative">
      {!getProQuery.data && (
        <ProBadge
          topMessage="Imagine your chatbot whispering 'Here's 10% off' right before they bounce. That's smart conversion."
          buttonText="Convert Exits into Orders"
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
            Coupon Delivery Settings{' '}
            <InfoTooltip message="Automatically deliver personalized coupons when customers engage in chat or show exit intent. Helps reduce cart abandonment and increase average order value." />
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isFetchingSettings ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Skeleton className="w-32 h-4" />
                  <Skeleton className="w-full h-10" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="w-32 h-9" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="w-48 h-9" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="w-24 h-9" />
                </div>
              </div>
              <Skeleton className="w-32 h-10" />
            </div>
          ) : (
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(handleSubmit)}
                className="space-y-6"
              >
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="exit_intent_coupon"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Exit Intent Coupon</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                className={cn(
                                  'w-full justify-between',
                                  !field.value && 'text-muted-foreground'
                                )}
                              >
                                {field.value
                                  ? coupons.find(
                                      (coupon) =>
                                        coupon.code === field.value
                                    )?.code
                                  : 'Select coupon'}
                                <ChevronsUpDown className="ml-2 w-4 h-4 opacity-50 shrink-0" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="p-0 w-full">
                            <Command>
                              <CommandInput
                                className="!border-none !ring-0 !ring-offset-0 h-5"
                                placeholder="Search coupon..."
                              />
                              <CommandEmpty>No coupon found.</CommandEmpty>
                              <CommandGroup>
                                <CommandItem
                                  value=""
                                  onSelect={() => {
                                    form.setValue('exit_intent_coupon', '');
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      'mr-2 h-4 w-4',
                                      !field.value
                                        ? 'opacity-100'
                                        : 'opacity-0'
                                    )}
                                  />
                                  No coupon
                                </CommandItem>
                                {coupons.map((coupon) => (
                                  <CommandItem
                                    value={coupon.code}
                                    key={coupon.id}
                                    onSelect={() => {
                                      form.setValue(
                                        'exit_intent_coupon',
                                        coupon.code
                                      );
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        'mr-2 h-4 w-4',
                                        coupon.code === field.value
                                          ? 'opacity-100'
                                          : 'opacity-0'
                                      )}
                                    />
                                    {coupon.code}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="ask_ai_coupon"
                    render={({ field }) => (
                      <FormItem className="flex flex-row justify-between items-center self-end p-2 h-9 rounded-md border border-input">
                        <FormLabel>Ask AI for Coupon</FormLabel>
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
                    name="specific_product_query_coupon"
                    render={({ field }) => (
                      <FormItem className="flex flex-row justify-between items-center p-2 h-9 rounded-md border border-input">
                        <FormLabel>Specific Product Query Coupon</FormLabel>
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
                    name="coupon_collect_lead"
                    render={({ field }) => (
                      <FormItem className="flex flex-row justify-between items-center p-2 h-9 rounded-md border border-input">
                        <FormLabel>Collect Lead</FormLabel>
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
                  {isUpdating ? 'Saving...' : 'Save Settings'}
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}