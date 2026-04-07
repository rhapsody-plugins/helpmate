import { Button } from '@/components/ui/button';
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
import {
  CustomField,
  Segment,
  SegmentCondition,
  SegmentConditionGroup,
} from '@/types/crm';
import { Plus, Trash, X } from 'lucide-react';
import { UseFormReturn } from 'react-hook-form';

interface SegmentConditionBuilderProps {
  form: UseFormReturn<Segment>;
  customFields: CustomField[];
}

const STANDARD_FIELDS = [
  { value: 'first_name', label: 'First Name' },
  { value: 'last_name', label: 'Last Name' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'city', label: 'City' },
  { value: 'state', label: 'State' },
  { value: 'country', label: 'Country' },
  { value: 'zip_code', label: 'Zip Code' },
  { value: 'status', label: 'Status' },
  { value: 'date_of_birth', label: 'Date of Birth' },
  { value: 'lp_enrolled_course_ids', label: 'LearnPress: Enrolled Course ID' },
  { value: 'lp_completed_course_ids', label: 'LearnPress: Completed Course ID' },
  { value: 'lp_in_progress_course_ids', label: 'LearnPress: In Progress Course ID' },
  { value: 'lp_completed_lesson_ids', label: 'LearnPress: Completed Lesson ID' },
  { value: 'tutor_enrolled_course_ids', label: 'Tutor LMS: Enrolled Course ID' },
  { value: 'tutor_completed_course_ids', label: 'Tutor LMS: Completed Course ID' },
  { value: 'tutor_in_progress_course_ids', label: 'Tutor LMS: In Progress Course ID' },
  { value: 'tutor_completed_lesson_ids', label: 'Tutor LMS: Completed Lesson ID' },
];

const OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not Equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'not_contains', label: 'Does Not Contain' },
  { value: 'starts_with', label: 'Starts With' },
  { value: 'ends_with', label: 'Ends With' },
  { value: 'greater_than', label: 'Greater Than' },
  { value: 'less_than', label: 'Less Than' },
  { value: 'greater_equal', label: 'Greater or Equal' },
  { value: 'less_equal', label: 'Less or Equal' },
  { value: 'is_empty', label: 'Is Empty' },
  { value: 'is_not_empty', label: 'Is Not Empty' },
];

const LEARNPRESS_TOKEN_FIELDS = new Set([
  'lp_enrolled_course_ids',
  'lp_completed_course_ids',
  'lp_in_progress_course_ids',
  'lp_completed_lesson_ids',
  'tutor_enrolled_course_ids',
  'tutor_completed_course_ids',
  'tutor_in_progress_course_ids',
  'tutor_completed_lesson_ids',
]);

const INTERNAL_LMS_FIELDS = new Set([
  'lp_enrolled_course_ids',
  'lp_completed_course_ids',
  'lp_in_progress_course_ids',
  'lp_completed_lesson_ids',
  'lp_last_synced_at',
  'tutor_enrolled_course_ids',
  'tutor_completed_course_ids',
  'tutor_in_progress_course_ids',
  'tutor_completed_lesson_ids',
  'tutor_last_synced_at',
]);

