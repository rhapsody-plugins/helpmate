import { useSettings } from '@/hooks/useSettings';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

export type PageType =
  | 'analytics'
  | 'activity'
  | 'data-source'
  | 'settings'
  | 'proactive-sales'
  | 'abandoned-cart'
  | 'coupon-delivery'
  | 'order-tracker'
  | 'image-search'
  | 'ticket-system'
  | 'refund-return'
  | 'app-center'
  | 'train-chatbot'
  | 'test-chatbot'
  | 'social-chat'
  | 'social-chat-inbox'
  | 'social-chat-campaigns'
  | 'social-chat-facebook'
  | 'social-chat-instagram'
  | 'social-chat-whatsapp'
  | 'social-chat-tiktok'
  | 'crm-contacts'
  | 'crm-contact-details'
  | 'crm-custom-fields'
  | 'crm-leads'
  | 'crm-emails'
  | 'crm-segments'
  | 'crm-analytics'
  | 'appointments-bookings'
  | 'control-center-team'
  | 'tasks'
  | 'control-center-dashboard'
  | 'control-center-analytics'
  | 'control-center-settings'
  | 'control-center-integrations'
  | 'manage-api'
  | 'setup'
  | 'inbox-all'
  | 'inbox-chatbot'
  | 'inbox-live-chat'
  | 'inbox-tickets'
  | 'inbox-social-messages'
  | 'inbox-comments'
  | 'inbox-archived'
  | 'live-chat-settings'
  | 'automation-marketing-email-campaigns'
  | 'automation-marketing-lead-capture'
  | 'automation-marketing-coupon-delivery'
  | 'automation-marketing-proactive-sales'
  | 'automation-sales-email-sequences'
  | 'automation-sales-abandoned-cart'
  | 'automation-sales-promo-banner'
  | 'automation-sales-sales-notifications'
  | 'automation-support-auto-responses';

