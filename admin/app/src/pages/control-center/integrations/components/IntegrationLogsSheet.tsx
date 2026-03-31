import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import api from '@/lib/axios';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, ScrollText } from 'lucide-react';
import { Fragment, useEffect, useState } from 'react';
import type { IntegrationEventsResponse } from '../types';

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

function statusBadgeVariant(
  status: string
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'processed') return 'default';
  if (status === 'validated' || status === 'accepted') return 'secondary';
  if (status.startsWith('failed') || status === 'rejected_validation') {
    return 'destructive';
  }
  return 'outline';
}

function formatEventTime(createdAt: number | string): string {
  const n = typeof createdAt === 'string' ? parseInt(createdAt, 10) : createdAt;
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

export default function IntegrationLogsSheet({
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

  const statusParam = statusFilter === '__all__' ? undefined : statusFilter;

  const eventsQuery = useQuery<IntegrationEventsResponse, Error>({
    queryKey: ['integration-events', integrationSlug, page, statusParam ?? ''],
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
              <span>{title} — Activity Log</span>
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
                No events recorded for this integration yet. Submit a mapped form
                to see entries here.
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
