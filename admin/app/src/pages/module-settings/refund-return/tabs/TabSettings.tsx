import { ProBadge } from '@/components/ProBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DraggableItem, DraggableList } from '@/components/ui/draggable-list';
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
  SheetTitle
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { useMain } from '@/contexts/MainContext';
import { useCrm } from '@/hooks/useCrm';
import { useSettings } from '@/hooks/useSettings';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { Edit, Plus, Trash } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

const formSchema = z.object({
  selected_email_template: z.number().nullable().optional(),
  policy_url: z.string().optional(),
});

const reasonFormSchema = z.object({
  reason: z.string().min(1, {
    message: 'Reason is required',
  }),
});

type FormData = z.infer<typeof formSchema>;
type ReasonFormData = z.infer<typeof reasonFormSchema>;

interface ReasonFormProps {
  isEditing: boolean;
  initialData?: {
    reason: string;
  };
  onSave: (data: ReasonFormData) => void;
  onClose: () => void;
}

function ReasonForm({
  isEditing,
  initialData,
  onSave,
  onClose,
}: ReasonFormProps) {
  const form = useForm<ReasonFormData>({
    resolver: zodResolver(reasonFormSchema),
    defaultValues: initialData || {
      reason: '',
    },
  });

  const handleSubmit = (data: ReasonFormData) => {
    onSave(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="reason"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Reason</FormLabel>
              <FormControl>
                <Input placeholder="Enter reason" {...field} />
              </FormControl>
            </FormItem>
          )}
        />
        <div className="flex gap-2">
          <Button type="submit">{isEditing ? 'Update' : 'Add'}</Button>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}


