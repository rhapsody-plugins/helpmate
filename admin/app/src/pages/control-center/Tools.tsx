import PageGuard from '@/components/PageGuard';
import PageHeader from '@/components/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useApi } from '@/hooks/useApi';
import { useTools } from '@/hooks/useTools';
import { __, cn, sprintf } from '@/lib/utils';
import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  Database,
  Loader2,
  Mail,
  RefreshCw,
  Server,
} from 'lucide-react';
import { useState } from 'react';

export default function Tools() {
  const { apiKeyQuery } = useApi();
  const hasApiKey = Boolean(apiKeyQuery.data?.api_key);

  const {
    qdrantPreviewQuery,
    resetEmailTemplatesMutation,
    backfillQdrantMutation,
    syncFromQdrantMutation,
    resetDatabaseMutation,
  } = useTools();

  const [emailResetOpen, setEmailResetOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [dbResetOpen, setDbResetOpen] = useState(false);
  const [dbResetConfirm, setDbResetConfirm] = useState('');

  const preview = qdrantPreviewQuery.data;
  const legacyCount = preview?.stats?.legacy ?? 0;
  const completeCount = preview?.stats?.complete ?? 0;
  const mysqlCount = preview?.mysql_count ?? 0;
  const qdrantCount = preview?.qdrant_count ?? 0;
  const countsMatch = mysqlCount === qdrantCount;
  const metadataPercent =
    qdrantCount > 0 ? Math.round((completeCount / qdrantCount) * 100) : 0;
  const showBackfill =
    Boolean(preview?.can_backfill) && legacyCount > 0 && hasApiKey;

  const handlePreview = () => {
    void qdrantPreviewQuery.refetch();
  };

  return (
    <PageGuard page="control-center-tools" requiredRole="admin">
      <div className="gap-0">
        <PageHeader title={__('Tools')} />
        <div className="p-6 max-w-3xl space-y-4">
          <p className="text-sm text-muted-foreground !my-0">
            {__(
              'Maintenance actions for Helpmate data. These operations cannot be undone easily.'
            )}
          </p>

          <Card className="p-6 space-y-4">
            <div className="flex gap-3 items-start">
              <div className="p-2 rounded-lg bg-primary/10">
                <Mail className="w-5 h-5 text-primary" strokeWidth={1.5} />
              </div>
              <div className="flex-1 space-y-2">
                <h2 className="!text-lg !font-semibold !my-0">
                  {__('Reset default email templates')}
                </h2>
                <p className="text-sm text-muted-foreground !my-0">
                  {__(
                    'Deletes and recreates only built-in CRM email templates, then re-wires abandoned cart, refund & return, and smart scheduling defaults. Custom templates are kept.'
                  )}
                </p>
                <p className="text-sm text-amber-700 !my-0">
                  {__(
                    'Campaigns or sequences that referenced old default template IDs may need their template re-selected.'
                  )}
                </p>
                {resetEmailTemplatesMutation.data?.orphaned_campaign_references !==
                  undefined &&
                  resetEmailTemplatesMutation.data.orphaned_campaign_references > 0 && (
                    <p className="text-sm font-medium text-amber-700 !my-0">
                      {sprintf(
                        /* translators: %d: number of campaign rows with orphaned template references */
                        __(
                          '%d campaign or sequence step(s) still reference deleted default template IDs.'
                        ),
                        resetEmailTemplatesMutation.data.orphaned_campaign_references
                      )}
                    </p>
                  )}
                <Button
                  variant="outline"
                  onClick={() => setEmailResetOpen(true)}
                  disabled={resetEmailTemplatesMutation.isPending}
                >
                  {resetEmailTemplatesMutation.isPending && (
                    <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                  )}
                  {__('Reset default templates')}
                </Button>
              </div>
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <div className="flex gap-3 items-start">
              <div className="p-2 rounded-lg bg-primary/10">
                <Database className="w-5 h-5 text-primary" strokeWidth={1.5} />
              </div>
              <div className="flex-1 space-y-3">
                <h2 className="!text-lg !font-semibold !my-0">
                  {__('Sync knowledge base from cloud')}
                </h2>
                <p className="text-sm text-muted-foreground !my-0">
                  {__(
                    'Rebuilds the local knowledge base table from documents stored in your Helpmate cloud. Chat RAG is not affected; only admin KB data in WordPress is replaced.'
                  )}
                </p>
                {!hasApiKey && (
                  <p className="text-sm text-destructive !my-0">
                    {__('An API key is required to preview or sync from the cloud.')}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={handlePreview}
                    disabled={!hasApiKey || qdrantPreviewQuery.isFetching}
                  >
                    {qdrantPreviewQuery.isFetching ? (
                      <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 w-4 h-4" />
                    )}
                    {__('Preview sync')}
                  </Button>
                  {showBackfill && (
                    <Button
                      variant="outline"
                      onClick={() => backfillQdrantMutation.mutate()}
                      disabled={backfillQdrantMutation.isPending}
                    >
                      {backfillQdrantMutation.isPending && (
                        <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                      )}
                      {__('Backfill cloud metadata')}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => setSyncOpen(true)}
                    disabled={
                      !hasApiKey ||
                      syncFromQdrantMutation.isPending ||
                      !preview
                    }
                  >
                    {syncFromQdrantMutation.isPending && (
                      <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                    )}
                    {__('Sync from cloud')}
                  </Button>
                </div>
                {qdrantPreviewQuery.isError && (
                  <p className="text-sm text-destructive !my-0">
                    {qdrantPreviewQuery.error.message}
                  </p>
                )}
                {preview && (
                  <div className="overflow-hidden text-sm rounded-lg border bg-muted/30">
                    <div className="flex flex-wrap gap-2 justify-between items-center px-4 py-3 border-b bg-background/60">
                      <p className="text-sm font-medium !my-0">
                        {__('Sync preview')}
                      </p>
                      {!countsMatch ? (
                        <Badge
                          variant="outline"
                          className="border-amber-300 bg-amber-50 text-amber-900"
                        >
                          {__('Document count mismatch')}
                        </Badge>
                      ) : legacyCount > 0 ? (
                        <Badge
                          variant="outline"
                          className="border-amber-300 bg-amber-50 text-amber-900"
                        >
                          {__('Backfill recommended')}
                        </Badge>
                      ) : qdrantCount > 0 ? (
                        <Badge
                          variant="outline"
                          className="border-emerald-300 bg-emerald-50 text-emerald-900"
                        >
                          {__('Ready to sync')}
                        </Badge>
                      ) : (
                        <Badge variant="outline">{__('No documents in cloud')}</Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
                      <div className="flex flex-col gap-1 p-4 bg-background">
                        <div className="flex gap-2 items-center text-muted-foreground">
                          <Server className="w-4 h-4 shrink-0" />
                          <span className="text-xs font-medium">{__('This site')}</span>
                        </div>
                        <p className="text-2xl font-semibold tabular-nums !my-0">
                          {mysqlCount}
                        </p>
                        <p className="text-xs text-muted-foreground !my-0">
                          {__('Local knowledge base')}
                        </p>
                      </div>
                      <div className="flex flex-col gap-1 p-4 bg-background">
                        <div className="flex gap-2 items-center text-muted-foreground">
                          <Cloud className="w-4 h-4 shrink-0" />
                          <span className="text-xs font-medium">{__('Cloud')}</span>
                        </div>
                        <p className="text-2xl font-semibold tabular-nums !my-0">
                          {qdrantCount}
                        </p>
                        <p className="text-xs text-muted-foreground !my-0">
                          {__('Helpmate cloud')}
                        </p>
                      </div>
                      <div
                        className={cn(
                          'flex flex-col gap-1 p-4 bg-background',
                          completeCount > 0 && 'bg-emerald-50/50'
                        )}
                      >
                        <div className="flex gap-2 items-center text-emerald-700">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span className="text-xs font-medium">{__('Sync-ready')}</span>
                        </div>
                        <p className="text-2xl font-semibold tabular-nums text-emerald-900 !my-0">
                          {completeCount}
                        </p>
                        <p className="text-xs text-muted-foreground !my-0">
                          {__('Full metadata')}
                        </p>
                      </div>
                      <div
                        className={cn(
                          'flex flex-col gap-1 p-4 bg-background',
                          legacyCount > 0 && 'bg-amber-50/50'
                        )}
                      >
                        <div
                          className={cn(
                            'flex gap-2 items-center',
                            legacyCount > 0
                              ? 'text-amber-700'
                              : 'text-muted-foreground'
                          )}
                        >
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          <span className="text-xs font-medium">{__('Legacy')}</span>
                        </div>
                        <p
                          className={cn(
                            'text-2xl font-semibold tabular-nums !my-0',
                            legacyCount > 0 && 'text-amber-900'
                          )}
                        >
                          {legacyCount}
                        </p>
                        <p className="text-xs text-muted-foreground !my-0">
                          {__('Missing metadata')}
                        </p>
                      </div>
                    </div>

                    {qdrantCount > 0 && (
                      <div className="px-4 py-3 space-y-2 border-t bg-background/40">
                        <div className="flex justify-between items-center gap-2 text-xs">
                          <span className="font-medium text-muted-foreground">
                            {__('Cloud metadata readiness')}
                          </span>
                          <span className="tabular-nums text-muted-foreground">
                            {sprintf(
                              /* translators: %d: percentage of cloud documents with full sync metadata */
                              __('%d%%'),
                              metadataPercent
                            )}
                          </span>
                        </div>
                        <div
                          className="overflow-hidden h-2 rounded-full bg-muted"
                          role="progressbar"
                          aria-valuenow={metadataPercent}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={__('Cloud metadata readiness')}
                        >
                          <div
                            className={cn(
                              'h-full rounded-full transition-all',
                              metadataPercent === 100
                                ? 'bg-emerald-500'
                                : metadataPercent > 0
                                  ? 'bg-amber-500'
                                  : 'bg-muted-foreground/30'
                            )}
                            style={{ width: `${metadataPercent}%` }}
                          />
                        </div>
                        {!countsMatch && (
                          <p className="text-xs text-amber-800 !my-0">
                            {sprintf(
                              /* translators: 1: local document count, 2: cloud document count */
                              __(
                                'This site has %1$d document(s) but the cloud has %2$d. Sync will align the local table to the cloud.'
                              ),
                              mysqlCount,
                              qdrantCount
                            )}
                          </p>
                        )}
                      </div>
                    )}

                    {preview.warnings && preview.warnings.length > 0 && (
                      <div className="px-4 py-3 space-y-2 border-t">
                        {preview.warnings.map((warning) => (
                          <div
                            key={warning}
                            className="flex gap-2 items-start p-3 text-amber-900 rounded-md border border-amber-200 bg-amber-50"
                          >
                            <AlertTriangle className="mt-0.5 w-4 h-4 shrink-0 text-amber-600" />
                            <p className="text-sm !my-0">{warning}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {(backfillQdrantMutation.data || syncFromQdrantMutation.data) && (
                      <div className="px-4 py-3 space-y-2 border-t bg-background/40">
                        {backfillQdrantMutation.data && (
                          <div className="flex gap-2 items-start p-3 text-emerald-900 rounded-md border border-emerald-200 bg-emerald-50">
                            <CheckCircle2 className="mt-0.5 w-4 h-4 shrink-0 text-emerald-600" />
                            <p className="text-sm !my-0">
                              {sprintf(
                                /* translators: 1: updated count, 2: skipped count */
                                __('Backfill complete: %1$d updated, %2$d skipped.'),
                                backfillQdrantMutation.data.updated,
                                backfillQdrantMutation.data.skipped
                              )}
                            </p>
                          </div>
                        )}
                        {syncFromQdrantMutation.data && (
                          <div className="flex gap-2 items-start p-3 text-emerald-900 rounded-md border border-emerald-200 bg-emerald-50">
                            <CheckCircle2 className="mt-0.5 w-4 h-4 shrink-0 text-emerald-600" />
                            <p className="text-sm !my-0">
                              {syncFromQdrantMutation.data.message}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Card>

          <Card className="p-6 space-y-4 border-destructive/40">
            <div className="flex gap-3 items-start">
              <div className="p-2 rounded-lg bg-destructive/10">
                <AlertTriangle
                  className="w-5 h-5 text-destructive"
                  strokeWidth={1.5}
                />
              </div>
              <div className="flex-1 space-y-3">
                <h2 className="!text-lg !font-semibold !my-0 text-destructive">
                  {__('Danger zone')}
                </h2>
                <p className="text-sm text-muted-foreground !my-0">
                  {__(
                    'Truncates all Helpmate database tables and resets plugin settings to factory defaults. Cloud-stored documents are not deleted.'
                  )}
                </p>
                <div className="p-4 rounded-lg border bg-destructive/10 border-destructive/20">
                  <p className="mb-2 text-sm font-medium text-destructive !my-0">
                    {__('This will permanently remove:')}
                  </p>
                  <ul className="space-y-1 text-sm list-disc list-inside text-muted-foreground">
                    <li>{__('All conversations, tickets, CRM data, and tasks')}</li>
                    <li>{__('Connected social accounts (you must reconnect channels)')}</li>
                    <li>{__('API key and integration settings stored in Helpmate')}</li>
                    <li>
                      {__(
                        'Webhook verify token is regenerated — update Meta app webhooks after reconnecting'
                      )}
                    </li>
                  </ul>
                  <p className="mt-3 text-sm text-muted-foreground !my-0">
                    {__(
                      'Keeps install ID and version options. Run “Sync from cloud” afterward to restore the admin knowledge base if needed.'
                    )}
                  </p>
                </div>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setDbResetConfirm('');
                    setDbResetOpen(true);
                  }}
                  disabled={resetDatabaseMutation.isPending}
                >
                  {__('Reset all Helpmate data')}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Dialog open={emailResetOpen} onOpenChange={setEmailResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{__('Reset default email templates?')}</DialogTitle>
            <DialogDescription>
              {__(
                'Built-in templates will be recreated. Custom templates are not deleted.'
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailResetOpen(false)}>
              {__('Cancel')}
            </Button>
            <Button
              onClick={() => {
                resetEmailTemplatesMutation.mutate(undefined, {
                  onSuccess: () => setEmailResetOpen(false),
                });
              }}
              disabled={resetEmailTemplatesMutation.isPending}
            >
              {resetEmailTemplatesMutation.isPending && (
                <Loader2 className="mr-2 w-4 h-4 animate-spin" />
              )}
              {__('Confirm reset')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={syncOpen} onOpenChange={setSyncOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{__('Sync from cloud?')}</DialogTitle>
            <DialogDescription>
              {__(
                'The local knowledge base table will be emptied and rebuilt from the cloud. Your cloud-stored documents are not changed.'
              )}
            </DialogDescription>
          </DialogHeader>
          {legacyCount > 0 && (
            <div className="p-3 text-sm rounded-lg border bg-amber-50 border-amber-200 text-amber-900">
              {sprintf(
                /* translators: %d: number of legacy cloud documents */
                __(
                  '%d document(s) are missing full sync metadata and may import as general type with reconstructed content.'
                ),
                legacyCount
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSyncOpen(false)}>
              {__('Cancel')}
            </Button>
            <Button
              onClick={() => {
                syncFromQdrantMutation.mutate(undefined, {
                  onSuccess: () => setSyncOpen(false),
                });
              }}
              disabled={syncFromQdrantMutation.isPending}
            >
              {syncFromQdrantMutation.isPending && (
                <Loader2 className="mr-2 w-4 h-4 animate-spin" />
              )}
              {__('Confirm sync')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dbResetOpen}
        onOpenChange={(open) => {
          setDbResetOpen(open);
          if (!open) setDbResetConfirm('');
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{__('Reset all Helpmate data?')}</DialogTitle>
            <DialogDescription>
              {__(
                'Type RESET below to confirm. This action cannot be undone.'
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="db-reset-confirm">{__('Confirmation')}</Label>
            <Input
              id="db-reset-confirm"
              value={dbResetConfirm}
              onChange={(e) => setDbResetConfirm(e.target.value)}
              placeholder="RESET"
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDbResetOpen(false)}>
              {__('Cancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={
                dbResetConfirm !== 'RESET' || resetDatabaseMutation.isPending
              }
              onClick={() => {
                resetDatabaseMutation.mutate('RESET', {
                  onSuccess: () => {
                    setDbResetOpen(false);
                    setDbResetConfirm('');
                  },
                });
              }}
            >
              {resetDatabaseMutation.isPending && (
                <Loader2 className="mr-2 w-4 h-4 animate-spin" />
              )}
              {__('Reset everything')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageGuard>
  );
}
