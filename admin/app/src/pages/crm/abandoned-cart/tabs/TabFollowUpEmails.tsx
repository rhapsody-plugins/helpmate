import { ProBadge } from '@/components/ProBadge';
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
import { useCrm } from '@/hooks/useCrm';
import { useMain } from '@/contexts/MainContext';
import { cn } from '@/lib/utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnDef } from '@tanstack/react-table';
import { Pencil, Plus, Trash } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import api from '@/lib/axios';

interface FollowUpEmail {
  id: number;
  delay: number;
  delayUnit: 'minutes' | 'hours' | 'days';
  template_id: number | null;
  enabled: boolean;
}

const emailSchema = z.object({
  delay: z.number().min(1, 'Delay must be at least 1'),
  delayUnit: z.enum(['minutes', 'hours', 'days']),
  template_id: z.number().min(1, 'Template is required'),
  enabled: z.boolean(),
});

type EmailFormValues = z.infer<typeof emailSchema>;

// ============================================================================
// DEFAULT EMAILS
// ============================================================================

const DEFAULT_EMAILS: FollowUpEmail[] = [];

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
  const { useEmailTemplates } = useCrm();
  const emailTemplatesQuery = useEmailTemplates();
  const { data: emailTemplates, refetch: refetchEmailTemplates, isLoading: isLoadingTemplates } = emailTemplatesQuery || { data: undefined, refetch: undefined, isLoading: true };
  const { setPage } = useMain();

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<FollowUpEmail | null>(
    null
  );
  const [isRecreatingTemplates, setIsRecreatingTemplates] = useState(false);

  const followUpEmails: FollowUpEmail[] =
    (settings?.follow_up_emails as FollowUpEmail[]) || DEFAULT_EMAILS;

  const form = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      delay: 3,
      delayUnit: 'hours',
      template_id: 0,
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
      template_id: email.template_id || 0,
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
      template_id: 0,
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

  const getTemplateName = (templateId: number | null) => {
    if (!templateId || !emailTemplates) return 'No template selected';
    const template = emailTemplates.find(t => t.id === templateId);
    return template ? template.name : 'Template not found';
  };

  // Check which default templates are missing
  const getMissingTemplates = () => {
    if (!emailTemplates || emailTemplates.length === 0) {
      return ['first', 'second', 'third'];
    }

    const missing: string[] = [];
    const templateNames = emailTemplates.map(t => t.name);

    if (!templateNames.includes('Abandoned Cart - 2nd Reminder')) {
      missing.push('first');
    }
    if (!templateNames.includes('Abandoned Cart - 3rd Reminder')) {
      missing.push('second');
    }
    if (!templateNames.includes('Abandoned Cart - Final Reminder')) {
      missing.push('third');
    }

    return missing;
  };

  const handleRecreateMissingTemplates = async () => {
    setIsRecreatingTemplates(true);
    try {
      const response = await api.post('/crm/abandoned-cart/create-default-followup-templates');
      if (response.data && response.data.templates) {
        // Refresh email templates list
        if (refetchEmailTemplates) {
          refetchEmailTemplates();
        }

        // If follow-up emails were created, update settings
        if (response.data.follow_up_emails) {
          getSettings('abandoned_cart', {
            onSuccess: (currentSettings) => {
              updateSettings(
                {
                  key: 'abandoned_cart',
                  data: {
                    ...currentSettings,
                    follow_up_emails: response.data.follow_up_emails,
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
        } else {
          // Just refresh if no follow-up emails were created
          getSettings('abandoned_cart');
        }
      }
    } catch (error) {
      console.error('Failed to recreate templates:', error);
    } finally {
      setIsRecreatingTemplates(false);
    }
  };

  const missingTemplates = getMissingTemplates();

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
        accessorKey: 'template_id',
        header: 'Email Template',
        cell: ({ row }) => {
          return (
            <div>{getTemplateName(row.original.template_id)}</div>
          );
        },
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
    [followUpEmails, emailTemplates]
  );

  return (
    <>
      <div className="space-y-6">
        <div className="relative">
          {!getProQuery.isLoading && !getProQuery.data && (
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
                <div className="flex gap-2">
                  {!isLoadingTemplates && missingTemplates.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRecreateMissingTemplates}
                      disabled={isRecreatingTemplates}
                    >
                      {isRecreatingTemplates ? 'Recreating...' : 'Recreate Missing Templates'}
                    </Button>
                  )}
                  <Button onClick={handleCreate}>
                    <Plus className="mr-2 w-4 h-4" />
                    Add Email
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {!isLoadingTemplates && missingTemplates.length > 0 && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg mb-4">
                  <p className="text-sm text-yellow-800">
                    <strong>Missing Templates:</strong> The following default email templates are missing:{' '}
                    {missingTemplates.map((status, index) => {
                      const labels: Record<string, string> = {
                        first: 'Abandoned Cart - 2nd Reminder',
                        second: 'Abandoned Cart - 3rd Reminder',
                        third: 'Abandoned Cart - Final Reminder',
                      };
                      return (
                        <span key={status}>
                          {index > 0 && ', '}
                          <span className="font-semibold">{labels[status]}</span>
                        </span>
                      );
                    })}. Click "Recreate Missing Templates" to restore them.
                  </p>
                </div>
              )}
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
                  name="template_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex gap-1 items-center">
                        Email Template
                        <InfoTooltip message="Select an email template from CRM. Available variables: {customer_name}, {cart_total}, {cart_items}, {cart_url}, {shop_name}, {coupon_code}" />
                      </FormLabel>
                      <div className="flex gap-2">
                        <Select
                          value={field.value?.toString() || 'none'}
                          onValueChange={(value) =>
                            field.onChange(value === 'none' ? null : parseInt(value, 10))
                          }
                        >
                          <FormControl>
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Select template" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {emailTemplates?.map((template) => (
                              <SelectItem key={template.id} value={template.id.toString()}>
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
                          <Plus className="w-4 h-4 mr-2" />
                          Create Template
                        </Button>
                      </div>
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
