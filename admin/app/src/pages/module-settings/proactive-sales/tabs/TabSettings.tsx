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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useSettings } from '@/hooks/useSettings';
import { cn } from '@/lib/utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

// Import template images
import template1 from '@/assets/templates/proactive-template-1.webp';
import template2 from '@/assets/templates/proactive-template-2.webp';
import template3 from '@/assets/templates/proactive-template-3.webp';

// ============================================================================
// TYPES & SCHEMAS
// ============================================================================

const formSchema = z.object({
  proactive_sales_show_frequency: z
    .string()
    .min(1, { message: 'Frequency is required' }),
  proactive_sales_hide_frequency: z
    .string()
    .min(1, { message: 'Frequency is required' }),
  proactive_sales_template: z
    .string()
    .min(1, { message: 'Template is required' }),
});

type FormData = z.infer<typeof formSchema>;

// ============================================================================
// COMPONENT
// ============================================================================

export default function TabSettings() {
  const { getSettingsMutation, updateSettingsMutation, getProQuery } =
    useSettings();

  const {
    data: proactiveSales = { products: [] },
    mutate: getSettings,
    isPending: isFetchingSettings,
  } = getSettingsMutation;
  const { mutate: updateSettings, isPending: isUpdating } =
    updateSettingsMutation;

  const form = useForm<FormData>({
    defaultValues: {
      proactive_sales_show_frequency: '2',
      proactive_sales_hide_frequency: '0.16',
      proactive_sales_template: '1',
    },
    resolver: zodResolver(formSchema),
    disabled: !getProQuery.data,
  });

  // ========================================================================
  // EFFECTS
  // ========================================================================

  useEffect(() => {
    getSettings('proactive_sales', {
      onSuccess: (data) => {
        form.reset(data);
      },
    });
  }, []);

  // ========================================================================
  // HANDLERS
  // ========================================================================

  const handleSubmit = (data: FormData) => {
    updateSettings({
      key: 'proactive_sales',
      data: {
        ...proactiveSales,
        proactive_sales_show_frequency: data.proactive_sales_show_frequency,
        proactive_sales_hide_frequency: data.proactive_sales_hide_frequency,
        proactive_sales_template: data.proactive_sales_template,
      },
    });
  };

  // ========================================================================
  // RENDER
  // ========================================================================

  return (
    <div className="space-y-6">
      {/* Settings Card */}
      <div className="relative">
        {!getProQuery.data && (
          <ProBadge
            topMessage="It's like having a sales rep in every visitor's pocket, ready with the perfect pitch."
            buttonText="Boost Sales Conversations"
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
              Proactive Sales Settings{' '}
              <InfoTooltip message="This feature lets the chatbot automatically suggest discounted products on the Chat window. It increases conversion rates and average order value." />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(handleSubmit)}
                className="space-y-6"
              >
                {isFetchingSettings ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Skeleton className="w-32 h-4" />
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
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="proactive_sales_show_frequency"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Show Frequency</FormLabel>
                            <FormControl>
                              <Select
                                value={field.value}
                                onValueChange={field.onChange}
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
                      name="proactive_sales_template"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Template</FormLabel>
                          <FormControl>
                            <div className="grid grid-cols-3 gap-4">
                              <div
                                className={cn(
                                  'relative cursor-pointer rounded-lg border transition-all p-5 hover:border-primary',
                                  field.value === '1'
                                    ? 'border-primary'
                                    : 'border-border/50'
                                )}
                                onClick={() => field.onChange('1')}
                              >
                                <img
                                  src={template1}
                                  alt="Template 1"
                                  className="w-full h-auto"
                                />
                                <div className="flex absolute inset-0 justify-center items-center rounded-md opacity-0 transition-opacity bg-white/70 hover:opacity-100">
                                  <span className="text-lg font-semibold drop-shadow-lg">
                                    Template 1
                                  </span>
                                </div>
                              </div>

                              <div
                                className={cn(
                                  'relative cursor-pointer rounded-lg border transition-all flex items-center justify-center p-5',
                                  field.value === '2'
                                    ? 'border-primary'
                                    : 'border-border/50'
                                )}
                                onClick={() => field.onChange('2')}
                              >
                                <img
                                  src={template2}
                                  alt="Template 2"
                                  className="w-full h-auto"
                                />
                                <div className="flex absolute inset-0 justify-center items-center rounded-md opacity-0 transition-opacity bg-white/70 hover:opacity-100">
                                  <span className="text-lg font-semibold drop-shadow-lg">
                                    Template 2
                                  </span>
                                </div>
                              </div>

                              <div
                                className={cn(
                                  'relative cursor-pointer rounded-lg border transition-all flex items-center justify-center p-5',
                                  field.value === '3'
                                    ? 'border-primary'
                                    : 'border-border/50'
                                )}
                                onClick={() => field.onChange('3')}
                              >
                                <img
                                  src={template3}
                                  alt="Template 3"
                                  className="w-full h-auto"
                                />
                                <div className="flex absolute inset-0 justify-center items-center rounded-md opacity-0 transition-opacity bg-white/70 hover:opacity-100">
                                  <span className="text-lg font-semibold drop-shadow-lg">
                                    Template 3
                                  </span>
                                </div>
                              </div>
                            </div>
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