export default function SegmentConditionBuilder({
  form,
  customFields,
}: SegmentConditionBuilderProps) {
  const groups = form.watch('conditions.groups') || [];
  const topLevelLogic = form.watch('conditions.logic') || 'AND';

  const allFields = [
    ...STANDARD_FIELDS,
    ...customFields
      .filter((cf) => !INTERNAL_LMS_FIELDS.has(cf.field_name))
      .map((cf) => ({
        value: cf.field_name,
        label: cf.field_label,
      })),
  ].filter(
    (field, index, arr) => arr.findIndex((f) => f.value === field.value) === index
  );

  const addGroup = () => {
    const currentGroups = form.getValues('conditions.groups') || [];
    form.setValue('conditions.groups', [
      ...currentGroups,
      {
        logic: 'AND',
        conditions: [],
      },
    ]);
  };

  const removeGroup = (groupIndex: number) => {
    const currentGroups = form.getValues('conditions.groups') || [];
    form.setValue(
      'conditions.groups',
      currentGroups.filter(
        (_: SegmentConditionGroup, i: number) => i !== groupIndex
      )
    );
  };

  const addCondition = (groupIndex: number) => {
    const currentGroups = form.getValues('conditions.groups') || [];
    const group = currentGroups[groupIndex];
    form.setValue(`conditions.groups.${groupIndex}.conditions`, [
      ...(group.conditions || []),
      {
        field: '',
        operator: 'equals',
        value: '',
      },
    ]);
  };

  const removeCondition = (groupIndex: number, conditionIndex: number) => {
    const currentGroups = form.getValues('conditions.groups') || [];
    const group = currentGroups[groupIndex];
    form.setValue(
      `conditions.groups.${groupIndex}.conditions`,
      group.conditions.filter(
        (_: SegmentCondition, i: number) => i !== conditionIndex
      )
    );
  };

  const getOperatorNeedsValue = (operator: string) => {
    return !['is_empty', 'is_not_empty'].includes(operator);
  };

  const getOperatorsForField = (fieldName: string) => {
    if (LEARNPRESS_TOKEN_FIELDS.has(fieldName)) {
      return OPERATORS.filter((op) =>
        ['contains', 'not_contains', 'is_empty', 'is_not_empty'].includes(op.value)
      );
    }
    return OPERATORS;
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <FormLabel>Conditions</FormLabel>
        <div className="flex gap-2 items-center">
          <span className="text-sm text-muted-foreground">Match</span>
          <Select
            value={topLevelLogic}
            onValueChange={(value) => form.setValue('conditions.logic', value as 'AND' | 'OR')}
          >
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="AND">All Groups</SelectItem>
              <SelectItem value="OR">Any Group</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {groups.map((group: SegmentConditionGroup, groupIndex: number) => {
        const groupErrors = form.formState.errors.conditions?.groups?.[groupIndex];

        // Check for errors - both array-level (empty group) and individual condition errors
        let hasConditionErrors = false;
        let errorMessage = '';

        if (groupErrors?.conditions) {
          if (typeof groupErrors.conditions === 'object' && 'message' in groupErrors.conditions) {
            // Array-level error (e.g., "At least one condition is required")
            hasConditionErrors = true;
            errorMessage = groupErrors.conditions.message || '';
          } else if (Array.isArray(groupErrors.conditions) && groupErrors.conditions.some(error => error)) {
            // Individual condition errors
            hasConditionErrors = true;
            errorMessage = 'Please fill in all fields for each condition in this group';
          }
        }

        return (
          <div
            key={groupIndex}
            className="p-4 space-y-3 rounded-lg border bg-muted/50"
          >
            <div className="flex justify-between items-center">
              <div className="flex gap-2 items-center">
                <span className="text-sm font-medium">
                  Group {groupIndex + 1}
                </span>
                <Select
                  value={group.logic || 'AND'}
                  onValueChange={(value) =>
                    form.setValue(`conditions.groups.${groupIndex}.logic`, value as 'AND' | 'OR')
                  }
                >
                  <SelectTrigger className="w-24 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AND">All</SelectItem>
                    <SelectItem value="OR">Any</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {groups.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeGroup(groupIndex)}
                >
                  <Trash className="w-4 h-4" />
                </Button>
              )}
            </div>

            {hasConditionErrors && (
              <div className="p-2 text-sm rounded text-destructive bg-destructive/10">
                {errorMessage}
              </div>
            )}

            <div className="space-y-2">
            {(group.conditions || []).map(
              (_: SegmentCondition, conditionIndex: number) => (
                <div
                  key={conditionIndex}
                  className="flex gap-2 items-start p-2 rounded border bg-background"
                >
                  <FormField
                    control={form.control}
                    name={`conditions.groups.${groupIndex}.conditions.${conditionIndex}.field`}
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormControl>
                          <Select
                            value={field.value || undefined}
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select field" />
                            </SelectTrigger>
                            <SelectContent>
                              {allFields.map((field) => (
                                <SelectItem
                                  key={field.value}
                                  value={field.value}
                                >
                                  {field.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`conditions.groups.${groupIndex}.conditions.${conditionIndex}.operator`}
                    render={({ field }) => (
                      <FormItem className="w-40">
                        {(() => {
                          const selectedField =
                            form.watch(
                              `conditions.groups.${groupIndex}.conditions.${conditionIndex}.field`
                            ) || '';
                          const allowedOperators = getOperatorsForField(selectedField);
                          return (
                        <FormControl>
                          <Select
                            value={field.value || undefined}
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Operator" />
                            </SelectTrigger>
                            <SelectContent>
                              {allowedOperators.map((op) => (
                                <SelectItem key={op.value} value={op.value}>
                                  {op.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                          );
                        })()}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {getOperatorNeedsValue(
                    form.watch(
                      `conditions.groups.${groupIndex}.conditions.${conditionIndex}.operator`
                    ) || 'equals'
                  ) && (
                    <FormField
                      control={form.control}
                      name={`conditions.groups.${groupIndex}.conditions.${conditionIndex}.value`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Value"
                              value={field.value || ''}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeCondition(groupIndex, conditionIndex)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addCondition(groupIndex)}
              className="w-full"
            >
              <Plus className="mr-2 w-4 h-4" />
              Add Condition
            </Button>
          </div>
        </div>
      );
      })}

      {form.formState.errors.conditions?.message && (
        <div className="p-2 text-sm rounded text-destructive bg-destructive/10">
          {form.formState.errors.conditions.message}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        onClick={addGroup}
        className="w-full"
      >
        <Plus className="mr-2 w-4 h-4" />
        Add Group
      </Button>
    </div>
  );
}
