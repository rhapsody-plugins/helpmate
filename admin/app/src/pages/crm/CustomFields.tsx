import Loading from '@/components/Loading';
import PageHeader from '@/components/PageHeader';
import PageGuard from '@/components/PageGuard';
import { ProBadge } from '@/components/ProBadge';
import { useSettings } from '@/hooks/useSettings';
import { ReusableTable } from '@/components/ReusableTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
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
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useCrm } from '@/hooks/useCrm';
import { cn } from '@/lib/utils';
import { CustomField } from '@/types/crm';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnDef } from '@tanstack/react-table';
import { Edit, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

const FIELD_TYPES = [
  'text',
  'number',
  'date',
  'textarea',
  'dropdown',
  'checkbox',
  'radio',
  'email',
  'url',
  'phone',
  'file',
  'multi_select',
  'rich_text',
] as const;

const customFieldFormSchema = z.object({
  field_label: z.string().min(1, 'Field label is required'),
  field_type: z.enum([
    'text',
    'number',
    'date',
    'textarea',
    'dropdown',
    'checkbox',
    'radio',
    'email',
    'url',
    'phone',
    'file',
    'multi_select',
    'rich_text',
  ]),
  field_options: z.array(z.string()).optional(),
  is_required: z.boolean(),
  entity_type: z.string(),
  display_order: z.number(),
});

type CustomFieldFormData = z.infer<typeof customFieldFormSchema>;

// Default task field names that cannot be deleted
const DEFAULT_TASK_FIELDS = ['priority', 'status', 'task_type'];

// Helper function to check if a field is a default task field
const isDefaultTaskField = (field: CustomField): boolean => {
  return (
    field.entity_type === 'task' &&
    DEFAULT_TASK_FIELDS.includes(field.field_name)
  );
};

export default function CustomFields() {
  const { getProQuery } = useSettings();
  const isPro = getProQuery.data ?? false;
  const {
    useCustomFields,
    createCustomFieldMutation,
    updateCustomFieldMutation,
    deleteCustomFieldMutation,
  } = useCrm();
  const [selectedEntityType, setSelectedEntityType] = useState<
    'Contact' | 'Task'
  >('Contact');
  const { data: customFields, isLoading } = useCustomFields(selectedEntityType);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingField, setEditingField] = useState<CustomField | null>(null);
  const [optionsText, setOptionsText] = useState('');

  const form = useForm<CustomFieldFormData>({
    resolver: zodResolver(customFieldFormSchema),
    defaultValues: {
      field_label: '',
      field_type: 'text',
      field_options: [],
      is_required: false,
      entity_type: selectedEntityType,
      display_order: 0,
    },
  });

  const fieldType = form.watch('field_type');

  const handleOpenDialog = (field?: CustomField) => {
    if (field) {
      setEditingField(field);
      const options = field.field_options || [];
      setOptionsText(Array.isArray(options) ? options.join('\n') : '');
      form.reset({
        field_label: field.field_label,
        field_type: field.field_type,
        field_options: options,
        is_required:
          typeof field.is_required === 'string'
            ? field.is_required === '1'
            : Boolean(field.is_required),
        entity_type: field.entity_type,
        display_order:
          typeof field.display_order === 'string'
            ? parseInt(field.display_order, 10) || 0
            : field.display_order ?? 0,
      });
    } else {
      setEditingField(null);
      setOptionsText('');
      // Convert selectedEntityType to lowercase for entity_type
      const entityType = selectedEntityType.toLowerCase();
      form.reset({
        field_label: '',
        field_type: 'text',
        field_options: [],
        is_required: false,
        entity_type: entityType,
        display_order: 0,
      });
    }
    setIsSheetOpen(true);
  };

  const handleCloseSheet = () => {
    setIsSheetOpen(false);
    setEditingField(null);
    setOptionsText('');
    form.reset();
  };

  const handleSave = (data: CustomFieldFormData) => {
    // Convert optionsText to array if needed
    const processedOptions = ['dropdown', 'radio', 'multi_select'].includes(
      data.field_type
    )
      ? optionsText
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
      : undefined;

    // Ensure entity_type is set from selectedEntityType for new fields
    const entityType = editingField
      ? data.entity_type
      : selectedEntityType.toLowerCase();

    const submitData = {
      ...data,
      entity_type: entityType,
      field_options: processedOptions,
    };

    if (editingField) {
      updateCustomFieldMutation.mutate(
        { fieldId: editingField.id, data: submitData },
        {
          onSuccess: () => handleCloseSheet(),
        }
      );
    } else {
      createCustomFieldMutation.mutate(submitData, {
        onSuccess: () => handleCloseSheet(),
      });
    }
  };

  const handleDelete = (field: CustomField) => {
    // Check if it's a default task field
    if (isDefaultTaskField(field)) {
      toast.error(
        'Cannot delete default task fields. You can edit them but not delete them.'
      );
      return;
    }

    if (
      confirm(
        'Are you sure you want to delete this custom field? All values for this field will be deleted.'
      )
    ) {
      deleteCustomFieldMutation.mutate(field.id);
    }
  };

  const columns: ColumnDef<CustomField>[] = [
    {
      accessorKey: 'field_label',
      header: 'Label',
      cell: ({ row }) => {
        const field = row.original;
        const isDefault = isDefaultTaskField(field);
        return (
          <div className="flex gap-2 items-center">
            <span className="font-medium">{field.field_label}</span>
            {isDefault && (
              <Badge variant="secondary" className="text-xs">
                Default
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'field_type',
      header: 'Type',
      cell: ({ row }) => (
        <Badge variant="outline">{row.original.field_type}</Badge>
      ),
    },
    {
      accessorKey: 'is_required',
      header: 'Required',
      cell: ({ row }) => {
        const isRequired =
          typeof row.original.is_required === 'string'
            ? row.original.is_required === '1'
            : Boolean(row.original.is_required);
        return <div>{isRequired ? 'Yes' : 'No'}</div>;
      },
    },
    {
      accessorKey: 'entity_type',
      header: 'Entity Type',
      cell: ({ row }) => <div>{row.original.entity_type}</div>,
    },
    {
      accessorKey: 'display_order',
      header: 'Order',
      cell: ({ row }) => <div>{row.original.display_order}</div>,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const field = row.original;
        const isDefault = isDefaultTaskField(field);
        return (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleOpenDialog(field)}
            >
              <Edit className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDelete(field)}
              disabled={isDefault}
              title={
                isDefault ? 'Default fields cannot be deleted' : 'Delete field'
              }
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        );
      },
    },
  ];

  if (isLoading) {
    return <Loading />;
  }

  return (
    <PageGuard page="crm-custom-fields">
      <div className="gap-0">
        <div className="relative">
          {!isPro && (
            <ProBadge
              topMessage="Create custom fields to capture and organize contact data your way."
              buttonText="Unlock Custom Fields"
              tooltipMessage={null}
            />
          )}
          <Tabs
            value={selectedEntityType}
            onValueChange={(value) => {
              if (!isPro) return;
              setSelectedEntityType(value as 'Contact' | 'Task');
              setOptionsText('');
              // Reset form when switching entity types
              form.reset({
                field_label: '',
                field_type: 'text',
                field_options: [],
                is_required: false,
                entity_type: value as 'Contact' | 'Task',
                display_order: 0,
              });
            }}
            className={cn(
              'flex flex-col gap-0 h-full',
              !isPro && 'opacity-50 cursor-not-allowed pointer-events-none'
            )}
          >
            <PageHeader
              title="Custom Fields"
              menuItems={[
                {
                  title: 'Contact',
                  status: true,
                },
                {
                  title: 'Task',
                  status: true,
                },
              ]}
              rightActions={
                <>
                  <Button
                    onClick={() => handleOpenDialog()}
                    size="sm"
                    disabled={!isPro}
                  >
                    <Plus className="mr-2 w-4 h-4" />
                    Add Custom Field
                  </Button>
                <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                  <SheetContent className="sm:!max-w-2xl">
                    <SheetHeader>
                      <SheetTitle>
                        {editingField
                          ? 'Edit Custom Field'
                          : 'Add Custom Field'}
                      </SheetTitle>
                    </SheetHeader>
                    <div className="overflow-y-auto flex-1 p-4 pt-6">
                      <Form {...form}>
                        <form
                          onSubmit={form.handleSubmit(handleSave)}
                          className="space-y-6"
                        >
                          <FormField
                            control={form.control}
                            name="field_label"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>
                                  Field Label{' '}
                                  <span className="text-red-500">*</span>
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="e.g., Company Name"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="field_type"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>
                                  Field Type{' '}
                                  <span className="text-red-500">*</span>
                                </FormLabel>
                                <Select
                                  value={field.value}
                                  onValueChange={field.onChange}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {FIELD_TYPES.map((type) => (
                                      <SelectItem key={type} value={type}>
                                        {type.charAt(0).toUpperCase() +
                                          type.slice(1).replace('_', ' ')}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          {['dropdown', 'radio', 'multi_select'].includes(
                            fieldType
                          ) && (
                            <FormField
                              control={form.control}
                              name="field_options"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Options (one per line)</FormLabel>
                                  <FormControl>
                                    <Textarea
                                      placeholder="Option 1&#10;Option 2&#10;Option 3"
                                      rows={4}
                                      value={optionsText}
                                      onChange={(e) => {
                                        setOptionsText(e.target.value);
                                      }}
                                      onBlur={() => {
                                        const options = optionsText
                                          .split('\n')
                                          .map((line) => line.trim())
                                          .filter(Boolean);
                                        field.onChange(options);
                                      }}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}
                          <FormField
                            control={form.control}
                            name="is_required"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={(checked) =>
                                      field.onChange(checked === true)
                                    }
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel>Required field</FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="display_order"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Display Order</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    value={field.value ?? ''}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      field.onChange(
                                        value === ''
                                          ? 0
                                          : parseInt(value, 10) || 0
                                      );
                                    }}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className="flex gap-2 justify-end pt-4 border-t">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setIsSheetOpen(false)}
                            >
                              Cancel
                            </Button>
                            <Button type="submit">
                              {editingField ? 'Update' : 'Create'}
                            </Button>
                          </div>
                        </form>
                      </Form>
                    </div>
                  </SheetContent>
                </Sheet>
              </>
            }
          />

          <TabsContent
            value={selectedEntityType}
            className="overflow-auto flex-1 p-6"
          >
            <Card
              className={cn(
                !isPro && 'opacity-50 cursor-not-allowed pointer-events-none'
              )}
            >
              <CardHeader>
                <CardTitle className="!text-lg !my-0">
                  {selectedEntityType} fields
                </CardTitle>
              </CardHeader>
              <CardContent>
                {customFields && customFields.length > 0 ? (
                  <ReusableTable
                    columns={columns}
                    data={customFields}
                    enableSorting={false}
                    showPagination={false}
                  />
                ) : (
                  <div className="flex flex-col justify-center items-center py-12 text-center">
                    <p className="text-muted-foreground">
                      No {selectedEntityType} custom fields yet
                    </p>
                    <Button
                      onClick={() => handleOpenDialog()}
                      variant="outline"
                      className="mt-4"
                    >
                      <Plus className="mr-2 w-4 h-4" />
                      Add Your First{' '}
                      {selectedEntityType === 'Task' ? 'Task' : 'Contact'} Field
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        </div>
      </div>
    </PageGuard>
  );
}
