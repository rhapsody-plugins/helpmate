import { ProBadge } from '@/components/ProBadge';
import RichTextEditor from '@/components/RichTextEditor';
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import useAbandonedCart from '@/hooks/useAbandonedCart';
import useCoupons from '@/hooks/useCoupons';
import { useSettings } from '@/hooks/useSettings';
import { cn } from '@/lib/utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { Check, ChevronsUpDown, Pencil, Plus, Trash } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
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
  selected_email_template: z.number().min(1, {
    message: 'Email template is required',
  }),
  coupon_code: z.string().optional(),
});

const emailTemplateFormSchema = z.object({
  template_name: z.string().min(1, {
    message: 'Template name is required',
  }),
  email_subject: z.string().min(1, {
    message: 'Email subject is required',
  }),
  email_body: z.string().min(1, {
    message: 'Email body is required',
  }),
});

type FormData = z.infer<typeof formSchema>;
type EmailTemplateFormData = z.infer<typeof emailTemplateFormSchema>;

interface EmailTemplateFormProps {
  isEditing: boolean;
  initialData?: {
    template_name: string;
    email_subject: string;
    email_body: string;
  };
  onSave: (data: EmailTemplateFormData) => void;
  onDelete?: () => void;
  onClose: () => void;
}

function EmailTemplateForm({
  isEditing,
  initialData,
  onSave,
  onDelete,
  onClose,
}: EmailTemplateFormProps) {
  const form = useForm<EmailTemplateFormData>({
    resolver: zodResolver(emailTemplateFormSchema),
    defaultValues: initialData || {
      template_name: '',
      email_subject: '',
      email_body: '',
    },
  });

  const handleSubmit = (data: EmailTemplateFormData) => {
    onSave(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="template_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Template Name</FormLabel>
              <FormControl>
                <Input placeholder="Enter template name" {...field} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email_subject"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email Subject</FormLabel>
              <FormControl>
                <Input placeholder="Enter email subject" {...field} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email_body"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email Body</FormLabel>
              <FormControl>
                <RichTextEditor
                  content={field.value}
                  onChange={field.onChange}
                  texts={[
                    '{customer_name}',
                    '{cart_total}',
                    '{cart_items}',
                    '{cart_url}',
                    '{shop_name}',
                    '{coupon_code}',
                  ]}
                />
              </FormControl>
            </FormItem>
          )}
        />
        <div className="flex gap-2">
          <Button type="submit">Save</Button>
          {isEditing && onDelete && (
            <Button variant="destructive" onClick={onDelete}>
              Delete Template
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default function TabSettings() {
  const { getSettingsMutation, updateSettingsMutation, getProQuery } =
    useSettings();
  const { getCouponsQuery } = useCoupons();
  const { saveEmailTemplate, updateEmailTemplate, deleteEmailTemplate } =
    useAbandonedCart();
  const { data: coupons } = getCouponsQuery;

  const {
    mutate: getSettings,
    isPending: isFetching,
    data: settings,
  } = getSettingsMutation;
  const { mutate: updateSettings, isPending: isUpdating } =
    updateSettingsMutation;

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<{
    id: number;
    template_name: string;
    email_subject: string;
    email_body: string;
  } | null>(null);

  const emailTemplates =
    (settings?.email_templates as {
      id: number;
      abandoned_cart_template_name: string;
      abandoned_cart_email_body: string;
      abandoned_cart_email_subject: string;
    }[]) || [];

  const form = useForm<FormData>({
    defaultValues: {
      abandoned_cart_after: '60',
      delete_abandoned_cart_after: '10080',
      cart_recovery_button_text: 'Recover Cart',
      selected_email_template: 1,
      coupon_code: '',
    },
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    getSettings('abandoned_cart', {
      onSuccess: (data) => {
        form.reset(data);
      },
    });
  }, [getSettings, form]);

  const handleSaveTemplate = (data: EmailTemplateFormData) => {
    if (isEditing && selectedTemplate) {
      updateEmailTemplate.mutate(
        {
          id: selectedTemplate.id,
          template_name: data.template_name,
          email_subject: data.email_subject,
          email_body: data.email_body,
        },
        {
          onSuccess: () => {
            getSettings('abandoned_cart', {
              onSuccess: (data) => {
                form.reset(data);
              },
            });
          },
        }
      );
    } else {
      saveEmailTemplate.mutate(
        {
          template_name: data.template_name,
          email_subject: data.email_subject,
          email_body: data.email_body,
        },
        {
          onSuccess: () => {
            getSettings('abandoned_cart', {
              onSuccess: (data) => {
                form.reset(data);
              },
            });
          },
        }
      );
    }
    handleClose();
  };

  const handleDelete = () => {
    const template = emailTemplates.find(
      (template) => template.id === form.getValues('selected_email_template')
    );
    if (template && confirm('Are you sure you want to delete this template?')) {
      deleteEmailTemplate.mutate(template.id);
      handleClose();
    }
  };

  const handleEdit = () => {
    const template = emailTemplates.find(
      (template) => template.id === form.getValues('selected_email_template')
    );
    if (template) {
      setSelectedTemplate({
        id: template.id,
        template_name: template.abandoned_cart_template_name,
        email_subject: template.abandoned_cart_email_subject || '',
        email_body: template.abandoned_cart_email_body || '',
      });
      setIsEditing(true);
      setIsSheetOpen(true);
    }
  };

  const handleClose = () => {
    setIsSheetOpen(false);
    setIsEditing(false);
    setSelectedTemplate(null);
  };

  const handleSubmit = (data: FormData) => {
    updateSettings(
      {
        key: 'abandoned_cart',
        data: {
          abandoned_cart_after: data.abandoned_cart_after,
          delete_abandoned_cart_after: data.delete_abandoned_cart_after,
          cart_recovery_button_text: data.cart_recovery_button_text,
          selected_email_template: data.selected_email_template,
          coupon_code: data.coupon_code,
          email_templates: emailTemplates,
        },
      },
      {
        onSuccess: () => {
          getSettings('abandoned_cart', {
            onSuccess: (data) => {
              form.reset(data);
            },
          });
        },
      }
    );
  };

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
            <CardTitle className="flex gap-1 items-center text-xl font-bold">
              Abandoned Cart Settings{' '}
              <InfoTooltip message="Sends reminder messages via email to bring users back and recover lost sales. Helps boost revenue by converting missed opportunities into purchases." />
            </CardTitle>
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
                            <FormLabel>Email Template</FormLabel>
                            <FormControl>
                              <div className="flex gap-2">
                                <Select
                                  value={field.value.toString()}
                                  onValueChange={(value) => {
                                    field.onChange(+value);
                                  }}
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue
                                      placeholder="Select a template"
                                      className="truncate"
                                    />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {isFetching ? (
                                      <SelectItem value="1">
                                        Loading...
                                      </SelectItem>
                                    ) : (
                                      emailTemplates?.map((template) => (
                                        <SelectItem
                                          key={template.id}
                                          value={template.id.toString()}
                                        >
                                          {
                                            template.abandoned_cart_template_name
                                          }
                                        </SelectItem>
                                      ))
                                    )}
                                  </SelectContent>
                                </Select>
                                {field.value !== 1 && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    onClick={handleEdit}
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </Button>
                                )}
                                {field.value !== 1 && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    onClick={handleDelete}
                                  >
                                    <Trash className="w-4 h-4" />
                                  </Button>
                                )}
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={() => {
                                    setIsEditing(false);
                                    setSelectedTemplate(null);
                                    setIsSheetOpen(true);
                                  }}
                                >
                                  <Plus className="w-4 h-4" />
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

      <Sheet open={isSheetOpen} onOpenChange={handleClose}>
        <SheetContent className="sm:!max-w-4xl">
          <SheetHeader className="mt-10">
            <SheetTitle className="!my-0">
              {isEditing ? 'Edit Email Template' : 'New Email Template'}
            </SheetTitle>
          </SheetHeader>
          <div className="p-4 pt-0">
            <EmailTemplateForm
              isEditing={isEditing}
              initialData={
                selectedTemplate
                  ? {
                      template_name: selectedTemplate.template_name,
                      email_subject: selectedTemplate.email_subject,
                      email_body: selectedTemplate.email_body,
                    }
                  : undefined
              }
              onSave={handleSaveTemplate}
              onDelete={isEditing ? handleDelete : undefined}
              onClose={handleClose}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
