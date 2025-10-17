import { ProBadge } from '@/components/ProBadge';
import RichTextEditor from '@/components/RichTextEditor';
import { ReusableTable } from '@/components/ReusableTable';
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
import { Input } from '@/components/ui/input';
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
import { Switch } from '@/components/ui/switch';
import { useSettings } from '@/hooks/useSettings';
import { cn } from '@/lib/utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnDef } from '@tanstack/react-table';
import { Pencil, Plus, Trash } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

interface FollowUpEmail {
  id: number;
  delay: number;
  delayUnit: 'minutes' | 'hours' | 'days';
  subject: string;
  body: string;
  enabled: boolean;
}

const emailSchema = z.object({
  delay: z.number().min(1, 'Delay must be at least 1'),
  delayUnit: z.enum(['minutes', 'hours', 'days']),
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Email body is required'),
  enabled: z.boolean(),
});

type EmailFormValues = z.infer<typeof emailSchema>;

// ============================================================================
// DEFAULT EMAILS
// ============================================================================

const DEFAULT_EMAILS: FollowUpEmail[] = [
  {
    id: 1,
    delay: 3,
    delayUnit: 'hours',
    subject: 'You left items in your cart!',
    body: `<p>Hi {customer_name},</p><p>We noticed you left some items in your cart. Don't worry, we've saved them for you!</p><p>{cart_items}</p><p>Complete your purchase now and get back to where you left off.</p><p>{cart_url}</p><p>Best regards,<br>{shop_name}</p>`,
    enabled: false,
  },
  {
    id: 2,
    delay: 1,
    delayUnit: 'days',
    subject: 'Your cart is waiting - Special offer inside!',
    body: `<p>Hi {customer_name},</p><p>Your cart items are still waiting for you! As a special thank you, we'd like to offer you a discount to complete your purchase.</p><p>{cart_items}</p><p>Use code: {coupon_code} for a special discount on your order!</p><p>{cart_url}</p><p>This offer expires in 48 hours.</p><p>Best regards,<br>{shop_name}</p>`,
    enabled: false,
  },
  {
    id: 3,
    delay: 3,
    delayUnit: 'days',
    subject: 'Last chance - Your cart expires soon',
    body: `<p>Hi {customer_name},</p><p>This is your last reminder! Your cart will expire soon and these items might go out of stock.</p><p>{cart_url}</p><p>Best regards,<br>{shop_name}</p>`,
    enabled: false,
  },
];

// ============================================================================
// COMPONENT
// ============================================================================

