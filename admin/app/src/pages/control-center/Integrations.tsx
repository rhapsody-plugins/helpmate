import PageGuard from '@/components/PageGuard';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSettings } from '@/hooks/useSettings';
import api from '@/lib/axios';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import {
  isPersistedCommerceProvider,
  resolveCommerceIntegration,
} from './integrations/commerce/resolve-commerce';
import type {
  CommerceIntegrationConfig,
  CommerceProviderId,
} from './integrations/commerce/types';
import IntegrationCard from './integrations/components/IntegrationCard';
import IntegrationConfigSheet from './integrations/components/IntegrationConfigSheet';
import IntegrationLogsSheet from './integrations/components/IntegrationLogsSheet';
import { useIntegrationConfig } from './integrations/hooks/useIntegrationConfig';
import { INTEGRATION_REGISTRY } from './integrations/registry';
import type { IntegrationRegistryItem } from './integrations/types';

const COMMERCE_PROVIDER_LABELS: Record<CommerceProviderId, string> = {
  woocommerce: 'WooCommerce',
  easy_digital_downloads: 'Easy Digital Downloads',
  surecart: 'SureCart',
};

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

function commerceStatusText(isFetched: boolean, installed: boolean): string {
  if (isFetched && !installed) return 'Plugin not detected.';
  if (installed) return 'Active.';
  return 'Checking status…';
}

