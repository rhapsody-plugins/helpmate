import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
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
  onConfigure?: () => void;
  onLogs?: () => void;
  className?: string;
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
  onConfigure,
  onLogs,
  className,
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

  return (
    <Card className={cn('p-6', className)}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-4 items-center min-w-0">
          <div className="p-2 rounded-lg bg-primary/10 shrink-0">
            <Plug className="w-5 h-5 text-primary" strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <h3 className="!text-lg !font-semibold !my-0 !py-0">{title}</h3>
            <p className="!text-sm !text-muted-foreground !my-0 !py-0 mt-1">
              {description}
            </p>
            <p className={cn('!text-xs !my-0 !py-0 !mt-1', statusClass)}>
              {statusText}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {showInstall ? (
            <Button
              type="button"
              className="gap-2"
              onClick={() => void onInstall()}
              disabled={installPending}
            >
              {installPending ? (
                <>
                  <Loader2 className="size-4 animate-spin shrink-0" aria-hidden />
                  Installing…
                </>
              ) : (
                'Install'
              )}
            </Button>
          ) : null}
          {showActivate ? (
            <Button
              type="button"
              className="gap-2"
              onClick={() => void onActivate()}
              disabled={activatePending}
            >
              {activatePending ? (
                <>
                  <Loader2 className="size-4 animate-spin shrink-0" aria-hidden />
                  Activating…
                </>
              ) : (
                'Activate'
              )}
            </Button>
          ) : null}
          {showConfigure ? (
            <Button type="button" onClick={onConfigure}>
              {isCore ? 'Open block editor' : 'Configure'}
            </Button>
          ) : null}
          {showLogs ? (
            <Button type="button" variant="outline" onClick={onLogs}>
              <ScrollText className="size-4" />
              Logs
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
