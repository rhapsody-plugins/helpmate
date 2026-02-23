import Loading from '@/components/Loading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
  FormMessage,
} from '@/components/ui/form';
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
import { Textarea } from '@/components/ui/textarea';
import { useCrm } from '@/hooks/useCrm';
import { useMarkReadByEntity } from '@/hooks/useNotifications';
import { useTasks } from '@/hooks/useTasks';
import { useTeam } from '@/hooks/useTeam';
import { TaskFormData } from '@/types/crm';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronsUpDown, Loader2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { CustomFieldFormInput } from '@/pages/crm/contacts/components/CustomFieldFormInput';
import { siteToDatetimeLocal } from '@/pages/crm/contacts/utils';

const taskFormSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().max(5000).optional().or(z.literal('')),
  due_date: z.string().optional().or(z.literal('')),
  assigned_to: z
    .union([z.number(), z.null()])
    .optional()
    .refine(
      (val) => {
        if (val === null || val === undefined) return true;
        return typeof val === 'number' && !isNaN(val) && isFinite(val);
      },
      {
        message: 'Invalid user assignment',
      }
    ),
  contact_ids: z.array(z.union([z.number(), z.string()])).optional(),
  custom_fields: z.record(z.string(), z.any()).optional(),
});

interface TaskDetailsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId?: number | null;
  defaultContactId?: number | null;
}

