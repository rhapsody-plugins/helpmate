import { ProBadge } from '@/components/ProBadge';
import RichTextEditor from '@/components/RichTextEditor';
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
import { useSettings } from '@/hooks/useSettings';
import { cn } from '@/lib/utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { Edit, Plus, Trash } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

const formSchema = z.object({
  selected_email_template: z.number().min(1, {
    message: 'Email template is required',
  }),
  policy_url: z.string().optional(),
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

const reasonFormSchema = z.object({
  reason: z.string().min(1, {
    message: 'Reason is required',
  }),
});

type FormData = z.infer<typeof formSchema>;
type EmailTemplateFormData = z.infer<typeof emailTemplateFormSchema>;
type ReasonFormData = z.infer<typeof reasonFormSchema>;

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
                    '{order_number}',
                    '{return_refund_type}',
                    '{return_refund_status}',
                    '{return_refund_reason}',
                    '{return_refund_amount}',
                    '{return_refund_items}',
                    '{shop_name}',
                    '{status}',
                    '{order_id}',
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
  const { getProQuery } = useSettings();
  const [isEmailTemplateSheetOpen, setIsEmailTemplateSheetOpen] =
    useState(false);
  const [isReasonSheetOpen, setIsReasonSheetOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingReason, setIsEditingReason] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<{
    id: number;
    template_name: string;
    email_subject: string;
    email_body: string;
  } | null>(null);
  const [selectedReason, setSelectedReason] = useState<{
    id: string;
    reason: string;
  } | null>(null);

  const { getSettingsMutation, updateSettingsMutation } = useSettings();
  const {
    mutate: getSettings,
    isPending: isFetchingSettings,
    data: settings,
  } = getSettingsMutation;
  const { mutate: updateSettings, isPending: isUpdating } =
    updateSettingsMutation;

  const form = useForm<FormData>({
    defaultValues: {
      selected_email_template: 1,
      policy_url: '',
    },
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    getSettings('refund_return', {
      onSuccess: (data) => {
        form.reset(data);
      },
    });
  }, [getSettings, form]);

  const emailTemplates =
    (settings?.email_templates as {
      id: number;
      refund_return_template_name: string;
      refund_return_email_body: string;
      refund_return_email_subject: string;
    }[]) || [];

  const reasons = (settings?.reasons as string[]) || [];

  const handleSaveTemplate = (data: EmailTemplateFormData) => {
    if (isEditing && selectedTemplate) {
      updateSettings(
        {
          key: 'refund_return',
          data: {
            ...settings,
            email_templates: emailTemplates.map((template) =>
              template.id === selectedTemplate.id
                ? {
                    ...template,
                    refund_return_template_name: data.template_name,
                    refund_return_email_subject: data.email_subject,
                    refund_return_email_body: data.email_body,
                  }
                : template
            ),
          },
        },
        {
          onSuccess: () => {
            getSettings('refund_return', {
              onSuccess: (data) => {
                form.reset(data);
              },
            });
            toast.success('Email template updated successfully');
          },
        }
      );
    } else {
      const newTemplate = {
        id: Math.max(...emailTemplates.map((t) => t.id), 0) + 1,
        refund_return_template_name: data.template_name,
        refund_return_email_subject: data.email_subject,
        refund_return_email_body: data.email_body,
      };

      updateSettings(
        {
          key: 'refund_return',
          data: {
            ...settings,
            email_templates: [...emailTemplates, newTemplate],
          },
        },
        {
          onSuccess: () => {
            getSettings('refund_return', {
              onSuccess: (data) => {
                form.reset(data);
              },
            });
            toast.success('Email template created successfully');
          },
        }
      );
    }
    handleCloseEmailTemplate();
  };

  const handleDelete = () => {
    if (
      selectedTemplate &&
      confirm('Are you sure you want to delete this template?')
    ) {
      updateSettings(
        {
          key: 'refund_return',
          data: {
            ...settings,
            email_templates: emailTemplates.filter(
              (template) => template.id !== selectedTemplate.id
            ),
            selected_email_template:
              settings?.selected_email_template === selectedTemplate.id
                ? 1
                : settings?.selected_email_template,
          },
        },
        {
          onSuccess: () => {
            getSettings('refund_return', {
              onSuccess: (data) => {
                form.reset(data);
              },
            });
            toast.success('Email template deleted successfully');
          },
        }
      );
      handleCloseEmailTemplate();
    }
  };

  const handleEdit = () => {
    const template = emailTemplates.find(
      (template) => template.id === form.getValues('selected_email_template')
    );
    if (template) {
      setSelectedTemplate({
        id: template.id,
        template_name: template.refund_return_template_name,
        email_subject: template.refund_return_email_subject || '',
        email_body: template.refund_return_email_body || '',
      });
      setIsEditing(true);
      setIsEmailTemplateSheetOpen(true);
    }
  };

  const handleCloseEmailTemplate = () => {
    setIsEmailTemplateSheetOpen(false);
    setIsEditing(false);
    setSelectedTemplate(null);
  };

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

  const handleSubmit = (data: FormData) => {
    updateSettings(
      {
        key: 'refund_return',
        data: {
          ...settings,
          selected_email_template: data.selected_email_template,
          policy_url: data.policy_url,
        },
      },
      {
        onSuccess: () => {
          getSettings('refund_return', {
            onSuccess: (data) => {
              form.reset(data);
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
          <CardTitle className="flex gap-1 items-center text-xl font-bold">
            Refund & Return Settings{' '}
            <InfoTooltip message="This tool lets users initiate refund or return requests directly through chat. Makes your store more trustworthy by offering an easy and transparent return experience." />
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
                                  {isFetchingSettings ? (
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
                                          template.refund_return_template_name
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
                                  <Edit className="w-4 h-4" />
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
                                  setIsEmailTemplateSheetOpen(true);
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

      <Sheet
        open={isEmailTemplateSheetOpen}
        onOpenChange={handleCloseEmailTemplate}
      >
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
              onClose={handleCloseEmailTemplate}
            />
          </div>
        </SheetContent>
      </Sheet>

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