export default function Integrations() {
  const { updateSettingsMutation, getProQuery } = useSettings();
  const isPro = getProQuery.data ?? false;
  const [wooLogsOpen, setWooLogsOpen] = useState(false);
  const [eddLogsOpen, setEddLogsOpen] = useState(false);
  const [surecartLogsOpen, setSurecartLogsOpen] = useState(false);
  const [commerceProviderOverride, setCommerceProviderOverride] =
    useState<CommerceProviderId | null>(null);

  const [sheetOpenById, setSheetOpenById] = useState<
    Record<IntegrationRegistryItem['id'], boolean>
  >({
    cf7: false,
    forminator: false,
    ninja_forms: false,
    formidable_forms: false,
    wpforms: false,
  });

  const [logsOpenById, setLogsOpenById] = useState<
    Record<IntegrationRegistryItem['id'], boolean>
  >({
    cf7: false,
    forminator: false,
    ninja_forms: false,
    formidable_forms: false,
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
  const formidableForms = useIntegrationConfig({
    definition: INTEGRATION_REGISTRY[4],
    sheetOpen: sheetOpenById.formidable_forms,
    updateSettings: updateSettingsMutation.mutateAsync,
  });

  const dataById = useMemo(
    () => ({
      cf7,
      forminator,
      formidable_forms: formidableForms,
      ninja_forms: ninjaForms,
      wpforms,
    }),
    [cf7, forminator, formidableForms, ninjaForms, wpforms]
  );

  const eddInstalledQuery = useQuery<{ installed: boolean }, Error>({
    queryKey: ['integration-edd-installed'],
    queryFn: async () => {
      const response = await api.get('/check-easy-digital-downloads');
      return response.data;
    },
    refetchOnWindowFocus: false,
  });
  const wooInstalledQuery = useQuery<{ installed: boolean }, Error>({
    queryKey: ['integration-woo-installed'],
    queryFn: async () => {
      const response = await api.get('/check-woocommerce');
      return response.data;
    },
    refetchOnWindowFocus: false,
  });
  const surecartInstalledQuery = useQuery<{ installed: boolean }, Error>({
    queryKey: ['integration-surecart-installed'],
    queryFn: async () => {
      const response = await api.get('/check-surecart');
      return response.data;
    },
    refetchOnWindowFocus: false,
  });

  const commerceConfigQuery = useQuery<Partial<CommerceIntegrationConfig>, Error>({
    queryKey: ['settings', 'commerce_integration'],
    queryFn: async () => {
      const response = await api.get('/settings/commerce_integration');
      return response.data ?? {};
    },
    refetchOnWindowFocus: false,
  });

  const eddInstalled = eddInstalledQuery.data?.installed ?? false;
  const wooInstalled = wooInstalledQuery.data?.installed ?? false;
  const surecartInstalled = surecartInstalledQuery.data?.installed ?? false;

  const commerceDataReady =
    commerceConfigQuery.isFetched &&
    eddInstalledQuery.isFetched &&
    wooInstalledQuery.isFetched &&
    surecartInstalledQuery.isFetched;

  const detectedProviders = useMemo((): CommerceProviderId[] => {
    if (!commerceDataReady) return [];
    const out: CommerceProviderId[] = [];
    if (wooInstalled) out.push('woocommerce');
    if (eddInstalled) out.push('easy_digital_downloads');
    if (surecartInstalled) out.push('surecart');
    return out;
  }, [commerceDataReady, wooInstalled, eddInstalled, surecartInstalled]);

  const resolvedCommerce = useMemo((): CommerceIntegrationConfig | null => {
    if (!commerceDataReady) return null;
    return resolveCommerceIntegration(
      commerceConfigQuery.data ?? {},
      wooInstalled,
      eddInstalled,
      surecartInstalled
    );
  }, [
    commerceDataReady,
    commerceConfigQuery.data,
    wooInstalled,
    eddInstalled,
    surecartInstalled,
  ]);

  const effectiveCommerceConfig = useMemo((): CommerceIntegrationConfig | null => {
    if (!resolvedCommerce) return null;
    if (commerceProviderOverride !== null) {
      return { ...resolvedCommerce, selected_provider: commerceProviderOverride };
    }
    return resolvedCommerce;
  }, [resolvedCommerce, commerceProviderOverride]);

  useEffect(() => {
    if (!commerceDataReady) return;
    if (commerceProviderOverride !== null) return;
    const incoming = commerceConfigQuery.data ?? {};
    const detectedCount =
      Number(wooInstalled) + Number(eddInstalled) + Number(surecartInstalled);
    if (detectedCount > 1 && !isPersistedCommerceProvider(incoming.selected_provider)) {
      const next = resolveCommerceIntegration(
        incoming,
        wooInstalled,
        eddInstalled,
        surecartInstalled
      );
      void updateSettingsMutation
        .mutateAsync({ key: 'commerce_integration', data: next })
        .then(() => commerceConfigQuery.refetch());
    }
  }, [
    commerceDataReady,
    commerceProviderOverride,
    wooInstalled,
    eddInstalled,
    surecartInstalled,
    commerceConfigQuery.dataUpdatedAt,
    updateSettingsMutation,
    commerceConfigQuery,
  ]);

  const groupedFormIntegrations = useMemo(
    () => INTEGRATION_REGISTRY.filter((entry) => entry.group === 'forms'),
    []
  );

  const selectValue = (() => {
    const id = effectiveCommerceConfig?.selected_provider;
    if (
      !id ||
      !isPersistedCommerceProvider(id) ||
      !detectedProviders.includes(id)
    ) {
      return undefined;
    }
    return id;
  })();

  return (
    <PageGuard page="control-center-integrations" requiredRole="admin">
      <div className="gap-0">
        <PageHeader title="Integrations" />
        <div className="p-6">
          <h1 className="!text-2xl !font-bold !my-0 !py-0 !mb-4">Integrations</h1>
          <p className="text-sm text-muted-foreground max-w-xl mb-6!">
            Connect external plugins to Helpmate workflows by category.
          </p>

          <Tabs defaultValue="commerce" className="w-full">
            <TabsList>
              <TabsTrigger value="commerce">Commerce</TabsTrigger>
              <TabsTrigger value="forms">Forms</TabsTrigger>
            </TabsList>

            <TabsContent value="commerce" className="mt-6">
              {!commerceDataReady ? (
                <p className="text-sm text-muted-foreground mb-6">
                  Loading commerce settings…
                </p>
              ) : detectedProviders.length === 0 ? (
                <p className="text-sm text-muted-foreground mb-6">
                  No commerce plugin detected.
                </p>
              ) : (
                <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:flex-wrap">
                  <div className="space-y-2 min-w-[min(100%,16rem)] flex-1">
                    <Label htmlFor="commerce-provider-select">Active commerce platform</Label>
                    <Select
                      value={selectValue}
                      onValueChange={(value: CommerceProviderId) =>
                        setCommerceProviderOverride(value)
                      }
                    >
                      <SelectTrigger id="commerce-provider-select" className="w-full sm:max-w-xs">
                        <SelectValue placeholder="Select a provider" />
                      </SelectTrigger>
                      <SelectContent>
                        {detectedProviders.map((id) => (
                          <SelectItem key={id} value={id}>
                            {COMMERCE_PROVIDER_LABELS[id]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    disabled={
                      updateSettingsMutation.isPending ||
                      !effectiveCommerceConfig ||
                      detectedProviders.length === 0
                    }
                    onClick={async () => {
                      if (!effectiveCommerceConfig) return;
                      await updateSettingsMutation.mutateAsync({
                        key: 'commerce_integration',
                        data: effectiveCommerceConfig,
                      });
                      await commerceConfigQuery.refetch();
                      setCommerceProviderOverride(null);
                    }}
                  >
                    Save
                  </Button>
                </div>
              )}

              <IntegrationCard
                title="WooCommerce"
                description="Products, cart context, and order workflows used by Helpmate when WooCommerce is the selected commerce platform."
                statusClass={statusClass(wooInstalledQuery.isFetched, wooInstalled)}
                statusText={commerceStatusText(wooInstalledQuery.isFetched, wooInstalled)}
                onLogs={() => setWooLogsOpen(true)}
              />

              <IntegrationCard
                className="mt-4"
                title="Easy Digital Downloads"
                description="Digital products and order workflows used by Helpmate when EDD is the selected commerce platform."
                statusClass={statusClass(eddInstalledQuery.isFetched, eddInstalled)}
                statusText={commerceStatusText(eddInstalledQuery.isFetched, eddInstalled)}
                onLogs={() => setEddLogsOpen(true)}
              />

              <IntegrationCard
                className="mt-4"
                title="SureCart"
                description="Products and checkout workflows used by Helpmate when SureCart is the selected commerce platform."
                statusClass={statusClass(
                  surecartInstalledQuery.isFetched,
                  surecartInstalled
                )}
                statusText={commerceStatusText(
                  surecartInstalledQuery.isFetched,
                  surecartInstalled
                )}
                onLogs={() => setSurecartLogsOpen(true)}
              />
            </TabsContent>

            <TabsContent value="forms" className="mt-6">
              <h2 className="!text-lg !font-semibold !mb-3">Forms</h2>
              {groupedFormIntegrations.map((entry, index) => {
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
            </TabsContent>
          </Tabs>
        </div>

        <IntegrationLogsSheet
          open={wooLogsOpen}
          onOpenChange={setWooLogsOpen}
          integrationSlug="woocommerce"
          title="WooCommerce"
          description="Integration events for WooCommerce detection, routing, and order lookups."
        />

        <IntegrationLogsSheet
          open={eddLogsOpen}
          onOpenChange={setEddLogsOpen}
          integrationSlug="easy_digital_downloads"
          title="Easy Digital Downloads"
          description="Integration events for EDD detection, routing, and order lookups."
        />

        <IntegrationLogsSheet
          open={surecartLogsOpen}
          onOpenChange={setSurecartLogsOpen}
          integrationSlug="surecart"
          title="SureCart"
          description="Integration events for SureCart detection, routing, and product lookups."
        />

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
