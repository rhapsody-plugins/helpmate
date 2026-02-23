import { ReusableTable } from '@/components/ReusableTable';
import RichTextEditor from '@/components/RichTextEditor';
import { Badge } from '@/components/ui/badge';
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
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useCrm } from '@/hooks/useCrm';
import { ContactEmail } from '@/types/crm';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnDef } from '@tanstack/react-table';
import { formatDistanceToNow } from 'date-fns';
import { parseUTCDate, defaultLocale } from '../utils';
import { Eye, Plus, Send } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { sendEmailSchema, type SendEmailFormData } from '../schemas';
import { ContentPreviewSheet } from './ContentPreviewSheet';

interface EmailsTabProps {
  contactId: number | null;
}

const PAGE_SIZE = 10;

export function EmailsTab({ contactId }: EmailsTabProps) {
  const {
    useContactEmails,
    sendEmailMutation,
    useEmailTemplates,
    useCustomFields,
  } = useCrm();

  const [currentPage, setCurrentPage] = useState(1);
  const [showSendEmail, setShowSendEmail] = useState(false);
  const [bodyManuallyEdited, setBodyManuallyEdited] = useState(false);
  const [previewEmail, setPreviewEmail] = useState<ContactEmail | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const isLoadingTemplate = useRef(false);

  const { data: emailsData, isLoading: emailsLoading } = useContactEmails(
    contactId,
    currentPage,
    PAGE_SIZE,
    contactId !== null
  );
  const { data: templates } = useEmailTemplates();
  const { data: customFields } = useCustomFields();

  const form = useForm<SendEmailFormData>({
    resolver: zodResolver(sendEmailSchema),
    defaultValues: {
      template_id: null,
      subject: '',
      body: '',
    },
  });

  const selectedTemplateId = form.watch('template_id');
  const selectedTemplate = templates?.find((t) => t.id === selectedTemplateId);

  // Build variable list for RichTextEditor
  const emailVariables = useMemo(() => {
    const baseVariables = [
      '{first_name}',
      '{last_name}',
      '{email}',
      '{phone}',
      '{address_line_1}',
      '{address_line_2}',
      '{city}',
      '{state}',
      '{zip_code}',
      '{country}',
      '{shop_name}',
    ];

    // Add custom field variables
    const customFieldVariables =
      customFields?.map((field) => `{${field.field_name}}`) || [];

    return [...baseVariables, ...customFieldVariables];
  }, [customFields]);

  // Reset to page 1 when contactId changes
  useEffect(() => {
    setCurrentPage(1);
  }, [contactId]);

  // When template is selected, populate subject and body
  useEffect(() => {
    if (selectedTemplate) {
      isLoadingTemplate.current = true;
      setBodyManuallyEdited(false);
      form.setValue('subject', selectedTemplate.subject, { shouldDirty: true });
      form.setValue('body', selectedTemplate.body, { shouldDirty: true });
      // Reset flag after a short delay to allow the editor to process
      setTimeout(() => {
        isLoadingTemplate.current = false;
      }, 100);
    } else if (selectedTemplateId === null) {
      // Clear fields when "None" is selected
      isLoadingTemplate.current = true;
      setBodyManuallyEdited(false);
      form.setValue('subject', '', { shouldDirty: true });
      form.setValue('body', '', { shouldDirty: true });
      setTimeout(() => {
        isLoadingTemplate.current = false;
      }, 100);
    }
  }, [selectedTemplate, selectedTemplateId, form]);

  const handleSendEmail = (data: SendEmailFormData) => {
    if (!contactId) return;

    // If a template is selected and body wasn't manually edited,
    // send empty body so backend uses the original template body with styling intact
    const bodyToSend = data.template_id && !bodyManuallyEdited ? '' : data.body;

    sendEmailMutation.mutate(
      {
        contactId,
        templateId: data.template_id || undefined,
        subject: data.subject,
        body: bodyToSend,
      },
      {
        onSuccess: () => {
          setShowSendEmail(false);
          setBodyManuallyEdited(false);
          form.reset({
            template_id: null,
            subject: '',
            body: '',
          });
        },
      }
    );
  };

  const handlePreviewEmail = (email: ContactEmail, e: React.MouseEvent) => {
    e.stopPropagation();
    setPreviewEmail(email);
    setIsPreviewOpen(true);
  };

  const emails = emailsData?.emails || [];
  const pagination = emailsData?.pagination;

  const columns: ColumnDef<ContactEmail>[] = [
    {
      accessorKey: 'subject',
      header: 'Subject',
      cell: ({ row }) => (
        <span className="font-medium">{row.original.subject}</span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const email = row.original;
        const badge = (
          <Badge
            variant={
              email.status === 'sent'
                ? 'default'
                : email.status === 'failed'
                ? 'destructive'
                : 'secondary'
            }
            className="capitalize"
          >
            {email.status}
          </Badge>
        );

        if (email.status === 'failed' && email.error_message) {
          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>{badge}</TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">{email.error_message}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        }

        return badge;
      },
    },
    {
      accessorKey: 'sent_by_name',
      header: 'Sent By',
      cell: ({ row }) =>
        row.original.sent_by_name || (
          <span className="text-sm text-muted-foreground">-</span>
        ),
    },
    {
      accessorKey: 'sent_at',
      header: 'Sent At',
      cell: ({ row }) =>
        formatDistanceToNow(parseUTCDate(row.original.sent_at), {
          addSuffix: true,
          locale: defaultLocale,
        }),
    },
    {
      id: 'actions',
      header: '',
      meta: { className: 'text-right' },
      cell: ({ row }) => (
        <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => handlePreviewEmail(row.original, e)}
          >
            <Eye className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
  ];

  if (!contactId) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        No contact selected.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Send Email Section */}
        <Card>
          <CardHeader>
            <CardTitle>Send Email</CardTitle>
          </CardHeader>
          <CardContent>
            {!showSendEmail ? (
              <Button onClick={() => setShowSendEmail(true)}>
                <Plus className="mr-2 w-4 h-4" />
                Send Email
              </Button>
            ) : (
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(handleSendEmail)}
                  className="space-y-4"
                >
                  <FormField
                    control={form.control}
                    name="template_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Template (Optional)</FormLabel>
                        <Select
                          value={field.value?.toString() || 'none'}
                          onValueChange={(value) =>
                            field.onChange(
                              value === 'none' ? null : parseInt(value)
                            )
                          }
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a template or compose manually" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">
                              None (Compose manually)
                            </SelectItem>
                            {templates?.map((template) => (
                              <SelectItem
                                key={template.id}
                                value={template.id.toString()}
                              >
                                {template.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="subject"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subject</FormLabel>
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
                          <RichTextEditor
                            content={field.value}
                            onChange={(value) => {
                              field.onChange(value);
                              // Mark as manually edited only if not loading a template
                              if (!isLoadingTemplate.current) {
                                setBodyManuallyEdited(true);
                              }
                            }}
                            texts={emailVariables}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex gap-2">
                    <Button
                      type="submit"
                      disabled={sendEmailMutation.isPending}
                      loading={sendEmailMutation.isPending}
                    >
                      <Send className="mr-2 w-4 h-4" />
                      {sendEmailMutation.isPending ? 'Sending...' : 'Send Email'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowSendEmail(false);
                        form.reset({
                          template_id: null,
                          subject: '',
                          body: '',
                        });
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>

        {/* Email History Section */}
        <Card>
          <CardHeader>
            <CardTitle className="!text-lg !my-0">
              Emails ({pagination?.total || emails.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ReusableTable
              columns={columns}
              data={emails}
              loading={emailsLoading}
              showPagination={true}
              serverSidePagination={true}
              totalCount={pagination?.total || 0}
              currentPage={currentPage}
              pageSize={PAGE_SIZE}
              onPageChange={setCurrentPage}
            />
          </CardContent>
        </Card>
      </div>

      <ContentPreviewSheet
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
        title={previewEmail?.subject || 'Email Preview'}
        content={
          previewEmail ? (
            <div
              className="max-w-none prose prose-sm"
              dangerouslySetInnerHTML={{ __html: previewEmail.body }}
            />
          ) : null
        }
      />
    </>
  );
}
