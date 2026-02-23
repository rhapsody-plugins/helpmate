import { ProBadge } from '@/components/ProBadge';
import { ReusableTable } from '@/components/ReusableTable';
import EmailTemplateEditor from '@/components/crm/EmailTemplateEditor';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
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
import { useCrm } from '@/hooks/useCrm';
import { useSettings } from '@/hooks/useSettings';
import { cn } from '@/lib/utils';
import api from '@/lib/axios';
import { EmailTemplate } from '@/types/crm';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { formatDistanceToNow } from 'date-fns';
import { LIBRARY_TEMPLATES } from '@/pages/crm/Emails/emailLibraryTemplates';
import { parseUTCDate, defaultLocale } from '@/pages/crm/contacts/utils';
import { Library, Pencil, Plus, RotateCcw, Trash } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const emailTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required'),
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Email body is required'),
});

type EmailTemplateFormValues = z.infer<typeof emailTemplateSchema>;

export default function TabTemplates() {
  const queryClient = useQueryClient();
  const { getProQuery } = useSettings();
  const isPro = getProQuery.data ?? false;
  const {
    useEmailTemplates,
    createEmailTemplateMutation,
    updateEmailTemplateMutation,
    deleteEmailTemplateMutation,
    restoreEmailTemplateMutation,
    useCustomFields,
  } = useCrm();

  const { data: templates, isLoading } = useEmailTemplates();
  const { data: customFields } = useCustomFields();

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(
    null
  );
  const [templateSelector, setTemplateSelector] = useState<string>('fresh');
  const [isLoadingDefaultTemplate, setIsLoadingDefaultTemplate] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [libraryCreatingId, setLibraryCreatingId] = useState<string | null>(null);

  // Monitor media library and restore body pointer-events
  useEffect(() => {
    if (!isSheetOpen) return;

    const checkMediaLibrary = () => {
      const mediaModal = document.querySelector('.media-modal');
      const isMediaOpen = mediaModal && window.getComputedStyle(mediaModal).display !== 'none';

      if (isMediaOpen) {
        // Media library is open - restore pointer events on body
        document.body.style.pointerEvents = '';
      }
    };

    // Check immediately
    checkMediaLibrary();

    // Watch for media modal changes
    const observer = new MutationObserver(() => {
      requestAnimationFrame(checkMediaLibrary);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class'],
    });

    // Also check periodically as a fallback
    const interval = setInterval(() => {
      requestAnimationFrame(checkMediaLibrary);
    }, 50);

    return () => {
      observer.disconnect();
      clearInterval(interval);
    };
  }, [isSheetOpen]);

  const form = useForm<EmailTemplateFormValues>({
    resolver: zodResolver(emailTemplateSchema),
    defaultValues: {
      name: '',
      subject: '',
      body: '',
    },
  });

  // Build grouped variable list for RichTextEditor
  const groupedEmailVariables = useMemo(() => {
    const groups = [
      {
        label: 'Contact Information',
        variables: [
          '{first_name}',
          '{last_name}',
          '{name}',
          '{email}',
          '{phone}',
        ],
      },
      {
        label: 'Address',
        variables: [
          '{address_line_1}',
          '{address_line_2}',
          '{city}',
          '{state}',
          '{zip_code}',
          '{country}',
        ],
      },
      {
        label: 'Smart Schedule',
        variables: [
          '{date}',
          '{time}',
          '{message}',
        ],
      },
      {
        label: 'General',
        variables: [
          '{shop_name}',
        ],
      },
    ];

    // Add custom fields group if they exist
    const customFieldVariables =
      customFields?.map((field) => `{${field.field_name}}`) || [];

    if (customFieldVariables.length > 0) {
      groups.push({
        label: 'Custom Fields',
        variables: customFieldVariables,
      });
    }

    return groups;
  }, [customFields]);

  // Load default template when selected
  useEffect(() => {
    if (templateSelector === 'default' && isSheetOpen && !isEditing) {
      setIsLoadingDefaultTemplate(true);
      api.get<{ error: boolean; data: string }>('/crm/email-templates/default')
        .then((response) => {
          if (!response.data.error && response.data.data) {
            form.setValue('body', response.data.data);
            form.setValue('subject', 'Email from {shop_name}');
          }
        })
        .catch(() => {
          // Silently fail
        })
        .finally(() => {
          setIsLoadingDefaultTemplate(false);
        });
    }
  }, [templateSelector, isSheetOpen, isEditing, form]);

  const handleEdit = (template: EmailTemplate) => {
    const isDefault = template.is_default === true || template.is_default === 1 || template.is_default === '1';
    if (!isPro && isDefault) return;
    setSelectedTemplate(template);
    setIsEditing(true);
    form.reset({
      name: template.name,
      subject: template.subject,
      body: template.body,
    });
    setIsSheetOpen(true);
  };

  const MINIMAL_TEMPLATE_BODY = '<p>Hello {first_name},</p><p>Your message here.</p><p>Best regards,<br>{shop_name}</p>';

  const handleCreate = () => {
    setSelectedTemplate(null);
    setIsEditing(false);
    setTemplateSelector('fresh');
    form.reset({
      name: '',
      subject: '',
      body: MINIMAL_TEMPLATE_BODY,
    });
    setIsSheetOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm('Are you sure you want to delete this email template?')) {
      deleteEmailTemplateMutation.mutate(id);
    }
  };

  const handleClose = () => {
    setIsSheetOpen(false);
    setIsEditing(false);
    setSelectedTemplate(null);
    setTemplateSelector('fresh');
  };

  const handleUseLibraryTemplate = (tpl: (typeof LIBRARY_TEMPLATES)[number]) => {
    setLibraryCreatingId(tpl.id);
    createEmailTemplateMutation.mutate(
      { name: tpl.name, subject: tpl.subject, body: tpl.body },
      {
        onSettled: () => setLibraryCreatingId(null),
        onSuccess: () => setIsLibraryOpen(false),
      }
    );
  };

  const onSubmit = (data: EmailTemplateFormValues) => {
    if (isEditing && selectedTemplate) {
      updateEmailTemplateMutation.mutate(
        {
          templateId: selectedTemplate.id,
          data,
        },
        {
          onSuccess: () => {
            handleClose();
          },
        }
      );
    } else {
      createEmailTemplateMutation.mutate(data, {
        onSuccess: () => {
          handleClose();
        },
      });
    }
  };

  const columns: ColumnDef<EmailTemplate>[] = useMemo(
    () => [
      {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ row }) => {
          const isDefault = row.original.is_default === true || row.original.is_default === 1 || row.original.is_default === '1';
          return (
            <div className="flex gap-2 items-center">
              <span>{row.original.name}</span>
              {isDefault && (
                <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                  Default
                </span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'subject',
        header: 'Subject',
      },
      {
        accessorKey: 'created_at',
        header: 'Created',
        cell: ({ row }) => {
          return (
            <div>
              {formatDistanceToNow(parseUTCDate(row.original.created_at), {
                addSuffix: true,
                locale: defaultLocale,
              })}
            </div>
          );
        },
      },
      {
        accessorKey: 'updated_at',
        header: 'Updated',
        cell: ({ row }) => {
          return (
            <div>
              {formatDistanceToNow(parseUTCDate(row.original.updated_at), {
                addSuffix: true,
                locale: defaultLocale,
              })}
            </div>
          );
        },
      },
      {
        accessorKey: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const isDefault = row.original.is_default === true || row.original.is_default === 1 || row.original.is_default === '1';
          const editDisabled = !isPro && isDefault;
          return (
            <div className="flex gap-2 justify-end items-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleEdit(row.original)}
                disabled={editDisabled}
              >
                <Pencil className="w-4 h-4" />
              </Button>
              {!isDefault && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(row.original.id)}
                  disabled={!isPro}
                >
                  <Trash className="w-4 h-4 text-destructive" />
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    [isPro]
  );

  const isPending =
    createEmailTemplateMutation.isPending ||
    updateEmailTemplateMutation.isPending ||
    deleteEmailTemplateMutation.isPending ||
    restoreEmailTemplateMutation.isPending;

  return (
    <>
      <div className="relative p-6 space-y-6">
        {!isPro && (
          <ProBadge
            topMessage="Create and manage reusable email templates. Personalize each message with dynamic data."
            buttonText="Unlock Email Templates"
            tooltipMessage={null}
          />
        )}
        <div
          className={cn(
            'space-y-6',
            !isPro && 'opacity-50 cursor-not-allowed pointer-events-none'
          )}
        >
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="flex gap-1 items-center text-xl font-bold">
                Email Templates{' '}
                <InfoTooltip message="Create and manage reusable email templates. Personalize each message with dynamic data." />
              </CardTitle>
              <div className="flex gap-2 items-center">
                <Button onClick={handleCreate} disabled={!isPro}>
                  <Plus className="mr-2 w-4 h-4" />
                  Create Template
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsLibraryOpen(true)}
                  disabled={!isPro}
                >
                  <Library className="mr-2 w-4 h-4" />
                  Template Library
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading || isPending ? (
              <div className="space-y-4">
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex gap-4 items-center">
                      <Skeleton className="w-32 h-4" />
                      <Skeleton className="w-64 h-4" />
                      <Skeleton className="w-24 h-4" />
                      <Skeleton className="w-24 h-4" />
                      <div className="flex gap-2 ml-auto">
                        <Skeleton className="w-10 h-8" />
                        <Skeleton className="w-10 h-8" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : templates && templates.length > 0 ? (
              <ReusableTable
                columns={columns}
                data={templates}
                className="w-full"
                rightAlignedColumns={['actions']}
                loading={isLoading || isPending}
              />
            ) : (
              <div className="flex flex-col justify-center items-center py-12 text-center">
                <p className="text-muted-foreground">No email templates yet.</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Create your first email template to get started.
                </p>
                <div className="mt-4 flex gap-2">
                  <Button onClick={handleCreate} disabled={!isPro}>
                    <Plus className="mr-2 w-4 h-4" />
                    Create Template
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setIsLibraryOpen(true)}
                    disabled={!isPro}
                  >
                    <Library className="mr-2 w-4 h-4" />
                    Template Library
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        </div>
      </div>

      <Sheet
        open={isSheetOpen}
        onOpenChange={(open) => {
          // Prevent closing if WordPress media library is open
          if (!open) {
            // Check if media modal is visible in the DOM
            const mediaModal = document.querySelector('.media-modal');
            if (mediaModal && window.getComputedStyle(mediaModal).display !== 'none') {
              // Media library is open, don't close the sheet
              return;
            }
            handleClose();
          }
        }}
      >
        <SheetContent className="sm:!max-w-4xl">
          <SheetHeader>
            <SheetTitle>
              {isEditing ? 'Edit Email Template' : 'New Email Template'}
            </SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto flex-1 p-4 pt-6">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                {!isEditing && (
                  <FormItem>
                    <FormLabel>Start From Template</FormLabel>
                    <Select
                      value={templateSelector}
                      onValueChange={setTemplateSelector}
                      disabled={isLoadingDefaultTemplate}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select template" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fresh">Start Fresh</SelectItem>
                        <SelectItem value="default">Default Transactional Email Template</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Template Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter template name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="subject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Subject</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter email subject" {...field} />
                      </FormControl>
                      <FormMessage />
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
                        <EmailTemplateEditor
                          content={field.value}
                          onChange={field.onChange}
                          groupedVariables={groupedEmailVariables}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-2">
                  <Button
                    type="submit"
                    disabled={isPending}
                    loading={isPending}
                  >
                    {isPending ? 'Saving...' : 'Save'}
                  </Button>
                  {isEditing && (selectedTemplate?.is_default === true || selectedTemplate?.is_default === 1 || selectedTemplate?.is_default === '1') && (
                    <Button
                      variant="outline"
                      type="button"
                      onClick={() => {
                        if (selectedTemplate && selectedTemplate.original_subject && selectedTemplate.original_body) {
                          restoreEmailTemplateMutation.mutate(selectedTemplate.id, {
                            onSuccess: async () => {
                              // Wait for query to refetch, then update form
                              await queryClient.refetchQueries({ queryKey: ['crm-email-templates'] });
                              // Update form with original content
                              form.reset({
                                name: selectedTemplate.name,
                                subject: selectedTemplate.original_subject,
                                body: selectedTemplate.original_body,
                              });
                            },
                          });
                        }
                      }}
                      disabled={isPending || !selectedTemplate?.original_subject || !selectedTemplate?.original_body}
                    >
                      <RotateCcw className="mr-2 w-4 h-4" />
                      Restore Original
                    </Button>
                  )}
                  {isEditing && !selectedTemplate?.is_default && (
                    <Button
                      variant="destructive"
                      type="button"
                      onClick={() =>
                        selectedTemplate && handleDelete(selectedTemplate.id)
                      }
                    >
                      Delete Template
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

      <Sheet open={isLibraryOpen} onOpenChange={setIsLibraryOpen}>
        <SheetContent className="sm:!max-w-3xl">
          <SheetHeader>
            <SheetTitle>Template Library</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto flex-1 p-4 pt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {LIBRARY_TEMPLATES.map((tpl) => (
                <div
                  key={tpl.id}
                  className="flex flex-col rounded-lg border bg-muted/30 overflow-hidden"
                >
                  <div className="relative w-full aspect-[4/3] min-h-[160px] overflow-hidden bg-white shrink-0 rounded-t-lg border-b flex items-center justify-center">
                    <div
                      className="origin-center shrink-0"
                      style={{
                        transform: 'scale(0.45)',
                        width: 600,
                        height: 320,
                      }}
                    >
                      <iframe
                        srcDoc={`<!DOCTYPE html><html style="height:100%"><head><style>html,body{height:100%;margin:0;padding:0;overflow:hidden}body{display:flex;justify-content:center;align-items:flex-start}</style></head><body>${tpl.body}</body></html>`}
                        title={`Preview of ${tpl.name}`}
                        className="w-[600px] h-[320px] border-0 pointer-events-none block"
                        sandbox="allow-same-origin"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col flex-1 p-4 gap-3">
                    <div>
                      <div className="font-medium">{tpl.name}</div>
                      {tpl.description && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {tpl.description}
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleUseLibraryTemplate(tpl)}
                      disabled={libraryCreatingId !== null}
                      loading={libraryCreatingId === tpl.id}
                    >
                      Use Template
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