export default function TabSettings() {
  const { getProQuery } = useSettings();
  const [isReasonSheetOpen, setIsReasonSheetOpen] = useState(false);
  const [isEditingReason, setIsEditingReason] = useState(false);
  const [selectedReason, setSelectedReason] = useState<{
    id: string;
    reason: string;
  } | null>(null);
  const [isRecreatingTemplate, setIsRecreatingTemplate] = useState(false);

  const { getSettingsMutation, updateSettingsMutation } = useSettings();
  const {
    mutate: getSettings,
    isPending: isFetchingSettings,
    data: settings,
  } = getSettingsMutation;
  const { mutate: updateSettings, isPending: isUpdating } =
    updateSettingsMutation;
  const { useEmailTemplates } = useCrm();
  const { data: emailTemplates, isLoading: isLoadingTemplates } = useEmailTemplates();
  const { setPage } = useMain();

  const form = useForm<FormData>({
    defaultValues: {
      selected_email_template: null,
      policy_url: '',
    },
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    getSettings('refund_return', {
      onSuccess: (data) => {
        if (data) {
          form.reset({
            selected_email_template: typeof data.selected_email_template === 'number' ? data.selected_email_template : null,
            policy_url: typeof data.policy_url === 'string' ? data.policy_url : '',
          });
        }
      },
    });
  }, [getSettings, form]);

  const reasons = (settings?.reasons as string[]) || [];


  const handleCloseReason = () => {
    setIsReasonSheetOpen(false);
    setIsEditingReason(false);
    setSelectedReason(null);
  };

  const handleSaveReason = (data: ReasonFormData) => {
    if (isEditingReason && selectedReason) {
      // Update existing reason
      const updatedReasons = reasons.map((reason, index) =>
        index === parseInt(selectedReason.id) ? data.reason : reason
      );

      updateSettings(
        {
          key: 'refund_return',
          data: {
            ...settings,
            reasons: updatedReasons,
          },
        },
        {
          onSuccess: () => {
            getSettings('refund_return', {
              onSuccess: (data) => {
                form.reset(data);
              },
            });
            toast.success('Reason updated successfully');
          },
        }
      );
    } else {
      // Add new reason
      updateSettings(
        {
          key: 'refund_return',
          data: {
            ...settings,
            reasons: [...reasons, data.reason],
          },
        },
        {
          onSuccess: () => {
            getSettings('refund_return', {
              onSuccess: (data) => {
                form.reset(data);
              },
            });
            toast.success('Reason added successfully');
          },
        }
      );
    }
    handleCloseReason();
  };

  const handleDeleteReason = (index: number) => {
    const reason = reasons[index];
    if (reason === 'Other') {
      toast.error('Cannot delete the "Other" option');
      return;
    }

    if (confirm(`Are you sure you want to delete "${reason}"?`)) {
      const updatedReasons = reasons.filter((_, i) => i !== index);

      updateSettings(
        {
          key: 'refund_return',
          data: {
            ...settings,
            reasons: updatedReasons,
          },
        },
        {
          onSuccess: () => {
            getSettings('refund_return', {
              onSuccess: (data) => {
                form.reset(data);
              },
            });
            toast.success('Reason deleted successfully');
          },
        }
      );
    }
  };

  const handleEditReason = (index: number) => {
    const reason = reasons[index];
    if (reason === 'Other') {
      toast.error('Cannot edit the "Other" option');
      return;
    }

    setSelectedReason({
      id: index.toString(),
      reason: reason,
    });
    setIsEditingReason(true);
    setIsReasonSheetOpen(true);
  };

  const handleReorderReasons = (
    newItems: { id: string; content: React.JSX.Element }[]
  ) => {
    const newReasons = newItems.map((item) => {
      const index = parseInt(item.id);
      return reasons[index];
    });

    updateSettings(
      {
        key: 'refund_return',
        data: {
          ...settings,
          reasons: newReasons,
        },
      },
      {
        onSuccess: () => {
          getSettings('refund_return', {
            onSuccess: (data) => {
              form.reset(data);
            },
          });
          toast.success('Reasons reordered successfully');
        },
      }
    );
  };

  const handleRecreateTemplate = async () => {
    setIsRecreatingTemplate(true);
    try {
      const response = await api.post('/crm/refund-return/create-default-template') as { template_id?: number; error?: boolean; message?: string };
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
        key: 'refund_return',
        data: {
          ...settings,
          selected_email_template: data.selected_email_template || null,
          policy_url: data.policy_url,
        },
      },
      {
        onSuccess: () => {
          getSettings('refund_return', {
            onSuccess: (data) => {
              if (data) {
                form.reset({
                  selected_email_template: typeof data.selected_email_template === 'number' ? data.selected_email_template : null,
                  policy_url: typeof data.policy_url === 'string' ? data.policy_url : '',
                });
              }
            },
          });
          toast.success('Settings updated successfully');
        },
      }
    );
  };

  // Convert reasons to draggable items format
  const draggableReasons = reasons.map((reason, index) => ({
    id: index.toString(),
    content: (
      <DraggableItem>
        <div className="flex justify-between items-center w-full">
          <span className="flex-1">{reason}</span>
          <div className="flex gap-2 items-center">
            {reason !== 'Other' && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleEditReason(index)}
                  className="w-8 h-8"
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeleteReason(index)}
                  className="w-8 h-8 text-destructive"
                >
                  <Trash className="w-4 h-4" />
                </Button>
              </>
            )}
            {reason === 'Other' && (
              <span className="px-2 py-1 text-xs rounded text-muted-foreground bg-muted">
                Protected
              </span>
            )}
          </div>
        </div>
      </DraggableItem>
    ),
  }));

  return (
    <div className="relative">
      {!getProQuery.data && (
        <ProBadge
          topMessage="It's not just a refund. It's your reputation. Offer seamless return experiences and build trust."
          buttonText="Build Loyalty with Ease"
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
              Refund & Return Settings{' '}
              <InfoTooltip message="This tool lets users initiate refund or return requests directly through chat. Makes your store more trustworthy by offering an easy and transparent return experience." />
            </CardTitle>
            {!isLoadingTemplates && (() => {
              const missingTemplate = emailTemplates?.find(
                (t) => t.name === 'Refund/Return Request Update'
              )
                ? null
                : 'Refund/Return Request Update';
              return missingTemplate ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleRecreateTemplate}
                  disabled={isRecreatingTemplate}
                >
                  {isRecreatingTemplate ? 'Creating...' : 'Recreate Missing Template'}
                </Button>
              ) : null;
            })()}
          </div>
          {!isLoadingTemplates && (() => {
            const missingTemplate = emailTemplates?.find(
              (t) => t.name === 'Refund/Return Request Update'
            )
              ? null
              : 'Refund/Return Request Update';
            return missingTemplate ? (
              <div className="p-2 mt-2 text-sm text-yellow-600 bg-yellow-50 rounded">
                Missing default template: {missingTemplate}
              </div>
            ) : null;
          })()}
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-6"
            >
              {isFetchingSettings ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
                    <div className="space-y-2">
                      <Skeleton className="w-20 h-4" />
                      <Skeleton className="w-full h-10" />
                    </div>
                    <div className="space-y-2">
                      <Skeleton className="w-20 h-4" />
                      <Skeleton className="w-full h-10" />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <div className="space-y-2">
                        <Skeleton className="w-48 h-6" />
                        <Skeleton className="w-64 h-4" />
                      </div>
                      <Skeleton className="w-32 h-10" />
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        {[...Array(5)].map((_, i) => (
                          <Skeleton key={i} className="w-full h-12" />
                        ))}
                      </div>
                    </div>
                  </div>
                  <Skeleton className="w-20 h-10" />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
                    <FormField
                      control={form.control}
                      name="selected_email_template"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex gap-1 items-center">
                            Email Template
                            <InfoTooltip message="Select an email template from CRM. Available variables: {customer_name}, {order_number}, {return_refund_type}, {return_refund_status}, {return_refund_reason}, {return_refund_amount}, {return_refund_items}, {shop_name}, {status}, {order_id}" />
                          </FormLabel>
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
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="policy_url"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Policy URL</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter policy URL"
                              {...field}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="text-lg font-semibold">
                          Refund/Return Reasons
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Manage the list of reasons customers can select
                          for refund/return requests.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsEditingReason(false);
                          setSelectedReason(null);
                          setIsReasonSheetOpen(true);
                        }}
                      >
                        <Plus className="mr-2 w-4 h-4" />
                        Add Reason
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <DraggableList
                        items={draggableReasons}
                        onChange={handleReorderReasons}
                        className="w-full"
                      />
                    </div>
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

      <Sheet open={isReasonSheetOpen} onOpenChange={handleCloseReason}>
        <SheetContent className="sm:!max-w-4xl">
          <SheetHeader className="mt-10">
            <SheetTitle className="!my-0">
              {isEditingReason ? 'Edit Reason' : 'New Reason'}
            </SheetTitle>
          </SheetHeader>
          <div className="p-4 pt-0">
            <ReasonForm
              isEditing={isEditingReason}
              initialData={
                selectedReason
                  ? {
                      reason: selectedReason.reason,
                    }
                  : undefined
              }
              onSave={handleSaveReason}
              onClose={handleCloseReason}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}