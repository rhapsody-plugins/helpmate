import Loading from '@/components/Loading';
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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  isPersistedCommerceProvider,
  resolveCommerceIntegration,
} from './integrations/commerce/resolve-commerce';
import CommerceCustomerSyncButton from './integrations/commerce/CommerceCustomerSyncButton';
import type {
  CommerceIntegrationConfig,
  CommerceProviderId,
} from './integrations/commerce/types';
import IntegrationCard from './integrations/components/IntegrationCard';
import IntegrationConfigSheet from './integrations/components/IntegrationConfigSheet';
import IntegrationLogsSheet from './integrations/components/IntegrationLogsSheet';
import DokanIntegrationSheet from './integrations/multivendor/DokanIntegrationSheet';
import WcfmIntegrationSheet from './integrations/multivendor/WcfmIntegrationSheet';
import LearnPressIntegrationSheet from './integrations/lms/LearnPressIntegrationSheet';
import TutorIntegrationSheet from './integrations/lms/TutorIntegrationSheet';
import LifterLmsIntegrationSheet from './integrations/lms/LifterLmsIntegrationSheet';
import { useIntegrationConfig } from './integrations/hooks/useIntegrationConfig';
import { INTEGRATION_REGISTRY } from './integrations/registry';
import type {
  IntegrationPluginOverviewEntry,
  IntegrationPluginOverviewResponse,
  IntegrationRegistryItem,
} from './integrations/types';

const COMMERCE_PROVIDER_LABELS: Record<CommerceProviderId, string> = {
  woocommerce: 'WooCommerce',
  easy_digital_downloads: 'Easy Digital Downloads',
  surecart: 'SureCart',
};

type MultivendorProviderId = 'dokan' | 'wcfm';

const MULTIVENDOR_PROVIDER_LABELS: Record<MultivendorProviderId, string> = {
  dokan: 'Dokan',
  wcfm: 'WCFM Marketplace',
};

const PAGE_BUILDERS = [
  {
    overviewKey: 'elementor' as const,
    title: 'Elementor',
    description:
      'Use Helpmate widgets in Elementor (e.g. scheduling, promo banner). After activating Elementor, add widgets from the Helpmate category in the editor.',
  },
  {
    overviewKey: 'gutenberg' as const,
    title: 'Gutenberg',
    description:
      'Helpmate registers blocks in the WordPress block editor. Edit any page or post and insert Helpmate blocks from the block inserter.',
  },
  {
    overviewKey: 'beaver_builder' as const,
    title: 'Beaver Builder',
    description:
      'Use Helpmate modules in Beaver Builder layouts. After activating Beaver Builder, find Helpmate modules in the module list when editing a layout.',
  },
] as const;

function emptySheetState(): Record<IntegrationRegistryItem['id'], boolean> {
  return Object.fromEntries(
    INTEGRATION_REGISTRY.map((e) => [e.id, false])
  ) as Record<IntegrationRegistryItem['id'], boolean>;
}

function pluginEntry(
  plugins: IntegrationPluginOverviewResponse['plugins'] | undefined,
  key: string
): IntegrationPluginOverviewEntry | undefined {
  return plugins?.[key];
}

function statusClassForPlugin(
  ready: boolean,
  p: IntegrationPluginOverviewEntry | undefined
): string {
  if (!ready || !p) return 'text-muted-foreground';
  if (p.is_core) return 'text-emerald-600 dark:text-emerald-500';
  if (p.active) return 'text-emerald-600 dark:text-emerald-500';
  if (p.present) return 'text-amber-600 dark:text-amber-500';
  return 'text-destructive';
}

function statusTextForm(ready: boolean, p: IntegrationPluginOverviewEntry | undefined): string {
  if (!ready || !p) return '';
  if (p.active) return 'Ready to configure.';
  if (p.present) return 'Installed but not active.';
  return 'Not installed.';
}

function statusTextCommerce(ready: boolean, p: IntegrationPluginOverviewEntry | undefined): string {
  if (!ready || !p) return '';
  if (p.active) return 'Active.';
  if (p.present) return 'Installed but not active.';
  return 'Not installed.';
}

function statusTextBuilder(ready: boolean, p: IntegrationPluginOverviewEntry | undefined): string {
  if (!ready || !p) return '';
  if (p.is_core) return 'Available in the block editor.';
  if (p.active) return 'Active. Use it in the builder.';
  if (p.present) return 'Installed but not active.';
  return 'Not installed.';
}

