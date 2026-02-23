import {
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
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import MultipleSelector, { Option } from '@/components/ui/multiselect';
import RichTextEditor from '@/components/RichTextEditor';
import { CustomField } from '@/types/crm';
import type { ContactFormData } from '../schemas';
import { UseFormReturn } from 'react-hook-form';

interface CustomFieldFormInputProps {
  form: UseFormReturn<ContactFormData>;
  field: CustomField;
}

export function CustomFieldFormInput({
  form,
  field,
}: CustomFieldFormInputProps) {
  const fieldName = `custom_fields.${field.id}` as const;

  switch (field.field_type) {
    case 'textarea':
      return (
        <FormField
          control={form.control}
          name={fieldName}
          render={({ field: formField }) => (
            <FormItem>
              <FormLabel>
                {field.field_label}
                {field.is_required && <span className="text-red-500">*</span>}
              </FormLabel>
              <FormControl>
                <Textarea
                  value={formField.value || ''}
                  onChange={(e) => formField.onChange(e.target.value)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      );
    case 'dropdown':
      return (
        <FormField
          control={form.control}
          name={fieldName}
          render={({ field: formField }) => (
            <FormItem>
              <FormLabel>
                {field.field_label}
                {field.is_required && <span className="text-red-500">*</span>}
              </FormLabel>
              <Select
                value={formField.value || ''}
                onValueChange={formField.onChange}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={`Select ${field.field_label}`} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {field.field_options?.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      );
    case 'radio':
      return (
        <FormField
          control={form.control}
          name={fieldName}
          render={({ field: formField }) => (
            <FormItem className="space-y-3">
              <FormLabel>
                {field.field_label}
                {field.is_required && <span className="text-red-500">*</span>}
              </FormLabel>
              <FormControl>
                <RadioGroup
                  value={formField.value || ''}
                  onValueChange={formField.onChange}
                >
                  {field.field_options?.map((option) => (
                    <div key={option} className="flex items-center space-x-2">
                      <RadioGroupItem value={option} id={`${fieldName}-${option}`} />
                      <label
                        htmlFor={`${fieldName}-${option}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {option}
                      </label>
                    </div>
                  ))}
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      );
    case 'checkbox':
      return (
        <FormField
          control={form.control}
          name={fieldName}
          render={({ field: formField }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
              <FormControl>
                <Checkbox
                  checked={formField.value || false}
                  onCheckedChange={formField.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>
                  {field.field_label}
                  {field.is_required && <span className="text-red-500">*</span>}
                </FormLabel>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
      );
    case 'number':
      return (
        <FormField
          control={form.control}
          name={fieldName}
          render={({ field: formField }) => (
            <FormItem>
              <FormLabel>
                {field.field_label}
                {field.is_required && <span className="text-red-500">*</span>}
              </FormLabel>
              <FormControl>
                <Input
                  type="number"
                  value={formField.value || ''}
                  onChange={(e) => formField.onChange(e.target.value)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      );
    case 'date':
      return (
        <FormField
          control={form.control}
          name={fieldName}
          render={({ field: formField }) => (
            <FormItem>
              <FormLabel>
                {field.field_label}
                {field.is_required && <span className="text-red-500">*</span>}
              </FormLabel>
              <FormControl>
                <Input
                  type="date"
                  value={formField.value || ''}
                  onChange={(e) => formField.onChange(e.target.value)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      );
    case 'url':
      return (
        <FormField
          control={form.control}
          name={fieldName}
          render={({ field: formField }) => (
            <FormItem>
              <FormLabel>
                {field.field_label}
                {field.is_required && <span className="text-red-500">*</span>}
              </FormLabel>
              <FormControl>
                <Input
                  type="url"
                  placeholder="https://example.com"
                  value={formField.value || ''}
                  onChange={(e) => formField.onChange(e.target.value)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      );
    case 'phone':
      return (
        <FormField
          control={form.control}
          name={fieldName}
          render={({ field: formField }) => (
            <FormItem>
              <FormLabel>
                {field.field_label}
                {field.is_required && <span className="text-red-500">*</span>}
              </FormLabel>
              <FormControl>
                <Input
                  type="tel"
                  placeholder="+1 (555) 123-4567"
                  value={formField.value || ''}
                  onChange={(e) => formField.onChange(e.target.value)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      );
    case 'multi_select':
      return (
        <FormField
          control={form.control}
          name={fieldName}
          render={({ field: formField }) => (
            <FormItem>
              <FormLabel>
                {field.field_label}
                {field.is_required && <span className="text-red-500">*</span>}
              </FormLabel>
              <FormControl>
                <MultipleSelector
                  value={
                    Array.isArray(formField.value)
                      ? formField.value.map((val) => ({
                          value: val,
                          label: val,
                        }))
                      : []
                  }
                  onChange={(options: Option[]) => {
                    formField.onChange(options.map((opt) => opt.value));
                  }}
                  options={
                    field.field_options?.map((option) => ({
                      value: option,
                      label: option,
                    })) || []
                  }
                  placeholder={`Select ${field.field_label}...`}
                  emptyIndicator="No options available"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      );
    case 'file':
      return (
        <FormField
          control={form.control}
          name={fieldName}
          render={({ field: formField }) => (
            <FormItem>
              <FormLabel>
                {field.field_label}
                {field.is_required && <span className="text-red-500">*</span>}
              </FormLabel>
              <FormControl>
                <div className="space-y-2">
                  <Input
                    type="file"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        formField.onChange(file.name);
                      }
                    }}
                  />
                  {formField.value && (
                    <p className="text-sm text-muted-foreground">
                      Current file: {formField.value}
                    </p>
                  )}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      );
    case 'rich_text':
      return (
        <FormField
          control={form.control}
          name={fieldName}
          render={({ field: formField }) => (
            <FormItem>
              <FormLabel>
                {field.field_label}
                {field.is_required && <span className="text-red-500">*</span>}
              </FormLabel>
              <FormControl>
                <RichTextEditor
                  content={formField.value || ''}
                  onChange={formField.onChange}
                  useMarkdown={false}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      );
    default:
      return (
        <FormField
          control={form.control}
          name={fieldName}
          render={({ field: formField }) => (
            <FormItem>
              <FormLabel>
                {field.field_label}
                {field.is_required && <span className="text-red-500">*</span>}
              </FormLabel>
              <FormControl>
                <Input
                  type={field.field_type === 'email' ? 'email' : 'text'}
                  value={formField.value || ''}
                  onChange={(e) => formField.onChange(e.target.value)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      );
  }
}