export function TaskDetails({
  open,
  onOpenChange,
  taskId,
  defaultContactId,
}: TaskDetailsProps) {
  const { useTask, createTaskMutation, updateTaskMutation } = useTasks();
  const { useCustomFields, useContacts } = useCrm();
  const { useTeamMembers } = useTeam();
  const { mutate: markReadByEntity } = useMarkReadByEntity();
  const [contactSearch, setContactSearch] = useState('');
  const [contactPopoverOpen, setContactPopoverOpen] = useState(false);
  const [shouldResetForm, setShouldResetForm] = useState(false);
  const lastMarkedReadTaskIdRef = useRef<number | null>(null);

  const { data: task, isLoading: taskLoading } = useTask(
    taskId || null,
    !!taskId && open
  );
  const { data: customFields, isLoading: customFieldsLoading } =
    useCustomFields('task');
  const { data: teamMembers, isLoading: teamMembersLoading } = useTeamMembers();

  // Map team members to extract user objects and filter out null users
  const users =
    teamMembers
      ?.map((member) => member.user)
      .filter((user): user is NonNullable<typeof user> => user !== null)
      .map((user) => ({ id: user.id, display_name: user.display_name })) || [];

  const { data: contactsData } = useContacts({ search: contactSearch }, 1, 50);

  const form = useForm<z.infer<typeof taskFormSchema>>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: '',
      description: '',
      due_date: '',
      assigned_to: null,
      contact_ids: defaultContactId ? [Number(defaultContactId)] : [],
      custom_fields: {},
    },
  });

  const lastResetTaskIdRef = useRef<number | null | -1>(null);

  // Mark task notification as read when details sheet is opened
  useEffect(() => {
    if (!open || !taskId) {
      if (!open) lastMarkedReadTaskIdRef.current = null;
      return;
    }
    if (lastMarkedReadTaskIdRef.current !== taskId) {
      lastMarkedReadTaskIdRef.current = taskId;
      markReadByEntity({ entity_type: 'task', entity_id: taskId });
    }
  }, [open, taskId, markReadByEntity]);

  // Determine when we should reset the form
  useEffect(() => {
    if (!open) {
      lastResetTaskIdRef.current = null;
      setShouldResetForm(false);
      return;
    }

    // For editing: wait for all data to be ready
    if (
      taskId &&
      task &&
      !taskLoading &&
      customFields !== undefined &&
      !customFieldsLoading &&
      teamMembers !== undefined &&
      !teamMembersLoading
    ) {
      if (task.id !== lastResetTaskIdRef.current) {
        lastResetTaskIdRef.current = task.id;
        setShouldResetForm(true);
      }
    }
    // For creating: wait for custom fields
    else if (!taskId && customFields !== undefined && !customFieldsLoading) {
      if (lastResetTaskIdRef.current !== -1) {
        lastResetTaskIdRef.current = -1;
        setShouldResetForm(true);
      }
    } else {
      setShouldResetForm(false);
    }
  }, [
    task,
    taskId,
    open,
    taskLoading,
    customFields,
    customFieldsLoading,
    teamMembers,
    teamMembersLoading,
  ]);

  // Actually reset the form after render (ensures all fields are registered)
  useEffect(() => {
    if (!shouldResetForm || !open) return;

    // Use requestAnimationFrame to ensure form fields are mounted
    const frameId = requestAnimationFrame(() => {
      setTimeout(() => {
        if (taskId && task) {
          // Editing mode
          const customFieldsObj: Record<
            string,
            string | number | string[] | null
          > = {};
          if (task.custom_fields) {
            Object.entries(task.custom_fields).forEach(
              ([fieldId, fieldValue]) => {
                customFieldsObj[fieldId] = fieldValue.value;
              }
            );
          }

          form.reset(
            {
              title: task.title,
              description: task.description || '',
              due_date: siteToDatetimeLocal(task.due_date) || '',
              assigned_to: task.assigned_to
                ? Number(task.assigned_to)
                : null,
              contact_ids: task.contacts?.map((c) => Number(c.id)) || [],
              custom_fields: customFieldsObj,
            },
            {
              keepDefaultValues: false,
            }
          );
        } else {
          // Creating mode
          if (defaultContactId) {
            form.reset(
              {
                title: '',
                description: '',
                due_date: '',
                assigned_to: null,
                contact_ids: [Number(defaultContactId)],
                custom_fields: {},
              },
              {
                keepDefaultValues: false,
              }
            );
          } else {
            form.reset(
              {
                title: '',
                description: '',
                due_date: '',
                assigned_to: null,
                contact_ids: [],
                custom_fields: {},
              },
              {
                keepDefaultValues: false,
              }
            );
          }
        }
        setShouldResetForm(false);
      }, 0);
    });

    return () => cancelAnimationFrame(frameId);
  }, [shouldResetForm, open, taskId, task, defaultContactId, form]);

  const onSubmit = (data: z.infer<typeof taskFormSchema>) => {
    // Validate required custom fields
    if (customFields) {
      const requiredFields = customFields.filter((f) => f.is_required);
      for (const field of requiredFields) {
        const fieldValue = data.custom_fields?.[String(field.id)];
        if (
          !fieldValue ||
          (typeof fieldValue === 'string' && fieldValue.trim() === '')
        ) {
          form.setError(`custom_fields.${field.id}`, {
            type: 'required',
            message: `${field.field_label} is required`,
          });
          return;
        }
      }
    }

    // Ensure contact_ids are numbers
    const contactIds = data.contact_ids
      ? data.contact_ids
          .map((id) => (typeof id === 'string' ? Number(id) : id))
          .filter((id) => !isNaN(id))
      : undefined;

    const formData: TaskFormData = {
      ...data,
      contact_ids: contactIds,
      custom_fields: data.custom_fields
        ? Object.fromEntries(
            Object.entries(data.custom_fields)
              .filter(([, v]) => v !== undefined && v !== null && v !== '')
              .map(([k, v]) => [Number(k), v])
          )
        : undefined,
    };

    if (taskId) {
      updateTaskMutation.mutate(
        { taskId, data: formData },
        {
          onSuccess: () => {
            onOpenChange(false);
          },
        }
      );
    } else {
      createTaskMutation.mutate(formData, {
        onSuccess: () => {
          onOpenChange(false);
        },
      });
    }
  };

  const handleFormError = (errors: Record<string, { message?: string }>) => {
    console.log('Form validation errors:', errors);
    // Scroll to first error
    const firstError = Object.keys(errors)[0];
    if (firstError) {
      const element = document.querySelector(`[name="${firstError}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  const selectedContactIds = (form.watch('contact_ids') || []).map((id) =>
    Number(id)
  );
  const contacts = contactsData?.contacts || [];
  const selectedContacts = contacts.filter((c) =>
    selectedContactIds.includes(Number(c.id))
  );

  const toggleContact = (contactId: number) => {
    const current = selectedContactIds;
    const updated = current.includes(contactId)
      ? current.filter((id) => id !== contactId)
      : [...current, contactId];
    form.setValue('contact_ids', updated);
  };

  const removeContact = (contactId: number) => {
    form.setValue(
      'contact_ids',
      selectedContactIds.filter((id) => id !== contactId)
    );
  };

  const isSubmitting =
    createTaskMutation.isPending || updateTaskMutation.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:!max-w-2xl">
        <SheetHeader>
          <SheetTitle>{taskId ? 'Edit Task' : 'Create Task'}</SheetTitle>
        </SheetHeader>

        {taskLoading ? (
          <Loading />
        ) : (
          <div className="overflow-y-auto flex-1 p-4 pt-6">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit, handleFormError)}
                className="space-y-6"
              >
                {/* Title */}
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title *</FormLabel>
                      <FormControl>
                        <Input placeholder="Task title" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Description */}
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Task description"
                          rows={4}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {/* Due Date */}
                  <FormField
                    control={form.control}
                    name="due_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Due Date</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Assigned To */}
                  <FormField
                    control={form.control}
                    name="assigned_to"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Assigned To</FormLabel>
                        <Select
                          value={
                            field.value !== null && field.value !== undefined
                              ? String(field.value)
                              : 'unassigned'
                          }
                          onValueChange={(value) => {
                            if (value === 'unassigned') {
                              field.onChange(null);
                            } else {
                              const numValue = Number(value);
                              if (!isNaN(numValue)) {
                                field.onChange(numValue);
                              }
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Unassigned" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned">
                              Unassigned
                            </SelectItem>
                            {users?.map((user) => (
                              <SelectItem key={user.id} value={String(user.id)}>
                                {user.display_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Custom Fields */}
                {customFields && customFields.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium">Task Details</h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {customFields.map((field) => (
                        <CustomFieldFormInput
                          key={field.id}
                          form={form as any}
                          field={field}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Associated Contacts */}
                <div className="space-y-2">
                  <FormLabel>Associated Contacts</FormLabel>
                  <Popover
                    open={contactPopoverOpen}
                    onOpenChange={setContactPopoverOpen}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="justify-between w-full"
                      >
                        {selectedContactIds.length > 0
                          ? `${selectedContactIds.length} contact(s) selected`
                          : 'Select contacts'}
                        <ChevronsUpDown className="ml-2 w-4 h-4 opacity-50 shrink-0" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 w-full">
                      <Command>
                        <CommandInput
                          placeholder="Search contacts..."
                          value={contactSearch}
                          onValueChange={setContactSearch}
                        />
                        <CommandEmpty>No contacts found.</CommandEmpty>
                        <CommandGroup className="overflow-y-auto max-h-64">
                          {contacts.map((contact) => (
                            <CommandItem
                              key={contact.id}
                              onSelect={() => toggleContact(contact.id)}
                            >
                              <Checkbox
                                checked={selectedContactIds.includes(
                                  Number(contact.id)
                                )}
                                className="mr-2"
                              />
                              {contact.email} ({contact.first_name}{' '}
                              {contact.last_name})
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>

                  {selectedContacts.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedContacts.map((contact) => (
                        <Badge key={contact.id} variant="secondary">
                          {contact.email}
                          <button
                            type="button"
                            onClick={() => removeContact(contact.id)}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Form Actions */}
                <div className="flex gap-2 justify-end pt-4 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && (
                      <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                    )}
                    {taskId ? 'Update' : 'Create'} Task
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
