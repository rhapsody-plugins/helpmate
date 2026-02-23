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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useMain } from '@/contexts/MainContext';
import { useCrm } from '@/hooks/useCrm';
import { EmailSequence } from '@/types/crm';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const emailSequenceSchema = z.object({
  name: z.string().min(1, 'Sequence name is required'),
  segment_id: z.number().min(1, 'Segment is required'),
  is_active: z.number().optional(),
  steps: z
    .array(
      z.object({
        template_id: z.number().min(1, 'Template is required'),
        delay_days: z.number().min(0),
        delay_hours: z.number().min(0),
      })
    )
    .min(1, 'At least one step is required'),
});

type EmailSequenceFormValues = z.infer<typeof emailSequenceSchema>;

interface EmailSequenceFormProps {
  sequence?: EmailSequence | null;
  onClose: () => void;
}

export default function EmailSequenceForm({
  sequence,
  onClose,
}: EmailSequenceFormProps) {
  const { setPage } = useMain();
  const {
    createEmailSequenceMutation,
    updateEmailSequenceMutation,
    useEmailTemplates,
    useSegments,
  } = useCrm();

  const { data: templates, isLoading: templatesLoading } = useEmailTemplates();
  const { data: segments, isLoading: segmentsLoading } = useSegments();
  const [shouldResetForm, setShouldResetForm] = useState(false);
  const lastResetSequenceIdRef = useRef<number | null | -1>(null);

  const form = useForm<EmailSequenceFormValues>({
    resolver: zodResolver(emailSequenceSchema),
    defaultValues: {
      name: '',
      segment_id: 0,
      is_active: 1,
      steps: [
        {
          template_id: 0,
          delay_days: 0,
          delay_hours: 0,
        },
      ],
    },
  });

  // Determine when we should reset the form
  useEffect(() => {
    // For editing: wait for all data to be ready
    if (
      sequence &&
      templates !== undefined &&
      !templatesLoading &&
      segments !== undefined &&
      !segmentsLoading
    ) {
      if (sequence.id !== lastResetSequenceIdRef.current) {
        lastResetSequenceIdRef.current = sequence.id;
        setShouldResetForm(true);
      }
    }
    // For creating: wait for templates and segments
    else if (
      !sequence &&
      templates !== undefined &&
      !templatesLoading &&
      segments !== undefined &&
      !segmentsLoading
    ) {
      if (lastResetSequenceIdRef.current !== -1) {
        lastResetSequenceIdRef.current = -1;
        setShouldResetForm(true);
      }
    } else {
      setShouldResetForm(false);
    }
  }, [
    sequence,
    templates,
    templatesLoading,
    segments,
    segmentsLoading,
  ]);

  // Actually reset the form after render (ensures all fields are registered)
  useEffect(() => {
    if (!shouldResetForm) return;

    // Use requestAnimationFrame to ensure form fields are mounted
    const frameId = requestAnimationFrame(() => {
      setTimeout(() => {
        if (sequence) {
          // Editing mode - ensure steps array is properly formatted
          const formattedSteps =
            sequence.steps && sequence.steps.length > 0
              ? sequence.steps.map((step) => ({
                  template_id: step.template_id || 0,
                  delay_days: step.delay_days || 0,
                  delay_hours: step.delay_hours || 0,
                }))
              : [
                  {
                    template_id: 0,
                    delay_days: 0,
                    delay_hours: 0,
                  },
                ];

          form.reset(
            {
              name: sequence.name || '',
              segment_id: sequence.segment_id || 0,
              is_active: sequence.is_active ?? 1,
              steps: formattedSteps,
            },
            {
              keepDefaultValues: false,
            }
          );
        } else {
          // Creating mode
          form.reset(
            {
              name: '',
              segment_id: 0,
              is_active: 1,
              steps: [
                {
                  template_id: 0,
                  delay_days: 0,
                  delay_hours: 0,
                },
              ],
            },
            {
              keepDefaultValues: false,
            }
          );
        }
        setShouldResetForm(false);
      }, 100);
    });

    return () => cancelAnimationFrame(frameId);
  }, [shouldResetForm, sequence, form]);

  const addStep = () => {
    const currentSteps = form.getValues('steps') || [];
    form.setValue('steps', [
      ...currentSteps,
      {
        template_id: 0,
        delay_days: 0,
        delay_hours: 0,
      },
    ]);
  };

  const removeStep = (index: number) => {
    const currentSteps = form.getValues('steps') || [];
    form.setValue(
      'steps',
      currentSteps.filter((_, i) => i !== index)
    );
  };

  const onSubmit = (data: EmailSequenceFormValues) => {
    if (sequence) {
      updateEmailSequenceMutation.mutate(
        {
          sequenceId: sequence.id,
          data: data as EmailSequence,
        },
        {
          onSuccess: () => {
            onClose();
          },
        }
      );
    } else {
      createEmailSequenceMutation.mutate(data, {
        onSuccess: () => {
          onClose();
        },
      });
    }
  };

  const steps = form.watch('steps') || [];

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Sequence Name</FormLabel>
              <FormControl>
                <Input {...field} placeholder="e.g., Welcome Sequence" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="segment_id"
          render={({ field }) => (
            <FormItem>
              <div className="flex justify-between items-center">
                <FormLabel>Segment</FormLabel>
                <Button
                  type="button"
                  variant="link"
                  size="xs"
                  onClick={() => {
                    setPage('crm-segments');
                    onClose();
                  }}
                >
                  <Plus className="w-4 h-4" />
                  Create Segment
                </Button>
              </div>
              <FormControl>
                <Select
                  value={
                    field.value && field.value > 0
                      ? field.value.toString()
                      : undefined
                  }
                  onValueChange={(value) => field.onChange(parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select segment" />
                  </SelectTrigger>
                  <SelectContent>
                    {segments?.map((segment) => (
                      <SelectItem
                        key={segment.id}
                        value={segment.id.toString()}
                      >
                        {segment.name} ({segment.contact_count} contacts)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <FormLabel>Sequence Steps</FormLabel>
            <Button type="button" variant="outline" size="sm" onClick={addStep}>
              <Plus className="mr-2 w-4 h-4" />
              Add Step
            </Button>
          </div>

          {steps.map((step, index) => (
            <div
              key={`step-${index}-${step.template_id || 0}`}
              className="p-4 space-y-3 rounded-lg border bg-muted/50"
            >
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Step {index + 1}</span>
                {steps.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeStep(index)}
                  >
                    <Trash className="w-4 h-4" />
                  </Button>
                )}
              </div>

              <FormField
                control={form.control}
                name={`steps.${index}.template_id`}
                render={({ field }) => (
                  <FormItem>
                    <div className="flex justify-between items-center">
                      <FormLabel>Email Template</FormLabel>
                      <Button
                        type="button"
                        variant="link"
                        size="xs"
                        onClick={() => {
                          setPage('crm-emails');
                          onClose();
                        }}
                      >
                        <Plus className="w-4 h-4" />
                        Create Template
                      </Button>
                    </div>
                    <FormControl>
                      <Select
                        value={
                          field.value && field.value > 0
                            ? field.value.toString()
                            : undefined
                        }
                        onValueChange={(value) =>
                          field.onChange(parseInt(value))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select template" />
                        </SelectTrigger>
                        <SelectContent>
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
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name={`steps.${index}.delay_days`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Delay (Days)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseInt(e.target.value) || 0)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name={`steps.${index}.delay_hours`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Delay (Hours)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseInt(e.target.value) || 0)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 justify-end pt-4 border-t">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={
              createEmailSequenceMutation.isPending ||
              updateEmailSequenceMutation.isPending
            }
          >
            {sequence ? 'Update' : 'Create'} Sequence
          </Button>
        </div>
      </form>
    </Form>
  );
}
