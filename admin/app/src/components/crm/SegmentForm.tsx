import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useCrm } from '@/hooks/useCrm';
import { Segment } from '@/types/crm';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm, UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import SegmentConditionBuilder from './SegmentConditionBuilder';

const segmentSchema = z.object({
  name: z.string().min(1, 'Segment name is required'),
  conditions: z
    .object({
      logic: z.enum(['AND', 'OR']),
      groups: z
        .array(
          z.object({
            logic: z.enum(['AND', 'OR']),
            conditions: z
              .array(
                z
                  .object({
                    field: z
                      .string()
                      .min(1, 'Field is required')
                      .refine((val) => val && val.trim() !== '', {
                        message: 'Field is required',
                      }),
                    operator: z
                      .string()
                      .min(1, 'Operator is required')
                      .refine((val) => val && val.trim() !== '', {
                        message: 'Operator is required',
                      }),
                    value: z.union([z.string(), z.number()]),
                  })
                  .refine(
                    (data) => {
                      // Operators that don't need a value
                      const noValueOperators = ['is_empty', 'is_not_empty'];
                      if (noValueOperators.includes(data.operator)) {
                        return true;
                      }
                      // All other operators need a value
                      if (typeof data.value === 'number') return true;
                      return (
                        data.value && data.value.toString().trim() !== ''
                      );
                    },
                    { message: 'Value is required', path: ['value'] }
                  )
              )
              .min(1, 'At least one condition is required')
              .refine(
                (conditions) => {
                  const noValueOperators = ['is_empty', 'is_not_empty'];
                  return conditions.every((condition) => {
                    const fieldValid =
                      condition.field && condition.field.trim() !== '';
                    const operatorValid =
                      condition.operator && condition.operator.trim() !== '';
                    const valueValid =
                      noValueOperators.includes(condition.operator) ||
                      typeof condition.value === 'number' ||
                      (condition.value &&
                        condition.value.toString().trim() !== '');
                    return fieldValid && operatorValid && valueValid;
                  });
                },
                {
                  message: 'All condition fields must be filled',
                }
              ),
          })
        )
        .min(1, 'At least one group is required'),
    })
    .refine(
      (data) => {
        return data.groups.every((group) => group.conditions.length > 0);
      },
      {
        message: 'Each group must have at least one condition',
      }
    ),
});

type SegmentFormValues = z.infer<typeof segmentSchema>;

interface SegmentFormProps {
  segment?: Segment | null;
  onClose: () => void;
}

export default function SegmentForm({ segment, onClose }: SegmentFormProps) {
  const {
    createSegmentMutation,
    updateSegmentMutation,
    useCustomFields,
  } = useCrm();

  const { data: customFields } = useCustomFields();

  const form = useForm<SegmentFormValues>({
    resolver: zodResolver(segmentSchema),
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    defaultValues: {
      name: segment?.name || '',
      conditions: segment?.conditions || {
        logic: 'AND',
        groups: [
          {
            logic: 'AND',
            conditions: [],
          },
        ],
      },
    },
  });

  useEffect(() => {
    if (segment) {
      form.reset({
        name: segment.name,
        conditions: segment.conditions,
      });
    }
  }, [segment, form]);

  const onSubmit = (data: SegmentFormValues) => {
    if (segment) {
      updateSegmentMutation.mutate(
        {
          segmentId: segment.id,
          data: data as Segment,
        },
        {
          onSuccess: () => {
            onClose();
          },
        }
      );
    } else {
      createSegmentMutation.mutate(data as Segment, {
        onSuccess: () => {
          onClose();
        },
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Segment Name</FormLabel>
              <FormControl>
                <Input {...field} placeholder="e.g., Active Customers" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <SegmentConditionBuilder
          form={form as unknown as UseFormReturn<Segment>}
          customFields={customFields || []}
        />

        <div className="flex gap-2 justify-end pt-4 border-t">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={
              createSegmentMutation.isPending ||
              updateSegmentMutation.isPending
            }
          >
            {segment ? 'Update' : 'Create'} Segment
          </Button>
        </div>
      </form>
    </Form>
  );
}