export default function TabFollowUpEmails() {
  const { getSettingsMutation, updateSettingsMutation, getProQuery } =
    useSettings();
  const {
    mutate: getSettings,
    isPending: isFetching,
    data: settings,
  } = getSettingsMutation;
  const { mutate: updateSettings, isPending: isUpdating } =
    updateSettingsMutation;

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<FollowUpEmail | null>(
    null
  );

  const followUpEmails: FollowUpEmail[] =
    (settings?.follow_up_emails as FollowUpEmail[]) || DEFAULT_EMAILS;

  const form = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      delay: 3,
      delayUnit: 'hours',
      subject: '',
      body: '',
      enabled: true,
    },
  });

  useEffect(() => {
    getSettings('abandoned_cart');
  }, [getSettings]);

  const handleEdit = (email: FollowUpEmail) => {
    setSelectedEmail(email);
    setIsEditing(true);
    form.reset({
      delay: email.delay,
      delayUnit: email.delayUnit,
      subject: email.subject,
      body: email.body,
      enabled: email.enabled,
    });
    setIsSheetOpen(true);
  };

  const handleCreate = () => {
    setSelectedEmail(null);
    setIsEditing(false);
    form.reset({
      delay: 1,
      delayUnit: 'hours',
      subject: '',
      body: '',
      enabled: true,
    });
    setIsSheetOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm('Are you sure you want to delete this email?')) {
      getSettings('abandoned_cart', {
        onSuccess: (currentSettings) => {
          const updatedEmails = followUpEmails.filter((email) => email.id !== id);
          updateSettings(
            {
              key: 'abandoned_cart',
              data: {
                ...currentSettings,
                follow_up_emails: updatedEmails,
              },
            },
            {
              onSuccess: () => {
                getSettings('abandoned_cart');
              },
            }
          );
        },
      });
    }
  };

  const handleToggleEnabled = (id: number) => {
    getSettings('abandoned_cart', {
      onSuccess: (currentSettings) => {
        const updatedEmails = followUpEmails.map((email) =>
          email.id === id ? { ...email, enabled: !email.enabled } : email
        );
        updateSettings(
          {
            key: 'abandoned_cart',
            data: {
              ...currentSettings,
              follow_up_emails: updatedEmails,
            },
          },
          {
            onSuccess: () => {
              getSettings('abandoned_cart');
            },
          }
        );
      },
    });
  };

  const handleClose = () => {
    setIsSheetOpen(false);
    setIsEditing(false);
    setSelectedEmail(null);
  };

  const onSubmit = (data: EmailFormValues) => {
    getSettings('abandoned_cart', {
      onSuccess: (currentSettings) => {
        let updatedEmails: FollowUpEmail[];

        if (isEditing && selectedEmail) {
          updatedEmails = followUpEmails.map((email) =>
            email.id === selectedEmail.id ? { ...email, ...data } : email
          );
        } else {
          const newEmail: FollowUpEmail = {
            id: Date.now(),
            ...data,
          };
          updatedEmails = [...followUpEmails, newEmail];
        }

        updateSettings(
          {
            key: 'abandoned_cart',
            data: {
              ...currentSettings,
              follow_up_emails: updatedEmails,
            },
          },
          {
            onSuccess: () => {
              getSettings('abandoned_cart');
              handleClose();
            },
          }
        );
      },
    });
  };

  const formatDelay = (delay: number, unit: string) => {
    return `${delay} ${unit}`;
  };

  const sortedEmails = useMemo(() => {
    return [...followUpEmails].sort((a, b) => {
      const getMinutes = (email: FollowUpEmail) => {
        switch (email.delayUnit) {
          case 'minutes':
            return email.delay;
          case 'hours':
            return email.delay * 60;
          case 'days':
            return email.delay * 24 * 60;
          default:
            return 0;
        }
      };
      return getMinutes(a) - getMinutes(b);
    });
  }, [followUpEmails]);

  const columns: ColumnDef<FollowUpEmail>[] = useMemo(
    () => [
      {
        accessorKey: 'delay',
        header: 'Send After',
        cell: ({ row }) => {
          return (
            <div>{formatDelay(row.original.delay, row.original.delayUnit)}</div>
          );
        },
      },
      {
        accessorKey: 'subject',
        header: 'Subject',
      },
      {
        accessorKey: 'enabled',
        header: 'Status',
        cell: ({ row }) => {
          return (
            <Switch
              checked={row.original.enabled}
              onCheckedChange={() => handleToggleEnabled(row.original.id)}
            />
          );
        },
      },
      {
        accessorKey: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          return (
            <div className="flex gap-2 justify-end items-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleEdit(row.original)}
              >
                <Pencil className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDelete(row.original.id)}
              >
                <Trash className="w-4 h-4" />
              </Button>
            </div>
          );
        },
      },
    ],
    [followUpEmails]
  );

  return (
    <>
      <div className="space-y-6">
        <div className="relative">
          {!getProQuery.data && (
            <ProBadge
              topMessage="Automate your abandoned cart recovery with follow-up emails."
              buttonText="Upgrade to Pro"
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
                  Follow Up Emails{' '}
                  <InfoTooltip message="Configure automated follow-up emails to be sent at specific intervals after cart abandonment." />
                </CardTitle>
                <Button onClick={handleCreate}>
                  <Plus className="mr-2 w-4 h-4" />
                  Add Email
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isFetching || isUpdating ? (
                <div className="space-y-4">
                  <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="flex gap-4 items-center">
                        <Skeleton className="w-24 h-4" />
                        <Skeleton className="w-64 h-4" />
                        <Skeleton className="w-20 h-4" />
                        <div className="flex gap-2 ml-auto">
                          <Skeleton className="w-20 h-8" />
                          <Skeleton className="w-10 h-8" />
                          <Skeleton className="w-10 h-8" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <ReusableTable
                  columns={columns}
                  data={sortedEmails}
                  className={cn(
                    'w-full',
                    !getProQuery.data &&
                      'opacity-50 cursor-not-allowed pointer-events-none'
                  )}
                  rightAlignedColumns={['actions']}
                  loading={isFetching || isUpdating}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Sheet open={isSheetOpen} onOpenChange={handleClose}>
        <SheetContent className="sm:!max-w-4xl">
          <SheetHeader className="mt-10">
            <SheetTitle className="!my-0">
              {isEditing ? 'Edit Follow Up Email' : 'New Follow Up Email'}
            </SheetTitle>
          </SheetHeader>
          <div className="p-4 pt-0">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="delay"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Send After</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            {...field}
                            onChange={(e) =>
                              field.onChange(parseInt(e.target.value) || 1)
                            }
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="delayUnit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unit</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select unit" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="minutes">Minutes</SelectItem>
                            <SelectItem value="hours">Hours</SelectItem>
                            <SelectItem value="days">Days</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="subject"
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
                  name="body"
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
                  <Button type="submit" disabled={isUpdating} loading={isUpdating}>
                    {isUpdating ? 'Saving...' : 'Save'}
                  </Button>
                  {isEditing && (
                    <Button
                      variant="destructive"
                      type="button"
                      onClick={() => selectedEmail && handleDelete(selectedEmail.id)}
                    >
                      Delete Email
                    </Button>
                  )}
                  <Button type="button" variant="outline" onClick={handleClose}>
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
