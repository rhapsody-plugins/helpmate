import { Info } from 'lucide-react';
import { __, sprintf } from '@/lib/utils';

type FormFieldMappingCalloutProps = {
  requiredFieldLabels: string[];
  hasFormFields: boolean;
};

/**
 * Copy mirrors Helpmate_Form_Integration_UI::get_field_mapping_notice_message() (generic context).
 */
function buildFieldMappingNoticeMessage(
  requiredFieldLabels: string[],
  hasFormFields: boolean
): string {
  let message = __(
    'Make sure your form includes the fields this action needs. Then choose which form field fills each Helpmate field below.'
  );

  if (requiredFieldLabels.length > 0) {
    const list = requiredFieldLabels.join(', ');
    /* translators: %s: Comma-separated list of required Helpmate field labels for the selected action. */
    const requiredSuffix = sprintf(__('Required for this action: %s.'), list);
    message += ' ' + requiredSuffix;
  }

  if (!hasFormFields) {
    message +=
      ' ' +
      __(
        'No form fields were found yet. Add fields in your form builder, save the form, and reopen this screen.'
      );
  }

  return message;
}

export default function FormFieldMappingCallout({
  requiredFieldLabels,
  hasFormFields,
}: FormFieldMappingCalloutProps) {
  const message = buildFieldMappingNoticeMessage(requiredFieldLabels, hasFormFields);

  return (
    <div
      className="flex gap-3 p-3 rounded-lg border bg-muted/40 text-sm text-muted-foreground"
      role="note"
    >
      <Info className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
      <p className="!my-0 !leading-relaxed">{message}</p>
    </div>
  );
}
