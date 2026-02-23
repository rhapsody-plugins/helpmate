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
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useMain } from '@/contexts/MainContext';
import useCoupons from '@/hooks/useCoupons';
import { useCrm } from '@/hooks/useCrm';
import { useSettings } from '@/hooks/useSettings';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

// Time conversion utilities
const convertTimeToMinutes = (
  days: number,
  hours: number,
  minutes: number,
  seconds: number
): number => {
  return days * 24 * 60 + hours * 60 + minutes + seconds / 60;
};

const convertMinutesToTime = (
  totalMinutes: number
): { days: number; hours: number; minutes: number; seconds: number } => {
  const days = Math.floor(totalMinutes / (24 * 60));
  const remainingMinutes = totalMinutes % (24 * 60);
  const hours = Math.floor(remainingMinutes / 60);
  const minutes = Math.floor(remainingMinutes % 60);
  const seconds = Math.floor((totalMinutes % 1) * 60);
  return { days, hours, minutes, seconds };
};

interface TimeInputProps {
  value: string;
  onChange: (value: string) => void;
  fields?: Array<'days' | 'hours' | 'minutes' | 'seconds'>;
}

function TimeInput({
  value,
  onChange,
  fields = ['days', 'hours', 'minutes', 'seconds'],
}: TimeInputProps) {
  const totalMinutes = parseFloat(value);
  const { days, hours, minutes, seconds } = convertMinutesToTime(totalMinutes);

  const handleChange = (
    type: 'days' | 'hours' | 'minutes' | 'seconds',
    newValue: string
  ) => {
    const numValue = parseInt(newValue) || 0;
    let newDays = days;
    let newHours = hours;
    let newMinutes = minutes;
    let newSeconds = seconds;

    switch (type) {
      case 'days':
        newDays = numValue;
        break;
      case 'hours':
        newHours = numValue;
        break;
      case 'minutes':
        newMinutes = numValue;
        break;
      case 'seconds':
        newSeconds = numValue;
        break;
    }

    const totalNewMinutes = convertTimeToMinutes(
      newDays,
      newHours,
      newMinutes,
      newSeconds
    );
    onChange(totalNewMinutes.toString());
  };

  return (
    <div className="flex gap-2 items-center">
      {fields.includes('days') && (
        <div className="flex flex-col gap-1 items-center">
          <Input
            type="number"
            min="0"
            max="23"
            value={days.toString().padStart(2, '0')}
            onChange={(e) => handleChange('days', e.target.value)}
            className="w-16 p-2 text-center !border-input !rounded-md focus-visible:!border-ring focus-visible:!ring-ring/50 focus-visible:!ring-[3px]"
          />
          <span>days</span>
        </div>
      )}
      {fields.includes('hours') && (
        <div className="flex flex-col gap-1 items-center">
          <Input
            type="number"
            min="0"
            max="23"
            value={hours.toString().padStart(2, '0')}
            onChange={(e) => handleChange('hours', e.target.value)}
            className="w-16 p-2 text-center !border-input !rounded-md focus-visible:!border-ring focus-visible:!ring-ring/50 focus-visible:!ring-[3px]"
          />
          <span>hours</span>
        </div>
      )}
      {fields.includes('minutes') && (
        <div className="flex flex-col gap-1 items-center">
          <Input
            type="number"
            min="0"
            max="23"
            value={minutes.toString().padStart(2, '0')}
            onChange={(e) => handleChange('minutes', e.target.value)}
            className="w-16 p-2 text-center !border-input !rounded-md focus-visible:!border-ring focus-visible:!ring-ring/50 focus-visible:!ring-[3px]"
          />
          <span>minutes</span>
        </div>
      )}
      {fields.includes('seconds') && (
        <div className="flex flex-col gap-1 items-center">
          <Input
            type="number"
            min="0"
            max="23"
            value={seconds.toString().padStart(2, '0')}
            onChange={(e) => handleChange('seconds', e.target.value)}
            className="w-16 p-2 text-center !border-input !rounded-md focus-visible:!border-ring focus-visible:!ring-ring/50 focus-visible:!ring-[3px]"
          />
          <span>seconds</span>
        </div>
      )}
    </div>
  );
}