export default function Integrations() {
  const queryClient = useQueryClient();
  const { updateSettingsMutation, getProQuery } = useSettings();
  const isPro = getProQuery.data ?? false;
  const [wooLogsOpen, setWooLogsOpen] = useState(false);
  const [eddLogsOpen, setEddLogsOpen] = useState(false);
  const [surecartLogsOpen, setSurecartLogsOpen] = useState(false);
  const [dokanSheetOpen, setDokanSheetOpen] = useState(false);
  const [wcfmSheetOpen, setWcfmSheetOpen] = useState(false);
  const [learnPressSheetOpen, setLearnPressSheetOpen] = useState(false);
  const [tutorSheetOpen, setTutorSheetOpen] = useState(false);
  const [lifterSheetOpen, setLifterSheetOpen] = useState(false);
  const [multivendorProviderOverride, setMultivendorProviderOverride] =
    useState<MultivendorProviderId | null>(null);
  const [commerceProviderOverride, setCommerceProviderOverride] =
    useState<CommerceProviderId | null>(null);

  const [sheetOpenById, setSheetOpenById] =
    useState<Record<IntegrationRegistryItem['id'], boolean>>(emptySheetState);
  const [logsOpenById, setLogsOpenById] =
    useState<Record<IntegrationRegistryItem['id'], boolean>>(emptySheetState);

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

  const overviewQuery = useQuery<IntegrationPluginOverviewResponse, Error>({
    queryKey: ['integrations-plugin-overview'],
    queryFn: async () => {
      const response = await api.get<IntegrationPluginOverviewResponse>(
        '/integrations/plugin-overview'
      );
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

  const multivendorConfigQuery = useQuery<{ selected_provider?: string }, Error>({
    queryKey: ['settings', 'multivendor_integration'],
    queryFn: async () => {
      const response = await api.get('/settings/multivendor_integration');
      return response.data ?? {};
    },
    refetchOnWindowFocus: false,
  });

  const installMutation = useMutation({
    mutationFn: async (slug: string) => {
      await api.post('/integrations/plugins/install', { slug });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['integrations-plugin-overview'] });
      toast.success('Plugin installed. You can activate it now.');
    },
    onError: (err: unknown) => {
      const msg = axios.isAxiosError(err)
        ? String((err.response?.data as { message?: string })?.message ?? err.message)
        : 'Installation failed';
      toast.error(msg);
    },
  });

  const activateMutation = useMutation({
    mutationFn: async (plugin: string) => {
      await api.post('/integrations/plugins/activate', { plugin });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['integrations-plugin-overview'] });
      toast.success('Plugin activated.');
    },
    onError: (err: unknown) => {
      const msg = axios.isAxiosError(err)
        ? String((err.response?.data as { message?: string })?.message ?? err.message)
        : 'Activation failed';
      toast.error(msg);
    },
  });

  const plugins = overviewQuery.data?.plugins;
  const caps = overviewQuery.data?.capabilities;

  const wooInstalled = plugins?.woocommerce?.active === true;
  const eddInstalled = plugins?.easy_digital_downloads?.active === true;
  const surecartInstalled = plugins?.surecart?.active === true;

  const commerceDataReady = commerceConfigQuery.isSuccess;
  const overviewReady = overviewQuery.isSuccess;

  const detectedProviders = useMemo((): CommerceProviderId[] => {
    if (!overviewReady || !plugins) return [];
    const out: CommerceProviderId[] = [];
    if (plugins.woocommerce?.active) out.push('woocommerce');
    if (plugins.easy_digital_downloads?.active) out.push('easy_digital_downloads');
    if (plugins.surecart?.active) out.push('surecart');
    return out;
  }, [overviewReady, plugins]);

  const resolvedCommerce = useMemo((): CommerceIntegrationConfig | null => {
    if (!commerceDataReady || !overviewReady || !plugins) return null;
    return resolveCommerceIntegration(
      commerceConfigQuery.data ?? {},
      wooInstalled,
      eddInstalled,
      surecartInstalled
    );
  }, [
    commerceDataReady,
    overviewReady,
    commerceConfigQuery.data,
    wooInstalled,
    eddInstalled,
    surecartInstalled,
    plugins,
  ]);

  const effectiveCommerceConfig = useMemo((): CommerceIntegrationConfig | null => {
    if (!resolvedCommerce) return null;
    if (commerceProviderOverride !== null) {
      return { ...resolvedCommerce, selected_provider: commerceProviderOverride };
    }
    return resolvedCommerce;
  }, [resolvedCommerce, commerceProviderOverride]);

  useEffect(() => {
    if (!commerceDataReady || !overviewReady || !plugins) return;
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
    overviewReady,
    commerceProviderOverride,
    wooInstalled,
    eddInstalled,
    surecartInstalled,
    commerceConfigQuery.dataUpdatedAt,
    updateSettingsMutation,
    commerceConfigQuery,
    plugins,
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
  const selectedCommerceProvider = effectiveCommerceConfig?.selected_provider ?? '';

  const detectedMultivendorProviders = useMemo((): MultivendorProviderId[] => {
    if (!overviewReady || !plugins) return [];
    const out: MultivendorProviderId[] = [];
    if (plugins.dokan?.active) out.push('dokan');
    if (plugins.wcfm?.active) out.push('wcfm');
    return out;
  }, [overviewReady, plugins]);

  const savedMultivendorProvider = useMemo<MultivendorProviderId | ''>(() => {
    const raw = (multivendorConfigQuery.data?.selected_provider ?? '') as string;
    return raw === 'dokan' || raw === 'wcfm' ? raw : '';
  }, [multivendorConfigQuery.data?.selected_provider]);

  const effectiveMultivendorProvider = useMemo<MultivendorProviderId | ''>(() => {
    if (multivendorProviderOverride !== null) return multivendorProviderOverride;
    return savedMultivendorProvider;
  }, [multivendorProviderOverride, savedMultivendorProvider]);

  useEffect(() => {
    if (!overviewReady || !commerceDataReady) return;
    if (multivendorConfigQuery.isPending || multivendorConfigQuery.isError) return;
    if (multivendorProviderOverride !== null) return;

    const incoming = (multivendorConfigQuery.data?.selected_provider ?? '') as string;
    if (incoming === 'dokan' || incoming === 'wcfm') return;

    const smartDefault: MultivendorProviderId =
      detectedMultivendorProviders.includes('dokan')
        ? 'dokan'
        : detectedMultivendorProviders.includes('wcfm')
          ? 'wcfm'
          : 'dokan';

    void updateSettingsMutation
      .mutateAsync({
        key: 'multivendor_integration',
        data: { selected_provider: smartDefault },
      })
      .then(() => multivendorConfigQuery.refetch());
  }, [
    overviewReady,
    commerceDataReady,
    multivendorConfigQuery,
    multivendorProviderOverride,
    detectedMultivendorProviders,
    updateSettingsMutation,
  ]);

  const pagePending =
    overviewQuery.isPending || commerceConfigQuery.isPending || multivendorConfigQuery.isPending;
  const pageError =
    overviewQuery.isError || commerceConfigQuery.isError || multivendorConfigQuery.isError;
  const pageReady =
    overviewQuery.isSuccess && commerceConfigQuery.isSuccess && multivendorConfigQuery.isSuccess;

  const blockEditorUrl = `${window.location.origin}/wp-admin/post-new.php`;

  return (
    <PageGuard page="control-center-integrations" requiredRole="admin">
      <div className="gap-0">
        <PageHeader title="Integrations" />
        {pagePending ? (
          <div className="flex min-h-[min(70vh,32rem)] flex-col items-center justify-center p-8">
            <Loading />
            <p className="mt-4 text-sm text-muted-foreground">Loading integrations…</p>
          </div>
        ) : pageError ? (
          <div className="flex min-h-[min(50vh,24rem)] flex-col items-center justify-center gap-4 p-8">
            <p className="text-sm text-destructive text-center max-w-md">
              Could not load integrations. Check your connection and try again.
            </p>
            <div className="flex gap-2">
              {overviewQuery.isError ? (
                <Button type="button" variant="outline" onClick={() => overviewQuery.refetch()}>
                  Retry status
                </Button>
              ) : null}
              {commerceConfigQuery.isError ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => commerceConfigQuery.refetch()}
                >
                  Retry commerce settings
                </Button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="p-6">
            <h1 className="!text-2xl !font-bold !my-0 !py-0 !mb-4">Integrations</h1>
            <p className="text-sm text-muted-foreground max-w-xl mb-6!">
              Connect external plugins to Helpmate workflows by category.
            </p>

            <Tabs defaultValue="commerce" className="w-full">
              <TabsList>
                <TabsTrigger value="commerce">Commerce</TabsTrigger>
                <TabsTrigger value="multivendor">Multivendor</TabsTrigger>
                <TabsTrigger value="lms">LMS</TabsTrigger>
                <TabsTrigger value="forms">Forms</TabsTrigger>
                <TabsTrigger value="page_builders">Page builders</TabsTrigger>
              </TabsList>

              <TabsContent value="commerce" className="mt-6">
                {detectedProviders.length === 0 ? (
                  <p className="text-sm text-muted-foreground mb-6">
                    No active commerce plugin. Install and activate WooCommerce, Easy Digital
                    Downloads, or SureCart below.
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
                  plugin={pluginEntry(plugins, 'woocommerce')}
                  capabilities={caps}
                  statusClass={statusClassForPlugin(pageReady, pluginEntry(plugins, 'woocommerce'))}
                  statusText={statusTextCommerce(pageReady, pluginEntry(plugins, 'woocommerce'))}
                  onInstall={
                    pluginEntry(plugins, 'woocommerce')?.wp_org_slug
                      ? () =>
                          installMutation.mutate(
                            pluginEntry(plugins, 'woocommerce')!.wp_org_slug as string
                          )
                      : undefined
                  }
                  onActivate={
                    pluginEntry(plugins, 'woocommerce')?.plugin_file
                      ? () =>
                          activateMutation.mutate(
                            pluginEntry(plugins, 'woocommerce')!.plugin_file as string
                          )
                      : undefined
                  }
                  installPending={installMutation.isPending}
                  activatePending={activateMutation.isPending}
                  onLogs={() => setWooLogsOpen(true)}
                />
                {selectedCommerceProvider === 'woocommerce' &&
                pluginEntry(plugins, 'woocommerce')?.active ? (
                  <CommerceCustomerSyncButton
                    providerLabel="WooCommerce"
                    endpoint="/integrations/woocommerce/sync-customers"
                  />
                ) : null}

                <IntegrationCard
                  className="mt-4"
                  title="Easy Digital Downloads"
                  description="Digital products and order workflows used by Helpmate when EDD is the selected commerce platform."
                  plugin={pluginEntry(plugins, 'easy_digital_downloads')}
                  capabilities={caps}
                  statusClass={statusClassForPlugin(
                    pageReady,
                    pluginEntry(plugins, 'easy_digital_downloads')
                  )}
                  statusText={statusTextCommerce(
                    pageReady,
                    pluginEntry(plugins, 'easy_digital_downloads')
                  )}
                  onInstall={
                    pluginEntry(plugins, 'easy_digital_downloads')?.wp_org_slug
                      ? () =>
                          installMutation.mutate(
                            pluginEntry(plugins, 'easy_digital_downloads')!.wp_org_slug as string
                          )
                      : undefined
                  }
                  onActivate={
                    pluginEntry(plugins, 'easy_digital_downloads')?.plugin_file
                      ? () =>
                          activateMutation.mutate(
                            pluginEntry(plugins, 'easy_digital_downloads')!.plugin_file as string
                          )
                      : undefined
                  }
                  installPending={installMutation.isPending}
                  activatePending={activateMutation.isPending}
                  onLogs={() => setEddLogsOpen(true)}
                />
                {selectedCommerceProvider === 'easy_digital_downloads' &&
                pluginEntry(plugins, 'easy_digital_downloads')?.active ? (
                  <CommerceCustomerSyncButton
                    providerLabel="Easy Digital Downloads"
                    endpoint="/integrations/edd/sync-customers"
                  />
                ) : null}

                <IntegrationCard
                  className="mt-4"
                  title="SureCart"
                  description="Products and checkout workflows used by Helpmate when SureCart is the selected commerce platform."
                  plugin={pluginEntry(plugins, 'surecart')}
                  capabilities={caps}
                  statusClass={statusClassForPlugin(pageReady, pluginEntry(plugins, 'surecart'))}
                  statusText={statusTextCommerce(pageReady, pluginEntry(plugins, 'surecart'))}
                  onInstall={
                    pluginEntry(plugins, 'surecart')?.wp_org_slug
                      ? () =>
                          installMutation.mutate(
                            pluginEntry(plugins, 'surecart')!.wp_org_slug as string
                          )
                      : undefined
                  }
                  onActivate={
                    pluginEntry(plugins, 'surecart')?.plugin_file
                      ? () =>
                          activateMutation.mutate(
                            pluginEntry(plugins, 'surecart')!.plugin_file as string
                          )
                      : undefined
                  }
                  installPending={installMutation.isPending}
                  activatePending={activateMutation.isPending}
                  onLogs={() => setSurecartLogsOpen(true)}
                />
                {selectedCommerceProvider === 'surecart' &&
                pluginEntry(plugins, 'surecart')?.active ? (
                  <CommerceCustomerSyncButton
                    providerLabel="SureCart"
                    endpoint="/integrations/surecart/sync-customers"
                  />
                ) : null}
              </TabsContent>

              <TabsContent value="lms" className="mt-6">
                <h2 className="!text-lg !font-semibold !mb-3">LMS</h2>
                <IntegrationCard
                  title="LearnPress"
                  description="Sync LearnPress students into CRM and use lesson/course progress data in contact details and segmentation."
                  plugin={pluginEntry(plugins, 'learnpress')}
                  capabilities={caps}
                  statusClass={statusClassForPlugin(pageReady, pluginEntry(plugins, 'learnpress'))}
                  statusText={statusTextCommerce(pageReady, pluginEntry(plugins, 'learnpress'))}
                  onInstall={
                    pluginEntry(plugins, 'learnpress')?.wp_org_slug
                      ? () =>
                          installMutation.mutate(
                            pluginEntry(plugins, 'learnpress')!.wp_org_slug as string
                          )
                      : undefined
                  }
                  onActivate={
                    pluginEntry(plugins, 'learnpress')?.plugin_file
                      ? () =>
                          activateMutation.mutate(
                            pluginEntry(plugins, 'learnpress')!.plugin_file as string
                          )
                      : undefined
                  }
                  installPending={installMutation.isPending}
                  activatePending={activateMutation.isPending}
                  onConfigure={
                    pluginEntry(plugins, 'learnpress')?.active
                      ? () => setLearnPressSheetOpen(true)
                      : undefined
                  }
                />
                <IntegrationCard
                  className="mt-4"
                  title="Tutor LMS"
                  description="Sync Tutor LMS students into CRM and use lesson/course progress data in contact details and segmentation."
                  plugin={pluginEntry(plugins, 'tutor')}
                  capabilities={caps}
                  statusClass={statusClassForPlugin(pageReady, pluginEntry(plugins, 'tutor'))}
                  statusText={statusTextCommerce(pageReady, pluginEntry(plugins, 'tutor'))}
                  onInstall={
                    pluginEntry(plugins, 'tutor')?.wp_org_slug
                      ? () =>
                          installMutation.mutate(
                            pluginEntry(plugins, 'tutor')!.wp_org_slug as string
                          )
                      : undefined
                  }
                  onActivate={
                    pluginEntry(plugins, 'tutor')?.plugin_file
                      ? () =>
                          activateMutation.mutate(
                            pluginEntry(plugins, 'tutor')!.plugin_file as string
                          )
                      : undefined
                  }
                  installPending={installMutation.isPending}
                  activatePending={activateMutation.isPending}
                  onConfigure={
                    pluginEntry(plugins, 'tutor')?.active
                      ? () => setTutorSheetOpen(true)
                      : undefined
                  }
                />
                <IntegrationCard
                  className="mt-4"
                  title="LifterLMS"
                  description="Sync LifterLMS students into CRM and use lesson/course progress data in contact details and segmentation."
                  plugin={pluginEntry(plugins, 'lifterlms')}
                  capabilities={caps}
                  statusClass={statusClassForPlugin(pageReady, pluginEntry(plugins, 'lifterlms'))}
                  statusText={statusTextCommerce(pageReady, pluginEntry(plugins, 'lifterlms'))}
                  onInstall={
                    pluginEntry(plugins, 'lifterlms')?.wp_org_slug
                      ? () =>
                          installMutation.mutate(
                            pluginEntry(plugins, 'lifterlms')!.wp_org_slug as string
                          )
                      : undefined
                  }
                  onActivate={
                    pluginEntry(plugins, 'lifterlms')?.plugin_file
                      ? () =>
                          activateMutation.mutate(
                            pluginEntry(plugins, 'lifterlms')!.plugin_file as string
                          )
                      : undefined
                  }
                  installPending={installMutation.isPending}
                  activatePending={activateMutation.isPending}
                  onConfigure={
                    pluginEntry(plugins, 'lifterlms')?.active
                      ? () => setLifterSheetOpen(true)
                      : undefined
                  }
                />
              </TabsContent>

              <TabsContent value="multivendor" className="mt-6">
                <h2 className="!text-lg !font-semibold !mb-3">Multivendor</h2>
                <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:flex-wrap">
                  <div className="space-y-2 min-w-[min(100%,16rem)] flex-1">
                    <Label htmlFor="multivendor-provider-select">Primary multivendor provider</Label>
                    <Select
                      value={effectiveMultivendorProvider || undefined}
                      onValueChange={(value: MultivendorProviderId) =>
                        setMultivendorProviderOverride(value)
                      }
                    >
                      <SelectTrigger id="multivendor-provider-select" className="w-full sm:max-w-xs">
                        <SelectValue placeholder="Select a provider" />
                      </SelectTrigger>
                      <SelectContent>
                        {detectedMultivendorProviders.map((id) => (
                          <SelectItem key={id} value={id}>
                            {MULTIVENDOR_PROVIDER_LABELS[id]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    disabled={
                      updateSettingsMutation.isPending ||
                      !effectiveMultivendorProvider ||
                      detectedMultivendorProviders.length === 0
                    }
                    onClick={async () => {
                      if (!effectiveMultivendorProvider) return;
                      await updateSettingsMutation.mutateAsync({
                        key: 'multivendor_integration',
                        data: { selected_provider: effectiveMultivendorProvider },
                      });
                      await multivendorConfigQuery.refetch();
                      setMultivendorProviderOverride(null);
                    }}
                  >
                    Save
                  </Button>
                </div>
                {detectedMultivendorProviders.length === 0 ? (
                  <p className="text-sm text-muted-foreground mb-6">
                    No active multivendor plugin. Install and activate Dokan or WCFM Marketplace
                    below.
                  </p>
                ) : null}
                {effectiveMultivendorProvider &&
                !detectedMultivendorProviders.includes(effectiveMultivendorProvider) ? (
                  <p className="text-sm text-amber-600 mb-6">
                    Selected primary provider is inactive. Multivendor enrichment is disabled until
                    you activate it or switch primary provider.
                  </p>
                ) : null}
                <IntegrationCard
                  title="Dokan"
                  description="Optional vendor display in CRM, product training, and proactive sales. Sync Dokan sellers to CRM contacts on demand."
                  plugin={pluginEntry(plugins, 'dokan')}
                  capabilities={caps}
                  statusClass={statusClassForPlugin(pageReady, pluginEntry(plugins, 'dokan'))}
                  statusText={statusTextCommerce(pageReady, pluginEntry(plugins, 'dokan'))}
                  onInstall={
                    pluginEntry(plugins, 'dokan')?.wp_org_slug
                      ? () =>
                          installMutation.mutate(
                            pluginEntry(plugins, 'dokan')!.wp_org_slug as string
                          )
                      : undefined
                  }
                  onActivate={
                    pluginEntry(plugins, 'dokan')?.plugin_file
                      ? () =>
                          activateMutation.mutate(
                            pluginEntry(plugins, 'dokan')!.plugin_file as string
                          )
                      : undefined
                  }
                  installPending={installMutation.isPending}
                  activatePending={activateMutation.isPending}
                  onConfigure={
                    pluginEntry(plugins, 'dokan')?.active
                      ? () => setDokanSheetOpen(true)
                      : undefined
                  }
                />

                <IntegrationCard
                  className="mt-4"
                  title="WCFM Marketplace"
                  description="Optional vendor display in CRM, product training, and proactive sales. Sync WCFM sellers to CRM contacts on demand."
                  plugin={pluginEntry(plugins, 'wcfm')}
                  capabilities={caps}
                  statusClass={statusClassForPlugin(pageReady, pluginEntry(plugins, 'wcfm'))}
                  statusText={statusTextCommerce(pageReady, pluginEntry(plugins, 'wcfm'))}
                  onInstall={
                    pluginEntry(plugins, 'wcfm')?.wp_org_slug
                      ? () =>
                          installMutation.mutate(
                            pluginEntry(plugins, 'wcfm')!.wp_org_slug as string
                          )
                      : undefined
                  }
                  onActivate={
                    pluginEntry(plugins, 'wcfm')?.plugin_file
                      ? () =>
                          activateMutation.mutate(
                            pluginEntry(plugins, 'wcfm')!.plugin_file as string
                          )
                      : undefined
                  }
                  installPending={installMutation.isPending}
                  activatePending={activateMutation.isPending}
                  onConfigure={
                    pluginEntry(plugins, 'wcfm')?.active
                      ? () => setWcfmSheetOpen(true)
                      : undefined
                  }
                />
              </TabsContent>

              <TabsContent value="forms" className="mt-6">
                <h2 className="!text-lg !font-semibold !mb-3">Forms</h2>
                {groupedFormIntegrations.map((entry, index) => {
                  const p = pluginEntry(plugins, entry.id);
                  return (
                    <IntegrationCard
                      key={entry.id}
                      title={entry.title}
                      description={entry.description}
                      plugin={p}
                      capabilities={caps}
                      statusClass={statusClassForPlugin(pageReady, p)}
                      statusText={statusTextForm(pageReady, p)}
                      onInstall={
                        p?.wp_org_slug
                          ? () => installMutation.mutate(p.wp_org_slug as string)
                          : undefined
                      }
                      onActivate={
                        p?.plugin_file
                          ? () => activateMutation.mutate(p.plugin_file as string)
                          : undefined
                      }
                      installPending={installMutation.isPending}
                      activatePending={activateMutation.isPending}
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

              <TabsContent value="page_builders" className="mt-6">
                <h2 className="!text-lg !font-semibold !mb-3">Page builders</h2>
                {PAGE_BUILDERS.map((pb, index) => {
                  const p = pluginEntry(plugins, pb.overviewKey);
                  return (
                    <IntegrationCard
                      key={pb.overviewKey}
                      title={pb.title}
                      description={pb.description}
                      plugin={p}
                      capabilities={caps}
                      statusClass={statusClassForPlugin(pageReady, p)}
                      statusText={statusTextBuilder(pageReady, p)}
                      onInstall={
                        p?.wp_org_slug && !p.is_core
                          ? () => installMutation.mutate(p.wp_org_slug as string)
                          : undefined
                      }
                      onActivate={
                        p?.plugin_file && !p.is_core
                          ? () => activateMutation.mutate(p.plugin_file as string)
                          : undefined
                      }
                      installPending={installMutation.isPending}
                      activatePending={activateMutation.isPending}
                      onConfigure={
                        pb.overviewKey === 'gutenberg' && p?.is_core
                          ? () => {
                              window.open(blockEditorUrl, '_blank', 'noopener,noreferrer');
                            }
                          : undefined
                      }
                      className={index > 0 ? 'mt-4' : undefined}
                    />
                  );
                })}
              </TabsContent>
            </Tabs>
          </div>
        )}

        {pageReady ? (
          <>
            <DokanIntegrationSheet
              open={dokanSheetOpen}
              onOpenChange={setDokanSheetOpen}
              dokanPluginActive={pluginEntry(plugins, 'dokan')?.active === true}
            />

            <WcfmIntegrationSheet
              open={wcfmSheetOpen}
              onOpenChange={setWcfmSheetOpen}
              wcfmPluginActive={pluginEntry(plugins, 'wcfm')?.active === true}
            />

            <LearnPressIntegrationSheet
              open={learnPressSheetOpen}
              onOpenChange={setLearnPressSheetOpen}
              learnPressPluginActive={pluginEntry(plugins, 'learnpress')?.active === true}
            />

            <TutorIntegrationSheet
              open={tutorSheetOpen}
              onOpenChange={setTutorSheetOpen}
              tutorPluginActive={pluginEntry(plugins, 'tutor')?.active === true}
            />

            <LifterLmsIntegrationSheet
              open={lifterSheetOpen}
              onOpenChange={setLifterSheetOpen}
              lifterPluginActive={pluginEntry(plugins, 'lifterlms')?.active === true}
            />

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
          </>
        ) : null}
      </div>
    </PageGuard>
  );
}
