import PageGuard from '@/components/PageGuard';
import PageHeader from '@/components/PageHeader';
import { useSettings } from '@/hooks/useSettings';
import { useMemo, useState } from 'react';
import IntegrationCard from './integrations/components/IntegrationCard';
import IntegrationConfigSheet from './integrations/components/IntegrationConfigSheet';
import IntegrationLogsSheet from './integrations/components/IntegrationLogsSheet';
import { useIntegrationConfig } from './integrations/hooks/useIntegrationConfig';
import { INTEGRATION_REGISTRY } from './integrations/registry';
import type { IntegrationRegistryItem } from './integrations/types';

function statusClass(isFetched: boolean, installed: boolean): string {
  if (isFetched && !installed) return 'text-destructive';
  if (installed) return 'text-emerald-600 dark:text-emerald-500';
  return 'text-muted-foreground';
}

function statusText(isFetched: boolean, installed: boolean): string {
  if (isFetched && !installed) return 'Plugin not detected.';
  if (installed) return 'Ready to configure.';
  return 'Open configure to check status.';
}

export default function Integrations() {
  const { updateSettingsMutation, getProQuery } = useSettings();
  const isPro = getProQuery.data ?? false;

  const [sheetOpenById, setSheetOpenById] = useState<
    Record<IntegrationRegistryItem['id'], boolean>
  >({
    cf7: false,
    forminator: false,
    ninja_forms: false,
    wpforms: false,
  });

  const [logsOpenById, setLogsOpenById] = useState<
    Record<IntegrationRegistryItem['id'], boolean>
  >({
    cf7: false,
    forminator: false,
    ninja_forms: false,
    wpforms: false,
  });

  const cf7 = useIntegrationConfig({
    definition: INTEGRATION_REGISTRY[0],
    sheetOpen: sheetOpenById.cf7,
    updateSettings: updateSettingsMutation.mutateAsync,
  });
  const forminator = useIntegrationConfig({
    definition: INTEGRATION_REGISTRY[1],
    sheetOpen: sheetOpenById.forminator,
    updateSettings: updateSettingsMutation.mutateAsync,
  });
  const wpforms = useIntegrationConfig({
    definition: INTEGRATION_REGISTRY[3],
    sheetOpen: sheetOpenById.wpforms,
    updateSettings: updateSettingsMutation.mutateAsync,
  });
  const ninjaForms = useIntegrationConfig({
    definition: INTEGRATION_REGISTRY[2],
    sheetOpen: sheetOpenById.ninja_forms,
    updateSettings: updateSettingsMutation.mutateAsync,
  });

  const dataById = useMemo(
    () => ({
      cf7,
      forminator,
      ninja_forms: ninjaForms,
      wpforms,
    }),
    [cf7, forminator, ninjaForms, wpforms]
  );

  return (
    <PageGuard page="control-center-integrations" requiredRole="admin">
      <div className="gap-0">
        <PageHeader title="Integrations" />
        <div className="p-6">
          <h1 className="!text-2xl !font-bold !my-0 !py-0 !mb-4">Integrations</h1>
          <p className="text-sm text-muted-foreground max-w-xl mb-6!">
            Connect external form plugins and services to Helpmate workflows.
          </p>

          {INTEGRATION_REGISTRY.map((entry, index) => {
            const current = dataById[entry.id];
            const installed = current.formsQuery.data?.installed ?? false;
            return (
              <IntegrationCard
                key={entry.id}
                title={entry.title}
                description={entry.description}
                statusClass={statusClass(current.formsQuery.isFetched, installed)}
                statusText={statusText(current.formsQuery.isFetched, installed)}
                onConfigure={() =>
                  setSheetOpenById((prev) => ({ ...prev, [entry.id]: true }))
                }
                onLogs={() =>
                  setLogsOpenById((prev) => ({ ...prev, [entry.id]: true }))
                }
                className={index > 0 ? 'mt-4' : undefined}
              />
            );
          })}
        </div>

        {INTEGRATION_REGISTRY.map((entry) => (
          <IntegrationLogsSheet
            key={`logs-${entry.id}`}
            open={logsOpenById[entry.id]}
            onOpenChange={(open) =>
              setLogsOpenById((prev) => ({ ...prev, [entry.id]: open }))
            }
            integrationSlug={entry.integrationSlug}
            title={entry.title}
            description={entry.logsDescription}
          />
        ))}

        {INTEGRATION_REGISTRY.map((entry) => {
          const current = dataById[entry.id];
          return (
            <IntegrationConfigSheet
              key={`sheet-${entry.id}`}
              open={sheetOpenById[entry.id]}
              onOpenChange={(open) =>
                setSheetOpenById((prev) => ({ ...prev, [entry.id]: open }))
              }
              title={entry.title}
              idPrefix={entry.id}
              query={current.formsQuery}
              createFormUrl={entry.createFormUrl}
              notInstalledText={entry.notInstalledText}
              primaryCtaText={entry.primaryCtaText}
              emptySupportingText={entry.emptySupportingText}
              configs={current.configs}
              isPro={isPro}
              saving={updateSettingsMutation.isPending}
              onUpdateConfig={current.updateConfig}
              onUpdateFieldMap={current.updateFieldMap}
              onSave={current.saveConfig}
            />
          );
        })}
      </div>
    </PageGuard>
  );
}
