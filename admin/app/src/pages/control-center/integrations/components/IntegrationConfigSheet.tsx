import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
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
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import type { UseQueryResult } from '@tanstack/react-query';
import IntegrationFormsSheetStates from './IntegrationFormsSheetStates';
import { UNMAPPED_FIELD, type IntegrationAction, type IntegrationForm } from '../types';

type FormConfigState = {
  enabled: boolean;
  action: string;
  field_map: Record<string, string>;
};

type IntegrationConfigSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  idPrefix: string;
  query: UseQueryResult<
    {
      installed: boolean;
      forms: IntegrationForm[];
      actions: IntegrationAction[];
    },
    Error
  >;
  createFormUrl: string;
  notInstalledText: string;
  primaryCtaText: string;
  emptySupportingText: string;
  configs: Record<number, FormConfigState>;
  isPro: boolean;
  saving: boolean;
  onUpdateConfig: (formId: number, patch: Partial<FormConfigState>) => void;
  onUpdateFieldMap: (formId: number, targetField: string, value: string) => void;
  onSave: () => void;
};

export default function IntegrationConfigSheet({
  open,
  onOpenChange,
  title,
  idPrefix,
  query,
  createFormUrl,
  notInstalledText,
  primaryCtaText,
  emptySupportingText,
  configs,
  isPro,
  saving,
  onUpdateConfig,
  onUpdateFieldMap,
  onSave,
}: IntegrationConfigSheetProps) {
  const forms = query.data?.forms ?? [];
  const actions = query.data?.actions ?? [];
  const showMapping = !!query.data?.installed && forms.length > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col w-full sm:max-w-lg overflow-hidden">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <div className="p-4 flex flex-col flex-1 min-h-0 gap-4 overflow-y-auto">
          <IntegrationFormsSheetStates
            query={query}
            notInstalledText={notInstalledText}
            createFormUrl={createFormUrl}
            primaryCtaText={primaryCtaText}
            emptySupportingText={emptySupportingText}
          />
          {showMapping ? (
            <div className="flex-1 min-h-0 space-y-4 pr-1">
              {forms.map((form) => {
                const config = configs[form.id] ?? {
                  enabled: false,
                  action: '',
                  field_map: {},
                };
                const selectedAction = actions.find((a) => a.id === config.action);
                const mappableFields = selectedAction?.mappable_fields ?? [];

                return (
                  <Card key={form.id} className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h4 className="!text-base !font-semibold !my-0">{form.title}</h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          Form ID: {form.id}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`${idPrefix}-enabled-${form.id}`}>
                          Enabled
                        </Label>
                        <Switch
                          id={`${idPrefix}-enabled-${form.id}`}
                          checked={config.enabled}
                          onCheckedChange={(checked) =>
                            onUpdateConfig(form.id, { enabled: checked })
                          }
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 mt-4">
                      <div>
                        <Label>Action</Label>
                        <Select
                          value={config.action || undefined}
                          onValueChange={(value) =>
                            onUpdateConfig(form.id, { action: value, field_map: {} })
                          }
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select action" />
                          </SelectTrigger>
                          <SelectContent>
                            {actions.map((action) => {
                              const isProAction = action.tier === 'pro';
                              const disabled = isProAction && !isPro;
                              return (
                                <SelectItem
                                  key={action.id}
                                  value={action.id}
                                  disabled={disabled}
                                >
                                  {action.label}
                                  {isProAction ? ' (Pro)' : ''}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {selectedAction?.verification_contact_required ? (
                      <p className="mt-3 text-xs text-amber-700 dark:text-amber-500">
                        Order tracker verification is on: map at least one of Email or
                        Phone so customers can confirm the order.
                      </p>
                    ) : null}

                    {mappableFields.length > 0 ? (
                      <div className="mt-4 space-y-3">
                        <p className="!text-md !mb-3 font-medium !text-muted-foreground">
                          Field Mapping:
                        </p>
                        {mappableFields.map((field) => {
                          const raw = config.field_map[field.key] ?? '';
                          const selectValue = raw === '' ? UNMAPPED_FIELD : raw;
                          return (
                            <div key={field.key} className="grid grid-cols-1 gap-1">
                              <Label>
                                {field.label}
                                {field.required ? (
                                  <span className="text-destructive"> *</span>
                                ) : null}
                              </Label>
                              <Select
                                value={selectValue}
                                onValueChange={(value) =>
                                  onUpdateFieldMap(form.id, field.key, value)
                                }
                              >
                                <SelectTrigger className="mt-0.5">
                                  <SelectValue placeholder="None" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value={UNMAPPED_FIELD}>None</SelectItem>
                                  {form.fields.map((f) => (
                                    <SelectItem key={f.name} value={f.name}>
                                      {f.name}
                                      {f.type ? ` (${f.type})` : ''}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </Card>
                );
              })}
            </div>
          ) : null}
        </div>
        {showMapping ? (
          <SheetFooter>
            <Button
              className="self-end"
              type="button"
              onClick={onSave}
              disabled={saving || query.isLoading}
            >
              Save mapping
            </Button>
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