const formSchema = z.object({
  abandoned_cart_after: z.string().min(1, {
    message: 'Time is required',
  }),
  delete_abandoned_cart_after: z.string().min(1, {
    message: 'Time is required',
  }),
  cart_recovery_button_text: z.string().min(1, {
    message: 'Text is required',
  }),
  selected_email_template: z.number().nullable().optional(),
  coupon_code: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export default function TabSettings() {
  const { getSettingsMutation, updateSettingsMutation, getProQuery } =
    useSettings();
  const { getCouponsQuery } = useCoupons();
  const { data: coupons } = getCouponsQuery;
  const { useEmailTemplates } = useCrm();
  const { data: emailTemplates, isLoading: isLoadingTemplates } = useEmailTemplates();
  const { setPage } = useMain();

  const {
    mutate: getSettings,
    isPending: isFetching,
    data: settings,
  } = getSettingsMutation;
  const { mutate: updateSettings, isPending: isUpdating } =
    updateSettingsMutation;

  const [isRecreatingTemplate, setIsRecreatingTemplate] = useState(false);

  const form = useForm<FormData>({
    defaultValues: {
      abandoned_cart_after: '60',
      delete_abandoned_cart_after: '10080',
      cart_recovery_button_text: 'Recover Cart',
      selected_email_template: null,
      coupon_code: '',
    },
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    getSettings('abandoned_cart', {
      onSuccess: (data) => {
        if (data) {
          form.reset({
            abandoned_cart_after: typeof data.abandoned_cart_after === 'string' ? data.abandoned_cart_after : '60',
            delete_abandoned_cart_after: typeof data.delete_abandoned_cart_after === 'string' ? data.delete_abandoned_cart_after : '10080',
            cart_recovery_button_text: typeof data.cart_recovery_button_text === 'string' ? data.cart_recovery_button_text : 'Recover Cart',
            selected_email_template: typeof data.selected_email_template === 'number' ? data.selected_email_template : null,
            coupon_code: typeof data.coupon_code === 'string' ? data.coupon_code : '',
          });
        }
      },
    });
  }, [getSettings, form]);

  const getMissingTemplate = () => {
    if (!emailTemplates) return null;
    const defaultTemplate = emailTemplates.find(
      (t) => t.name === 'Abandoned Cart - 1st Email'
    );
    return defaultTemplate ? null : 'Abandoned Cart - 1st Email';
  };

  const handleRecreateTemplate = async () => {
    setIsRecreatingTemplate(true);
    try {
      const response = await api.post('/crm/abandoned-cart/create-default-template') as { template_id?: number; error?: boolean; message?: string };
      console.log('Template creation response:', response);
      if (response.template_id) {
        toast.success('Default template created and set successfully');
        // Reload the browser tab to show the changes
        // Use a small delay to ensure the toast is visible before reload
        setTimeout(() => {
          window.location.reload();
        }, 500);
      } else if (response.error) {
        toast.error(response.message || 'Failed to create default template');
        setIsRecreatingTemplate(false);
      } else {
        console.error('Unexpected response format:', response);
        toast.error('Failed to create default template');
        setIsRecreatingTemplate(false);
      }
    } catch (error) {
      console.error('Failed to recreate template:', error);
      toast.error('Failed to create default template');
      setIsRecreatingTemplate(false);
    }
  };

  const handleSubmit = (data: FormData) => {
    updateSettings(
      {
        key: 'abandoned_cart',
        data: {
          ...settings,
          abandoned_cart_after: data.abandoned_cart_after,
          delete_abandoned_cart_after: data.delete_abandoned_cart_after,
          cart_recovery_button_text: data.cart_recovery_button_text,
          selected_email_template: data.selected_email_template || null,
          coupon_code: data.coupon_code,
        },
      },
      {
        onSuccess: () => {
          getSettings('abandoned_cart', {
            onSuccess: (data) => {
              if (data) {
                form.reset({
                  abandoned_cart_after: typeof data.abandoned_cart_after === 'string' ? data.abandoned_cart_after : '60',
                  delete_abandoned_cart_after: typeof data.delete_abandoned_cart_after === 'string' ? data.delete_abandoned_cart_after : '10080',
                  cart_recovery_button_text: typeof data.cart_recovery_button_text === 'string' ? data.cart_recovery_button_text : 'Recover Cart',
                  selected_email_template: typeof data.selected_email_template === 'number' ? data.selected_email_template : null,
                  coupon_code: typeof data.coupon_code === 'string' ? data.coupon_code : '',
                });
              }
            },
          });
          toast.success('Settings updated successfully');
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="relative">
        {!getProQuery.isLoading && !getProQuery.data && (
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
            <div className="flex justify-between items-center">
              <CardTitle className="flex gap-1 items-center text-xl font-bold">
                Abandoned Cart Settings{' '}
                <InfoTooltip message="Sends reminder messages via email to bring users back and recover lost sales. Helps boost revenue by converting missed opportunities into purchases." />
              </CardTitle>
              {!isLoadingTemplates && getMissingTemplate() && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleRecreateTemplate}
                  disabled={isRecreatingTemplate}
                >
                  {isRecreatingTemplate ? 'Creating...' : 'Recreate Missing Template'}
                </Button>
              )}
            </div>
            {!isLoadingTemplates && getMissingTemplate() && (
              <div className="p-2 mt-2 text-sm text-yellow-600 bg-yellow-50 rounded">
                Missing default template: {getMissingTemplate()}
              </div>
            )}
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(handleSubmit)}
                className={cn(
                  'space-y-6',
                  !getProQuery.data &&
                    'opacity-50 cursor-not-allowed pointer-events-none'
                )}
              >
                {isFetching ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-6 max-md:grid-cols-1">
                      <div className="space-y-2">
                        <Skeleton className="w-24 h-4" />
                        <div className="flex gap-2 items-center">
                          <Skeleton className="w-16 h-10" />
                          <Skeleton className="w-16 h-10" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Skeleton className="w-32 h-4" />
                        <div className="flex gap-2 items-center">
                          <Skeleton className="w-16 h-10" />
                          <Skeleton className="w-16 h-10" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Skeleton className="w-24 h-4" />
                        <div className="flex gap-2">
                          <Skeleton className="w-full h-10" />
                          <Skeleton className="w-10 h-10" />
                          <Skeleton className="w-10 h-10" />
                          <Skeleton className="w-10 h-10" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Skeleton className="w-32 h-4" />
                        <div className="flex gap-2">
                          <Skeleton className="w-full h-10" />
                          <Skeleton className="w-10 h-10" />
                        </div>
                      </div>
                    </div>
                    <Skeleton className="w-20 h-10" />
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-6 max-md:grid-cols-1">
                      <FormField
                        control={form.control}
                        name="abandoned_cart_after"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Abandoned Cart After</FormLabel>
                            <FormControl>
                              <TimeInput
                                value={field.value}
                                onChange={field.onChange}
                                fields={['hours', 'minutes']}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="delete_abandoned_cart_after"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Delete Abandoned Cart After</FormLabel>
                            <FormControl>
                              <TimeInput
                                value={field.value}
                                onChange={field.onChange}
                                fields={['days', 'hours']}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="selected_email_template"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex gap-1 items-center">
                              Email Template
                              <InfoTooltip message="Select an email template from CRM. Available variables: {customer_name}, {cart_total}, {cart_items}, {cart_url}, {shop_name}, {coupon_code}" />
                            </FormLabel>
                            <FormControl>
                              <div className="flex gap-2">
                                <Select
                                  value={field.value?.toString() || 'none'}
                                  onValueChange={(value) => {
                                    field.onChange(value === 'none' ? null : parseInt(value, 10));
                                  }}
                                >
                                  <SelectTrigger className="flex-1">
                                    <SelectValue
                                      placeholder="Select a template"
                                      className="truncate"
                                    />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">None</SelectItem>
                                    {emailTemplates?.map((template) => (
                                      <SelectItem
                                        key={template.id}
                                        value={template.id.toString()}
                                      >
                                        {template.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => setPage('crm-emails')}
                                >
                                  <Plus className="mr-2 w-4 h-4" />
                                  Create Template
                                </Button>
                              </div>
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="coupon_code"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>Abandoned Cart Coupon</FormLabel>
                            <FormControl>
                              <div className="flex gap-2">
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <FormControl>
                                      <Button
                                        variant="outline"
                                        role="combobox"
                                        className={cn(
                                          'flex-1 justify-between',
                                          !field.value &&
                                            'text-muted-foreground'
                                        )}
                                      >
                                        {field.value
                                          ? coupons?.find(
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
                                      <CommandEmpty>
                                        No coupon found.
                                      </CommandEmpty>
                                      <CommandGroup>
                                        <CommandItem
                                          value=""
                                          onSelect={() => {
                                            form.setValue('coupon_code', '');
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
                                        {coupons?.map((coupon) => (
                                          <CommandItem
                                            value={coupon.code}
                                            key={coupon.id}
                                            onSelect={() => {
                                              form.setValue(
                                                'coupon_code',
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
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={() => {
                                    window.open(
                                      '/wp-admin/edit.php?post_type=shop_coupon',
                                      '_blank'
                                    );
                                  }}
                                >
                                  <Plus className="w-4 h-4" />
                                </Button>
                              </div>
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

    </div>
  );
}
