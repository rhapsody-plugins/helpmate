import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ensureSiteGeneralDocument,
  getPromoteErrorMessage,
  LocalhostSource,
  useLocalhostMigration,
} from '@/hooks/useLocalhostMigration';
import { isPromoteTargetNotEmpty, useSetupQuickTrain } from '@/hooks/useSetupQuickTrain';
import { __, cn, sprintf } from '@/lib/utils';
import { AxiosError } from 'axios';
import { Calendar, FileText, Laptop } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

interface Props {
  targetDomain: string;
  onComplete: () => void;
  onSkip: () => void;
}

type MigratePhase = 'idle' | 'promoting' | 'syncing' | 'training';

function formatMigrationDate(iso?: string): string | null {
  if (!iso) {
    return null;
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateRange(firstSeen?: string, lastSeen?: string): string | null {
  const start = formatMigrationDate(firstSeen);
  const end = formatMigrationDate(lastSeen);
  if (start && end && start !== end) {
    /* translators: 1: Start date, 2: End date */
    return sprintf(__('Saved %1$s – %2$s'), start, end);
  }
  if (end) {
    /* translators: %s: Date when data was last saved */
    return sprintf(__('Last saved %s'), end);
  }
  if (start) {
    /* translators: %s: Date when data was first saved */
    return sprintf(__('Saved since %s'), start);
  }
  return null;
}

function getSourceDisplay(siteOrigin: string): { title: string; subtitle?: string } {
  if (!siteOrigin) {
    return { title: __('Unknown local site') };
  }

  try {
    const url = new URL(siteOrigin);
    const host = url.hostname.toLowerCase();
    const isLocal =
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.endsWith('.local') ||
      host.endsWith('.test');

    if (isLocal) {
      const port = url.port;
      const subtitle =
        port && port !== '80' && port !== '443'
          ? /* translators: %s: Local site URL shown for reference */
            sprintf(__('Test address: %s'), siteOrigin)
          : siteOrigin;

      return {
        title: __('Local test site'),
        subtitle,
      };
    }

    return {
      title: url.hostname,
      subtitle: siteOrigin,
    };
  } catch {
    return { title: siteOrigin };
  }
}

function itemCountLabel(count: number): string {
  if (count === 1) {
    return __('1 trained item');
  }
  /* translators: %d: Number of trained knowledge items */
  return sprintf(__('%d trained items'), count);
}

interface LocalhostSourceCardProps {
  source: LocalhostSource;
  checked: boolean;
  disabled: boolean;
  onToggle: (checked: boolean) => void;
}

function LocalhostSourceCard({
  source,
  checked,
  disabled,
  onToggle,
}: LocalhostSourceCardProps) {
  const display = getSourceDisplay(source.site_origin);
  const dateLabel = formatDateRange(source.first_seen, source.last_seen);
  const sampleTitles = source.sample_titles ?? [];
  const visibleTitles = sampleTitles.slice(0, 3);
  const hiddenTitleCount = sampleTitles.length - visibleTitles.length;

  return (
    <label
      className={cn(
        'flex gap-4 rounded-lg border-2 p-4 cursor-pointer transition-colors',
        checked
          ? 'border-primary bg-primary/5 shadow-sm'
          : 'border-border bg-card hover:border-primary/40 hover:bg-muted/30',
        disabled && 'pointer-events-none opacity-60'
      )}
    >
      <Checkbox
        className="mt-1 size-5 shrink-0"
        checked={checked}
        onCheckedChange={(value) => onToggle(!!value)}
        disabled={disabled}
        aria-label={display.title}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Laptop className="size-4" aria-hidden />
            </span>
            <div>
              <p className="font-semibold leading-snug text-foreground">
                {display.title}
              </p>
              {display.subtitle && (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {display.subtitle}
                </p>
              )}
            </div>
          </div>
          <Badge variant="secondary" className="shrink-0">
            {itemCountLabel(source.doc_count)}
          </Badge>
        </div>

        {dateLabel && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="size-3.5 shrink-0" aria-hidden />
            {dateLabel}
          </p>
        )}

        {visibleTitles.length > 0 && (
          <div className="space-y-1.5">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <FileText className="size-3.5 shrink-0" aria-hidden />
              {__('Includes')}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {visibleTitles.map((title) => (
                <Badge key={title} variant="outline" className="max-w-full font-normal">
                  <span className="truncate">{title}</span>
                </Badge>
              ))}
              {hiddenTitleCount > 0 && (
                <Badge variant="outline" className="font-normal text-muted-foreground">
                  {/* translators: %d: Additional page titles not shown in the list */
                  sprintf(__('+%d more'), hiddenTitleCount)}
                </Badge>
              )}
            </div>
          </div>
        )}
      </div>
    </label>
  );
}

export default function Step1bLocalhostMigration({
  targetDomain,
  onComplete,
  onSkip,
}: Props) {
  const {
    sourcesQuery,
    promoteMutation,
    syncFromQdrantMutation,
    statusMutation,
  } = useLocalhostMigration();
  const {
    runQuickTrain,
    isLoading: isQuickTraining,
    error: quickTrainError,
    setError: setQuickTrainError,
  } = useSetupQuickTrain();
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [forceMerge, setForceMerge] = useState(false);
  const [phase, setPhase] = useState<MigratePhase>('idle');

  const data = sourcesQuery.data?.data;
  const sources = data?.sources || [];
  const totalDocs = data?.total_docs ?? 0;
  const selectedIds = useMemo(
    () => Object.entries(selected).filter(([, v]) => v).map(([k]) => k),
    [selected]
  );
  const allSelected =
    sources.length > 0 && selectedIds.length === sources.length;

  const isBusy =
    phase !== 'idle' ||
    promoteMutation.isPending ||
    syncFromQdrantMutation.isPending ||
    statusMutation.isPending ||
    isQuickTraining;

  const phaseLabel =
    phase === 'promoting'
      ? __('Copying your saved knowledge to this site...')
      : phase === 'syncing'
        ? __('Importing knowledge base...')
        : phase === 'training'
          ? __('Initializing chatbot...')
          : '';

  const runEnsureGeneral = async (): Promise<boolean> => {
    setPhase('training');
    const ok = await ensureSiteGeneralDocument(runQuickTrain);
    setPhase('idle');
    return ok;
  };

  const handleRetryQuickTrain = async () => {
    setQuickTrainError(null);
    await runEnsureGeneral();
  };

  const handleMigrate = async () => {
    if (!targetDomain) {
      toast.error(__('Site domain is not configured. Cannot migrate.'));
      return;
    }

    setQuickTrainError(null);
    setPhase('promoting');
    try {
      const result = await promoteMutation.mutateAsync({
        target_domain: targetDomain,
        install_ids: selectedIds,
        force_merge: forceMerge,
      });

      if (result?.status !== 'success' && (result?.moved ?? 0) <= 0) {
        toast.warning(
          __(
            'Copy finished but no items were moved. Importing any existing site data.'
          )
        );
      } else if ((result?.moved ?? 0) === 0) {
        toast.warning(__('No items were moved for the selected sites.'));
      }

      setPhase('syncing');
      await syncFromQdrantMutation.mutateAsync();

      const hasGeneral = await runEnsureGeneral();
      if (!hasGeneral) {
        return;
      }

      await statusMutation.mutateAsync('done');
      onComplete();
    } catch (error) {
      setPhase('idle');
      const axiosData =
        error instanceof AxiosError ? error.response?.data : undefined;
      if (isPromoteTargetNotEmpty(axiosData)) {
        setForceMerge(true);
        toast.message(
          __('This site already has knowledge saved. Click copy again to merge.')
        );
        return;
      }
      toast.error(getPromoteErrorMessage(error));
    }
  };

  const handleSkip = async () => {
    setQuickTrainError(null);
    try {
      const hasGeneral = await runEnsureGeneral();
      if (!hasGeneral) {
        return;
      }
      await statusMutation.mutateAsync('skipped');
      onSkip();
    } catch {
      setPhase('idle');
      toast.error(__('Could not update migration status.'));
    }
  };

  const toggleSource = (installId: string, checked: boolean) => {
    setSelected((prev) => ({
      ...prev,
      [installId]: checked,
    }));
  };

  const handleSelectAll = () => {
    if (allSelected) {
      setSelected({});
      return;
    }
    const next: Record<string, boolean> = {};
    for (const source of sources) {
      next[source.install_id] = true;
    }
    setSelected(next);
  };

  const titleDomain = targetDomain || __('your site');
  /* translators: %s: Target site domain for migration */
  const title = sprintf(__('Bring test-site knowledge to %s'), titleDomain);

  const summaryLabel =
    sources.length === 1
      ? totalDocs === 1
        ? __('1 item saved from your computer')
        : sprintf(
            /* translators: %d: Total number of trained items from the local test site */
            __('%d items saved from your computer'),
            totalDocs
          )
      : sprintf(
          /* translators: 1: Number of local sites, 2: Total trained items */
          __('%1$d saved copies • %2$d items total'),
          sources.length,
          totalDocs
        );

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {__(
            'We found knowledge you saved while testing on your computer. Choose what to copy to this live site.'
          )}
        </p>
      </div>

      {isBusy && phaseLabel && (
        <p className="text-sm font-medium text-primary">{phaseLabel}</p>
      )}

      {quickTrainError && !isBusy && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="font-medium text-red-600">{quickTrainError}</p>
          <Button
            onClick={handleRetryQuickTrain}
            size="sm"
            className="mt-2"
            variant="outline"
          >
            {__('Retry')}
          </Button>
        </div>
      )}

      {sourcesQuery.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full rounded-lg" />
          <Skeleton className="h-28 w-full rounded-lg" />
        </div>
      ) : (
        <div className="space-y-3">
          {sources.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground">{summaryLabel}</p>
              {sources.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-primary"
                  onClick={handleSelectAll}
                  disabled={isBusy}
                >
                  {allSelected ? __('Deselect all') : __('Select all')}
                </Button>
              )}
            </div>
          )}

          <div className="max-h-80 space-y-3 overflow-auto pr-1">
            {sources.map((source: LocalhostSource) => (
              <LocalhostSourceCard
                key={source.install_id}
                source={source}
                checked={!!selected[source.install_id]}
                disabled={isBusy}
                onToggle={(checked) => toggleSource(source.install_id, checked)}
              />
            ))}
            {!sources.length && (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                {__('No saved test-site data found.')}
              </p>
            )}
          </div>
        </div>
      )}

      {forceMerge && (
        <p className="text-sm text-amber-700">
          {__(
            'This site already has knowledge saved. Copy again to merge — duplicate pages are skipped automatically.'
          )}
        </p>
      )}

      {!targetDomain && (
        <p className="text-sm text-destructive">
          {__(
            'Site domain is missing. Copying is unavailable until the site URL is configured.'
          )}
        </p>
      )}

      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={handleMigrate}
            disabled={!targetDomain || !selectedIds.length || isBusy}
            loading={
              phase === 'promoting' ||
              phase === 'syncing' ||
              phase === 'training'
            }
          >
            {forceMerge ? __('Merge and copy') : __('Copy to this site')}
          </Button>
          <Button
            variant="outline"
            onClick={handleSkip}
            disabled={isBusy}
            loading={phase === 'training' || statusMutation.isPending}
          >
            {__('Skip for now')}
          </Button>
        </div>
        {!selectedIds.length && sources.length > 0 && !isBusy && (
          <p className="text-xs text-muted-foreground">
            {__('Select at least one saved copy to continue.')}
          </p>
        )}
      </div>
    </div>
  );
}