// Map page types to tab/subtab structure
const pageToTabMap: Record<PageType, { tab: string; subtab?: string }> = {
  analytics: { tab: 'analytics' },
  activity: { tab: 'activity' },
  'data-source': { tab: 'data-source' },
  settings: { tab: 'settings' },
  'proactive-sales': { tab: 'apps', subtab: 'proactive-sales' },
  'abandoned-cart': { tab: 'crm', subtab: 'abandoned-cart' },
  'appointments-bookings': { tab: 'crm', subtab: 'appointments-bookings' },
  'coupon-delivery': { tab: 'apps', subtab: 'coupon-delivery' },
  'order-tracker': { tab: 'apps', subtab: 'order-tracker' },
  'image-search': { tab: 'apps', subtab: 'image-search' },
  'ticket-system': { tab: 'apps', subtab: 'ticket-system' },
  'refund-return': { tab: 'apps', subtab: 'refund-return' },
  'app-center': { tab: 'apps' },
  'train-chatbot': { tab: 'data-source' },
  'test-chatbot': { tab: 'test-chatbot' },
  'social-chat': { tab: 'social-chat', subtab: 'settings' },
  'social-chat-inbox': { tab: 'social-chat', subtab: 'inbox' },
  'social-chat-campaigns': { tab: 'social-chat', subtab: 'campaigns' },
  'social-chat-facebook': { tab: 'social-chat', subtab: 'facebook' },
  'social-chat-instagram': { tab: 'social-chat', subtab: 'instagram' },
  'social-chat-whatsapp': { tab: 'social-chat', subtab: 'whatsapp' },
  'social-chat-tiktok': { tab: 'social-chat', subtab: 'tiktok' },
  'crm-contacts': { tab: 'crm', subtab: 'contacts' },
  'crm-contact-details': { tab: 'crm', subtab: 'contacts' },
  'crm-custom-fields': { tab: 'crm', subtab: 'custom-fields' },
  'crm-leads': { tab: 'crm', subtab: 'leads' },
  'crm-emails': { tab: 'crm', subtab: 'emails' },
  'crm-segments': { tab: 'crm', subtab: 'segments' },
  'crm-analytics': { tab: 'crm', subtab: 'analytics' },
  'control-center-team': { tab: 'control-center', subtab: 'team' },
  tasks: { tab: 'crm', subtab: 'tasks' },
  'control-center-dashboard': { tab: 'control-center', subtab: 'dashboard' },
  'control-center-analytics': { tab: 'control-center', subtab: 'analytics' },
  'control-center-settings': { tab: 'control-center', subtab: 'settings' },
  'control-center-integrations': { tab: 'control-center', subtab: 'integrations' },
  'manage-api': { tab: 'control-center', subtab: 'manage-api' },
  setup: { tab: 'setup' },
  'inbox-all': { tab: 'social-chat', subtab: 'inbox' },
  'inbox-chatbot': { tab: 'social-chat', subtab: 'inbox' },
  'inbox-live-chat': { tab: 'social-chat', subtab: 'inbox' },
  'inbox-tickets': { tab: 'social-chat', subtab: 'inbox' },
  'inbox-social-messages': { tab: 'social-chat', subtab: 'inbox' },
  'inbox-comments': { tab: 'social-chat', subtab: 'inbox' },
  'inbox-archived': { tab: 'social-chat', subtab: 'inbox-archived' },
  'live-chat-settings': { tab: 'live-chat', subtab: 'settings' },
  'automation-marketing-email-campaigns': {
    tab: 'automation',
    subtab: 'marketing-email-campaigns',
  },
  'automation-marketing-lead-capture': {
    tab: 'automation',
    subtab: 'marketing-lead-capture',
  },
  'automation-marketing-coupon-delivery': {
    tab: 'automation',
    subtab: 'marketing-coupon-delivery',
  },
  'automation-marketing-proactive-sales': {
    tab: 'automation',
    subtab: 'marketing-proactive-sales',
  },
  'automation-sales-email-sequences': {
    tab: 'automation',
    subtab: 'sales-email-sequences',
  },
  'automation-sales-abandoned-cart': {
    tab: 'automation',
    subtab: 'sales-abandoned-cart',
  },
  'automation-sales-promo-banner': {
    tab: 'automation',
    subtab: 'sales-promo-banner',
  },
  'automation-sales-sales-notifications': {
    tab: 'automation',
    subtab: 'sales-sales-notifications',
  },
  'automation-support-auto-responses': {
    tab: 'automation',
    subtab: 'support-auto-responses',
  },
};

// Map tab/subtab to page type
const tabToPageMap: Record<string, Record<string, PageType>> = {
  apps: {
    'proactive-sales': 'proactive-sales',
    'coupon-delivery': 'coupon-delivery',
    'order-tracker': 'order-tracker',
    'image-search': 'image-search',
    'ticket-system': 'ticket-system',
    'refund-return': 'refund-return',
  },
  'social-chat': {
    settings: 'social-chat',
    inbox: 'social-chat-inbox',
    'inbox-archived': 'inbox-archived',
    campaigns: 'social-chat-campaigns',
    facebook: 'social-chat-facebook',
    instagram: 'social-chat-instagram',
    whatsapp: 'social-chat-whatsapp',
    tiktok: 'social-chat-tiktok',
  },
  crm: {
    contacts: 'crm-contacts',
    leads: 'crm-leads',
    emails: 'crm-emails',
    segments: 'crm-segments',
    analytics: 'crm-analytics',
    tasks: 'tasks',
    'custom-fields': 'crm-custom-fields',
    'abandoned-cart': 'abandoned-cart',
    'appointments-bookings': 'appointments-bookings',
  },
  'control-center': {
    dashboard: 'control-center-dashboard',
    analytics: 'control-center-analytics',
    settings: 'control-center-settings',
    integrations: 'control-center-integrations',
    team: 'control-center-team',
    'manage-api': 'manage-api',
  },
  'live-chat': {
    settings: 'live-chat-settings',
  },
  automation: {
    'marketing-email-campaigns': 'automation-marketing-email-campaigns',
    'marketing-lead-capture': 'automation-marketing-lead-capture',
    'marketing-coupon-delivery': 'automation-marketing-coupon-delivery',
    'marketing-proactive-sales': 'automation-marketing-proactive-sales',
    'sales-email-sequences': 'automation-sales-email-sequences',
    'sales-abandoned-cart': 'automation-sales-abandoned-cart',
    'sales-promo-banner': 'automation-sales-promo-banner',
    'sales-sales-notifications': 'automation-sales-sales-notifications',
    'support-auto-responses': 'automation-support-auto-responses',
  },
};

