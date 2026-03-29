import PageGuard from '@/components/PageGuard';
import PageHeader from '@/components/PageHeader';
import { Badge } from '@/components/ui/badge';
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
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { useSettings } from '@/hooks/useSettings';
import api from '@/lib/axios';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Plug, ScrollText } from 'lucide-react';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';

const UNMAPPED_FIELD = '__helpmate_cf7_none__';

/** REST `integration` column value for Contact Form 7 (matches PHP). */
export const INTEGRATION_SLUG_CONTACT_FORM_7 = 'contact_form_7';

const EVENTS_PAGE_SIZE = 25;

const EVENT_STATUS_OPTIONS = [
  { value: '__all__', label: 'All statuses' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'validated', label: 'Validated' },
  { value: 'rejected_validation', label: 'Rejected (validation)' },
  { value: 'processed', label: 'Processed' },
  { value: 'failed_transient', label: 'Failed (transient)' },
  { value: 'failed_terminal', label: 'Failed (terminal)' },
] as const;

export type CF7MappableField = {
  key: string;
  label: string;
  required: boolean;
};

type CF7Action = {
  id: string;
  label: string;
  tier: 'free' | 'pro';
  required_fields: string[];
  mappable_fields: CF7MappableField[];
  verification_contact_required?: boolean;
};

type CF7Form = {
  id: number;
  title: string;
  fields: Array<{ name: string; type: string }>;
  config: {
    enabled: boolean;
    action: string;
    field_map: Record<string, string>;
  };
};

type CF7FormsResponse = {
  error: boolean;
  installed: boolean;
  actions: CF7Action[];
  forms: CF7Form[];
};

type FormConfigState = {
  enabled: boolean;
  action: string;
  field_map: Record<string, string>;
};

type IntegrationEventRow = {
  id: number;
  integration: string;
  source: string;
  form_id: number | null;
  action: string;
  status: string;
  error_code: string | null;
  error_message: string | null;
  payload_hash: string | null;
  dedup_key: string | null;
  metadata: Record<string, unknown>;
  created_at: number | string;
};

type IntegrationEventsResponse = {
  error: boolean;
  data: IntegrationEventRow[];
  pagination: {
    total: number;
    page: number;
    per_page: number;
    total_pages: number;
  };
};

function statusBadgeVariant(
  status: string
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'processed') return 'default';
  if (status === 'validated' || status === 'accepted') return 'secondary';
  if (
    status.startsWith('failed') ||
    status === 'rejected_validation'
  ) {
    return 'destructive';
  }
  return 'outline';
}

