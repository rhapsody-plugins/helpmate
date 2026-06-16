import type { CommerceIntegrationConfig, CommerceProviderId } from './types';

export function isPersistedCommerceProvider(
  value: string | undefined
): value is CommerceProviderId {
  return (
    value === 'woocommerce' ||
    value === 'easy_digital_downloads' ||
    value === 'surecart'
  );
}

/** Server + install state → effective config; WooCommerce wins when both plugins are active and nothing is saved. */
export function resolveCommerceIntegration(
  incoming: Partial<CommerceIntegrationConfig>,
  wooInstalled: boolean,
  eddInstalled: boolean,
  surecartInstalled: boolean
): CommerceIntegrationConfig {
  const enabled = incoming.enabled !== false;
  let selected: '' | CommerceProviderId = isPersistedCommerceProvider(
    incoming.selected_provider
  )
    ? incoming.selected_provider
    : '';
  const detected: CommerceProviderId[] = [];
  if (wooInstalled) detected.push('woocommerce');
  if (eddInstalled) detected.push('easy_digital_downloads');
  if (surecartInstalled) detected.push('surecart');

  if (!selected && detected.length === 1) {
    selected = detected[0];
  }

  if (!selected && detected.length > 1) {
    // Keep Woo as default for backwards compatibility.
    selected = detected.includes('woocommerce') ? 'woocommerce' : detected[0];
  }
  return { enabled, selected_provider: selected };
}
