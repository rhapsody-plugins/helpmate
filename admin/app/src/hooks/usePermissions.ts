import { useTeam } from './useTeam';
import { PageType } from '@/contexts/MainContext';

// Map pages to required permissions
const PAGE_PERMISSIONS: Record<PageType, string[]> = {
  'analytics': ['analytics'],
  'activity': ['analytics'],
  'data-source': ['chat_settings'],
  'settings': ['chat_settings'],
  'proactive-sales': ['chat_settings'],
  'abandoned-cart': ['chat_settings'],
  'coupon-delivery': ['chat_settings'],
  'order-tracker': ['chat_settings'],
  'image-search': ['chat_settings'],
  'ticket-system': ['live_chat', 'tickets'],
  'refund-return': ['live_chat', 'tickets'],
  'app-center': [], // Always accessible
  'train-chatbot': ['chat_settings'],
  'test-chatbot': ['chat_settings'],
  'social-chat': ['chat_settings'], // Settings page requires chat_settings
  'social-chat-inbox': ['live_chat'],
  'social-chat-campaigns': ['chat_settings'],
  'social-chat-facebook': ['chat_settings'],
  'social-chat-instagram': ['chat_settings'],
  'social-chat-whatsapp': ['chat_settings'],
  'social-chat-tiktok': ['chat_settings'],
  'crm-contacts': ['crm_contacts', 'contacts_view', 'contacts_full'],
  'crm-contact-details': ['crm_contacts', 'contacts_view', 'contacts_full'],
  'crm-custom-fields': ['crm_custom_fields'],
  'crm-leads': ['crm_leads', 'leads'],
  'crm-emails': ['crm_emails', 'emails'],
  'crm-segments': ['crm_segments', 'segments'],
  'crm-analytics': ['analytics'],
  'control-center-team': ['team_management'],
  'tasks': ['crm_tasks', 'tasks'],
  'control-center-analytics': ['analytics'],
  'control-center-dashboard': ['analytics'],
  'control-center-settings': ['team_management'], // Requires admin role (checked separately in PageGuard)
  'control-center-integrations': ['team_management'], // Requires admin role (checked separately in PageGuard)
  'manage-api': ['team_management'], // Requires admin role (checked separately in PageGuard)
  'appointments-bookings': ['appointments', 'crm_contacts'],
  'automation-marketing-email-campaigns': ['emails', 'crm_emails'],
  'automation-marketing-lead-capture': ['leads', 'crm_leads'],
  'automation-marketing-coupon-delivery': ['chat_settings'],
  'automation-marketing-proactive-sales': ['chat_settings'],
  'automation-sales-email-sequences': ['emails', 'crm_emails'],
  'automation-sales-abandoned-cart': ['emails', 'crm_emails'],
  'automation-sales-promo-banner': ['chat_settings', 'conversion_automation'],
  'automation-sales-sales-notifications': ['chat_settings', 'conversion_automation'],
  'automation-support-auto-responses': ['chat_settings'],
  'inbox-all': ['live_chat'],
  'inbox-chatbot': ['live_chat'],
  'inbox-live-chat': ['live_chat'],
  'inbox-tickets': ['live_chat', 'tickets'],
  'inbox-social-messages': ['live_chat'],
  'inbox-comments': ['live_chat'],
  'inbox-archived': ['live_chat'],
  'live-chat-settings': ['live_chat', 'chat_settings'],
  'setup': [], // Always accessible for setup
};

export function usePermissions() {
  const { useUserPermissions } = useTeam();
  const permissionsQuery = useUserPermissions();

  // Helper to safely get permissions array
  const getPermissions = (): string[] => {
    if (!permissionsQuery.data?.permissions) return [];
    // Handle case where permissions might be an object (PHP array with gaps)
    if (Array.isArray(permissionsQuery.data.permissions)) {
      return permissionsQuery.data.permissions;
    }
    // Convert object to array if needed
    if (typeof permissionsQuery.data.permissions === 'object') {
      return Object.values(permissionsQuery.data.permissions);
    }
    return [];
  };

  // Helper to safely get roles array
  const getRoles = (): string[] => {
    if (!permissionsQuery.data?.roles) return [];
    return Array.isArray(permissionsQuery.data.roles)
      ? permissionsQuery.data.roles
      : [];
  };

  const canAccess = (feature: string): boolean => {
    if (!permissionsQuery.data) return false;
    const permissions = getPermissions();
    return (
      permissions.includes('all_features') ||
      permissions.includes(feature)
    );
  };

  const hasRole = (role: string): boolean => {
    if (!permissionsQuery.data) return false;
    const roles = getRoles();
    return roles.includes(role);
  };

  const hasAnyRole = (roles: string[]): boolean => {
    if (!permissionsQuery.data) return false;
    const userRoles = getRoles();
    return roles.some((role) => userRoles.includes(role));
  };

  const hasAllRoles = (roles: string[]): boolean => {
    if (!permissionsQuery.data) return false;
    const userRoles = getRoles();
    return roles.every((role) => userRoles.includes(role));
  };

  const canAccessPage = (page: PageType): boolean => {
    if (!permissionsQuery.data) return false;
    const requiredPermissions = PAGE_PERMISSIONS[page] || [];
    const permissions = getPermissions();

    // Check if user has all_features
    if (permissions.includes('all_features')) {
      return true;
    }

    // If no permissions required, allow access
    if (requiredPermissions.length === 0) return true;

    // Check if user has any of the required permissions
    return requiredPermissions.some((perm) =>
      permissions.includes(perm)
    );
  };

  return {
    ...permissionsQuery,
    canAccess,
    hasRole,
    hasAnyRole,
    hasAllRoles,
    canAccessPage,
  };
}