function formatEventTime(createdAt: number | string): string {
  const n =
    typeof createdAt === 'string' ? parseInt(createdAt, 10) : createdAt;
  if (Number.isNaN(n)) return '—';
  const ms = n < 1e12 ? n * 1000 : n;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function truncate(str: string | null | undefined, max: number): string {
  if (!str) return '—';
  const t = str.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

type IntegrationLogsSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  integrationSlug: string;
  title: string;
  description?: string;
};

function IntegrationLogsSheet({
  open,
  onOpenChange,
  integrationSlug,
  title,
  description,
}: IntegrationLogsSheetProps) {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('__all__');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      setPage(1);
      setExpandedId(null);
    }
  }, [open, integrationSlug]);

  const statusParam =
    statusFilter === '__all__' ? undefined : statusFilter;

  const eventsQuery = useQuery<IntegrationEventsResponse, Error>({
    queryKey: [
      'integration-events',
      integrationSlug,
      page,
      statusParam ?? '',
    ],
    queryFn: async () => {
      const response = await api.get<IntegrationEventsResponse>(
        '/integrations/events',
        {
          params: {
            integration: integrationSlug,
            page,
            per_page: EVENTS_PAGE_SIZE,
            ...(statusParam ? { status: statusParam } : {}),
          },
        }
      );
      return response.data;
    },
    enabled: open && !!integrationSlug,
    refetchOnWindowFocus: false,
  });

  const { total, total_pages } = eventsQuery.data?.pagination ?? {
    total: 0,
    total_pages: 1,
  };

  const rows = eventsQuery.data?.data ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col w-full sm:max-w-3xl gap-0 p-0 h-full">
        <SheetHeader>
          <div className="flex-1 min-w-0 space-y-1 text-left">
            <SheetTitle className="!flex flex-row flex-wrap items-center gap-2 !text-left">
              <ScrollText className="size-5 shrink-0 text-muted-foreground" />
              <span>
                {title} — Activity Log
              </span>
            </SheetTitle>
            {description ? (
              <SheetDescription className="!ml-7">{description}</SheetDescription>
            ) : null}
          </div>
        </SheetHeader>
        <div className="px-6 py-3 shrink-0 border-b bg-muted/20">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <Label htmlFor="integration-log-status" className="shrink-0">
                Status
              </Label>
              <Select
                value={statusFilter}
                onValueChange={(v) => {
                  setStatusFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger id="integration-log-status" className="w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              {eventsQuery.isFetching && !eventsQuery.data
                ? 'Loading…'
                : `${total.toLocaleString()} event${total === 1 ? '' : 's'}`}
            </p>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6">
          <div className="py-4">
            {eventsQuery.isError ? (
              <p className="text-sm text-destructive">
                Could not load events. Try again.
              </p>
            ) : eventsQuery.isLoading ? (
              <div className="space-y-2 animate-pulse">
                <div className="h-10 bg-muted rounded-md" />
                <div className="h-10 bg-muted rounded-md" />
                <div className="h-10 bg-muted rounded-md" />
              </div>
            ) : rows.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                No events recorded for this integration yet. Submit a mapped
                form to see entries here.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>Time</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Form</TableHead>
                    <TableHead className="min-w-[140px]">Summary</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const hasMeta =
                      row.metadata &&
                      typeof row.metadata === 'object' &&
                      Object.keys(row.metadata).length > 0;
                    const expandable =
                      hasMeta ||
                      !!(row.error_message && row.error_message.length > 48);
                    const isOpen = expandedId === row.id;
                    return (
                      <Fragment key={row.id}>
                        <TableRow
                          className={cn(
                            expandable && 'cursor-pointer hover:bg-muted/50'
                          )}
                          onClick={() => {
                            if (!expandable) return;
                            setExpandedId(isOpen ? null : row.id);
                          }}
                        >
                          <TableCell className="align-middle w-10 p-2">
                            {expandable ? (
                              isOpen ? (
                                <ChevronDown className="size-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="size-4 text-muted-foreground" />
                              )
                            ) : null}
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap">
                            {formatEventTime(row.created_at)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusBadgeVariant(row.status)}>
                              {row.status.replace(/_/g, ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {row.action}
                          </TableCell>
                          <TableCell className="text-xs">
                            {row.form_id != null ? `#${row.form_id}` : '—'}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px]">
                            {row.error_code ? (
                              <span className="text-destructive font-medium">
                                {row.error_code}
                              </span>
                            ) : null}
                            {row.error_code && row.error_message ? ' · ' : null}
                            <span className="line-clamp-2">
                              {truncate(row.error_message, 80)}
                            </span>
                          </TableCell>
                        </TableRow>
                        {isOpen ? (
                          <TableRow>
                            <TableCell colSpan={6} className="bg-muted/30 p-4">
                              <div className="space-y-3 text-xs font-mono">
                                {row.error_message ? (
                                  <div>
                                    <span className="font-sans font-semibold text-foreground">
                                      Message
                                    </span>
                                    <pre className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">
                                      {row.error_message}
                                    </pre>
                                  </div>
                                ) : null}
                                {row.payload_hash ? (
                                  <div>
                                    <span className="font-sans font-semibold text-foreground">
                                      Payload hash
                                    </span>
                                    <p className="mt-1 break-all text-muted-foreground">
                                      {row.payload_hash}
                                    </p>
                                  </div>
                                ) : null}
                                {row.dedup_key ? (
                                  <div>
                                    <span className="font-sans font-semibold text-foreground">
                                      Dedup key
                                    </span>
                                    <p className="mt-1 break-all text-muted-foreground">
                                      {row.dedup_key}
                                    </p>
                                  </div>
                                ) : null}
                                {hasMeta ? (
                                  <div>
                                    <span className="font-sans font-semibold text-foreground">
                                      Metadata
                                    </span>
                                    <pre className="mt-1 max-h-48 overflow-auto rounded-md border bg-background p-2 text-[11px] leading-relaxed">
                                      {JSON.stringify(row.metadata, null, 2)}
                                    </pre>
                                  </div>
                                ) : null}
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 px-6 py-4 border-t shrink-0 bg-background">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1 || eventsQuery.isFetching}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <span className="text-xs text-muted-foreground tabular-nums">
            Page {page} of {Math.max(1, total_pages)}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= total_pages || eventsQuery.isFetching}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function Integrations() {
  const { updateSettingsMutation, getProQuery } = useSettings();
  const isPro = getProQuery.data ?? false;
  const [sheetOpen, setSheetOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [cf7Configs, setCf7Configs] = useState<Record<number, FormConfigState>>(
    {}
  );

  const cf7FormsQuery = useQuery<CF7FormsResponse, Error>({
    queryKey: ['cf7-forms'],
    queryFn: async () => {
      const response = await api.get('/integrations/cf7/forms');
      return response.data;
    },
    refetchOnWindowFocus: false,
    enabled: sheetOpen,
  });

  useEffect(() => {
    const forms = cf7FormsQuery.data?.forms ?? [];
    const initial: Record<number, FormConfigState> = {};
    forms.forEach((form) => {
      initial[form.id] = {
        enabled: !!form.config.enabled,
        action: form.config.action ?? '',
        field_map: form.config.field_map ?? {},
      };
    });
    setCf7Configs(initial);
  }, [cf7FormsQuery.data?.forms]);

  const actionMap = useMemo(() => {
    const map: Record<string, CF7Action> = {};
    (cf7FormsQuery.data?.actions ?? []).forEach((action) => {
      map[action.id] = action;
    });
    return map;
  }, [cf7FormsQuery.data?.actions]);

  const updateFormConfig = useCallback(
    (formId: number, patch: Partial<FormConfigState>) => {
      setCf7Configs((prev) => ({
        ...prev,
        [formId]: {
          enabled: prev[formId]?.enabled ?? false,
          action: prev[formId]?.action ?? '',
          field_map: prev[formId]?.field_map ?? {},
          ...patch,
        },
      }));
    },
    []
  );

  const updateFieldMap = useCallback(
    (formId: number, targetField: string, sourceFieldName: string) => {
      const value =
        sourceFieldName === UNMAPPED_FIELD ? '' : sourceFieldName;
      setCf7Configs((prev) => {
        const nextMap = { ...(prev[formId]?.field_map ?? {}) };
        if (value === '') {
          delete nextMap[targetField];
        } else {
          nextMap[targetField] = value;
        }
        return {
          ...prev,
          [formId]: {
            enabled: prev[formId]?.enabled ?? false,
            action: prev[formId]?.action ?? '',
            field_map: nextMap,
          },
        };
      });
    },
    []
  );

  const saveCF7Config = useCallback(async () => {
    await updateSettingsMutation.mutateAsync({
      key: 'cf7_integrations',
      data: {
        forms: cf7Configs,
      },
    });
    await cf7FormsQuery.refetch();
  }, [cf7Configs, updateSettingsMutation, cf7FormsQuery]);

  const cf7Installed = cf7FormsQuery.data?.installed ?? false;

  const cf7StatusClass =
    cf7FormsQuery.isFetched && !cf7Installed
      ? 'text-destructive'
      : cf7Installed
        ? 'text-emerald-600 dark:text-emerald-500'
        : 'text-muted-foreground';

  return (
    <PageGuard page="control-center-integrations" requiredRole="admin">
      <div className="gap-0">
        <PageHeader title="Integrations" />
        <div className="p-6">
          <h1 className="!text-2xl !font-bold !my-0 !py-0 !mb-4">
            Integrations
          </h1>
          <p className="text-sm text-muted-foreground max-w-xl mb-6!">
            Connect external form plugins and services to Helpmate workflows.
          </p>

          <Card className="p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex gap-4 items-center min-w-0">
                <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                  <Plug className="w-5 h-5 text-primary" strokeWidth={1.5} />
                </div>
                <div className="min-w-0">
                  <h3 className="!text-lg !font-semibold !my-0 !py-0">
                    Contact Form 7
                  </h3>
                  <p className="!text-sm !text-muted-foreground !my-0 !py-0 mt-1">
                    Map CF7 forms to Helpmate actions and field mappings.
                  </p>
                  <p
                    className={cn(
                      '!text-xs !my-0 !py-0 !mt-1',
                      cf7StatusClass
                    )}
                  >
                    {cf7FormsQuery.isFetched && !cf7Installed
                      ? 'Plugin not detected.'
                      : cf7Installed
                        ? 'Ready to configure.'
                        : 'Open configure to check status.'}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <Button type="button" onClick={() => setSheetOpen(true)}>
                  Configure
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLogsOpen(true)}
                >
                  <ScrollText className="size-4" />
                  Logs
                </Button>
              </div>
            </div>
          </Card>
        </div>

        <IntegrationLogsSheet
          open={logsOpen}
          onOpenChange={setLogsOpen}
          integrationSlug={INTEGRATION_SLUG_CONTACT_FORM_7}
          title="Contact Form 7"
          description="Submission routing, validation, and processing events from CF7. No raw form data is stored."
        />

        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent className="flex flex-col w-full sm:max-w-lg overflow-hidden">
            <SheetHeader>
              <SheetTitle>Contact Form 7</SheetTitle>
            </SheetHeader>
            <div className="p-4 flex flex-col flex-1 min-h-0 gap-4 overflow-y-auto">
              {!cf7FormsQuery.data?.installed ? (
                <p className="text-sm text-muted-foreground">
                  Contact Form 7 is not installed or active.
                </p>
              ) : (
                <>
                  <div className="flex-1 min-h-0 space-y-4 pr-1">
                    {(cf7FormsQuery.data?.forms ?? []).map((form) => {
                      const config = cf7Configs[form.id] ?? {
                        enabled: false,
                        action: '',
                        field_map: {},
                      };
                      const selectedAction = actionMap[config.action];
                      const mappableFields =
                        selectedAction?.mappable_fields ?? [];

                      return (
                        <Card key={form.id} className="p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <h4 className="!text-base !font-semibold !my-0">
                                {form.title}
                              </h4>
                              <p className="text-xs text-muted-foreground mt-1">
                                Form ID: {form.id}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Label htmlFor={`cf7-enabled-${form.id}`}>
                                Enabled
                              </Label>
                              <Switch
                                id={`cf7-enabled-${form.id}`}
                                checked={config.enabled}
                                onCheckedChange={(checked) =>
                                  updateFormConfig(form.id, { enabled: checked })
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
                                  updateFormConfig(form.id, {
                                    action: value,
                                    field_map: {},
                                  })
                                }
                              >
                                <SelectTrigger className="mt-1">
                                  <SelectValue placeholder="Select action" />
                                </SelectTrigger>
                                <SelectContent>
                                  {(cf7FormsQuery.data?.actions ?? []).map(
                                    (action) => {
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
                                    }
                                  )}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {selectedAction?.verification_contact_required ? (
                            <p className="mt-3 text-xs text-amber-700 dark:text-amber-500">
                              Order tracker verification is on: map at least one
                              of Email or Phone so customers can confirm the
                              order.
                            </p>
                          ) : null}

                          {mappableFields.length > 0 && (
                            <div className="mt-4 space-y-3">
                              <p className="!text-md !mb-3 font-medium !text-muted-foreground">
                                Field Mapping:
                              </p>
                              {mappableFields.map((field) => {
                                const raw = config.field_map[field.key] ?? '';
                                const selectValue =
                                  raw === '' ? UNMAPPED_FIELD : raw;
                                return (
                                  <div
                                    key={field.key}
                                    className="grid grid-cols-1 gap-1"
                                  >
                                    <Label>
                                      {field.label}
                                      {field.required ? (
                                        <span className="text-destructive">
                                          {' '}
                                          *
                                        </span>
                                      ) : null}
                                    </Label>
                                    <Select
                                      value={selectValue}
                                      onValueChange={(value) =>
                                        updateFieldMap(form.id, field.key, value)
                                      }
                                    >
                                      <SelectTrigger className="mt-0.5">
                                        <SelectValue placeholder="None" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value={UNMAPPED_FIELD}>
                                          None
                                        </SelectItem>
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
                          )}
                        </Card>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
            <SheetFooter>
              <Button className="self-end" type="button" onClick={saveCF7Config} disabled={updateSettingsMutation.isPending}>
                Save mapping
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>
    </PageGuard>
  );
}
