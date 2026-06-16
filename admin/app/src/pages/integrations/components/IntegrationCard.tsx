import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn, __ } from '@/lib/utils';
import { Loader2, Plug, ScrollText } from 'lucide-react';
import type { IntegrationPluginOverviewEntry } from '../types';

type IntegrationCardProps = {
  title: string;
  description: string;
  statusClass: string;
  statusText: string;
  plugin?: IntegrationPluginOverviewEntry | null;
  capabilities?: {
    install_plugins: boolean;
    activate_plugins: boolean;
  };
  onInstall?: () => void | Promise<void>;
  onActivate?: () => void | Promise<void>;
  installPending?: boolean;
  activatePending?: boolean;
  actionsDisabled?: boolean;
  onConfigure?: () => void;
  onLogs?: () => void;
};

export default function IntegrationCard({
  title,
  description,
  statusClass,
  statusText,
  plugin,
  capabilities,
  onInstall,
  onActivate,
  installPending,
  activatePending,
  actionsDisabled,
  onConfigure,
  onLogs,
}: IntegrationCardProps) {
  const active = plugin?.active === true;
  const present = plugin?.present === true;
  const isCore = plugin?.is_core === true;
  const canInstall = capabilities?.install_plugins === true && !!plugin?.wp_org_slug;
  const canActivate = capabilities?.activate_plugins === true && !!plugin?.plugin_file;

  const showInstall = !isCore && !present && canInstall && typeof onInstall === 'function';
  const showActivate =
    !isCore && present && !active && canActivate && typeof onActivate === 'function';
  const showConfigure = Boolean(active && onConfigure);
  const showLogs = Boolean(active && !isCore && onLogs);
  const showActions = showInstall || showActivate || showConfigure || showLogs;

  return (
    <Card className="h-full gap-4 p-6">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex gap-3 items-start min-w-0">
          <div className="p-2 rounded-lg bg-primary/10 shrink-0">
            <Plug className="w-5 h-5 text-primary" strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="!text-lg !font-semibold !my-0 !py-0">{__(title)}</h3>
            <p className={cn('!text-xs !my-0 !py-0 !mt-1', statusClass)}>
              {statusText ? __(statusText) : ''}
            </p>
          </div>
        </div>
        <p className="flex-1 !text-sm !text-muted-foreground !my-0 !py-0 min-w-0">
          {__(description)}
        </p>
        {showActions ? (
          <div className="flex flex-col gap-2 w-full mt-auto pt-1">
            {showInstall ? (
              <Button
                type="button"
                className="gap-2 w-full"
                onClick={() => void onInstall()}
                disabled={installPending || actionsDisabled}
              >
                {installPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin shrink-0" aria-hidden />
                    {__('Installing…')}
                  </>
                ) : (
                  __('Install')
                )}
              </Button>
            ) : null}
            {showActivate ? (
              <Button
                type="button"
                className="gap-2 w-full"
                onClick={() => void onActivate()}
                disabled={activatePending || actionsDisabled}
              >
                {activatePending ? (
                  <>
                    <Loader2 className="size-4 animate-spin shrink-0" aria-hidden />
                    {__('Activating…')}
                  </>
                ) : (
                  __('Activate')
                )}
              </Button>
            ) : null}
            {showConfigure ? (
              <Button type="button" className="w-full" onClick={onConfigure}>
                {isCore ? __('Open block editor') : __('Configure')}
              </Button>
            ) : null}
            {showLogs ? (
              <Button type="button" variant="outline" className="w-full" onClick={onLogs}>
                <ScrollText className="size-4" />
                {__('Logs')}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