function getPageFromUrl(): PageType {
  const urlParams = new URLSearchParams(window.location.search);
  const tab = urlParams.get('tab');
  const subtab = urlParams.get('subtab');

  // Redirect legacy customization/behavior URLs to settings
  if (tab === 'customization' || tab === 'behavior') {
    return 'settings';
  }

  if (tab && subtab && tabToPageMap[tab]?.[subtab]) {
    return tabToPageMap[tab][subtab];
  }

  if (tab) {
    // Try to find a page that matches the tab directly
    const pageEntry = Object.entries(pageToTabMap).find(
      ([, value]) => value.tab === tab && !value.subtab
    );
    if (pageEntry) {
      return pageEntry[0] as PageType;
    }
  }

  return 'setup';
}

function updateUrlParams(page: PageType) {
  const urlParams = new URLSearchParams(window.location.search);
  const tabMap = pageToTabMap[page];

  if (tabMap) {
    urlParams.set('tab', tabMap.tab);
    if (tabMap.subtab) {
      urlParams.set('subtab', tabMap.subtab);
    } else {
      urlParams.delete('subtab');
    }
  }

  const newUrl = `${window.location.pathname}?${urlParams.toString()}`;
  window.history.replaceState({}, '', newUrl);
}

/** Build full admin URL for a page (for guaranteed navigation/redirect) */
export function getAdminUrlForPage(page: PageType): string {
  const tabMap = pageToTabMap[page];
  if (!tabMap) return window.location.href;
  const params = new URLSearchParams();
  params.set('page', 'helpmate');
  params.set('tab', tabMap.tab);
  if (tabMap.subtab) {
    params.set('subtab', tabMap.subtab);
  }
  return `${window.location.pathname}?${params.toString()}`;
}

interface MainContextProps {
  page: PageType;
  setPage: (value: PageType) => void;
  modules: Record<string, boolean>;
}

const MainContext = createContext<MainContextProps | null>(null);

export function useMain() {
  const context = useContext(MainContext);
  if (!context) {
    throw new Error('useMain must be used within a MainProvider');
  }
  return context;
}

interface MainProviderProps {
  children: React.ReactNode;
}

export function MainProvider({ children }: MainProviderProps) {
  const { getModulesQuery } = useSettings();
  const { data: modules } = getModulesQuery;

  const [page, setPageState] = useState<PageType>(getPageFromUrl());

  // Update URL when page changes
  const setPage = useCallback((newPage: PageType) => {
    setPageState(newPage);
    updateUrlParams(newPage);
  }, []);

  // Listen for URL changes (browser back/forward)
  useEffect(() => {
    const handlePopState = () => {
      const newPage = getPageFromUrl();
      setPageState(newPage);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Normalize URL when landing with legacy tab=customization or tab=behavior
  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get('tab');
    if ((tab === 'customization' || tab === 'behavior') && page === 'settings') {
      updateUrlParams('settings');
    }
  }, [page]);

  const value = useMemo(
    () => ({
      page,
      setPage,
      modules: modules ?? {},
    }),
    [page, setPage, modules]
  );

  return <MainContext.Provider value={value}>{children}</MainContext.Provider>;
}
