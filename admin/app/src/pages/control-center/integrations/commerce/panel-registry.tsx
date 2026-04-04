import type { ReactNode } from 'react';
import type { CommerceProviderId } from './types';

/**
 * Future: return lazy-loaded provider panels for {@link CommerceIntegrationSheet}.
 * Returning null keeps the Integrations page free of unused commerce sheets until a panel exists.
 */
export function getCommercePanel(provider: CommerceProviderId): ReactNode {
  void provider;
  return null;
}
