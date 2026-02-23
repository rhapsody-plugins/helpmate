import adminHub from '@/assets/apps/admin-hub.svg';
import automation from '@/assets/apps/automation.svg';
import comments from '@/assets/apps/comments.svg';
import conversionAutomation from '@/assets/apps/conversion-automation.svg';
import crm from '@/assets/apps/crm.svg';
import emailTemplate from '@/assets/apps/email-template.svg';
import liveChat from '@/assets/apps/live-chat.svg';
import marketingAutomation from '@/assets/apps/marketing-automaiton.svg';
import promoMegaphone from '@/assets/apps/promo-megaphone.svg';
import rotateCCW from '@/assets/apps/rotate-ccw.svg';
import salesAutomation from '@/assets/apps/sales-automation.svg';
import shoppingCartAbandoned from '@/assets/apps/shopping-cart-abandoned.svg';
import supportAutomation from '@/assets/apps/support-automation.svg';
import teamManagement from '@/assets/apps/team-management.svg';
import ticketSystem from '@/assets/apps/ticket-system.svg';
import truckLocation from '@/assets/apps/truck-location.svg';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { PageType, useMain } from '@/contexts/MainContext';
import { useApi } from '@/hooks/useApi';
import { useUnreadCounts } from '@/hooks/useNotifications';
import { usePermissions } from '@/hooks/usePermissions';
import { useSettings } from '@/hooks/useSettings';
import api from '@/lib/axios';
import { cn } from '@/lib/utils';
import { SidebarMenuItemType } from '@/types';
import { Icon } from '@iconify/react';
import { useQuery } from '@tanstack/react-query';
import {
  Archive,
  BarChart3,
  BellRing,
  BookUser,
  Bot,
  Brain,
  CalendarClock,
  ChevronRight,
  Crown,
  Database,
  Facebook,
  FlaskConical,
  Inbox,
  Instagram,
  KeyRound,
  Layers,
  LayoutDashboard,
  ListChecks,
  Mails,
  MessageCircleReply,
  Package,
  Radio,
  Rocket,
  ScanSearch,
  Send,
  Settings2,
  Share2,
  TextCursorInput,
  TicketPercent,
  UserRoundSearch,
  UserSearch
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChangeSvgColor } from 'svg-color-tools';

export type SectionId =
  | 'dashboard'
  | 'helpmate-ai'
  | 'automations'
  | 'inbox'
  | 'channels'
  | 'crm'
  | 'control-center';

const PAGE_TO_SECTION: Record<PageType, SectionId> = {
  analytics: 'control-center',
  activity: 'inbox',
  'data-source': 'helpmate-ai',
  settings: 'automations',
  'proactive-sales': 'automations',
  'abandoned-cart': 'crm',
  'coupon-delivery': 'automations',
  'order-tracker': 'automations',
  'image-search': 'automations',
  'ticket-system': 'automations',
  'refund-return': 'automations',
  'app-center': 'automations',
  'train-chatbot': 'helpmate-ai',
  'test-chatbot': 'automations',
  'social-chat': 'channels',
  'social-chat-inbox': 'inbox',
  'social-chat-campaigns': 'channels',
  'social-chat-facebook': 'channels',
  'social-chat-instagram': 'channels',
  'social-chat-whatsapp': 'channels',
  'social-chat-tiktok': 'channels',
  'crm-contacts': 'crm',
  'crm-contact-details': 'crm',
  'crm-custom-fields': 'crm',
  'crm-leads': 'crm',
  'crm-emails': 'crm',
  'crm-segments': 'crm',
  'crm-analytics': 'crm',
  'control-center-team': 'control-center',
  tasks: 'crm',
  'control-center-dashboard': 'dashboard',
  'control-center-analytics': 'control-center',
  'control-center-settings': 'control-center',
  'manage-api': 'control-center',
  setup: 'control-center',
  'inbox-all': 'inbox',
  'inbox-chatbot': 'inbox',
  'inbox-live-chat': 'inbox',
  'inbox-tickets': 'inbox',
  'inbox-social-messages': 'inbox',
  'inbox-comments': 'inbox',
  'inbox-archived': 'inbox',
  'live-chat-settings': 'channels',
  'automation-marketing-email-campaigns': 'automations',
  'automation-marketing-lead-capture': 'automations',
  'automation-marketing-coupon-delivery': 'automations',
  'automation-marketing-proactive-sales': 'automations',
  'automation-sales-email-sequences': 'automations',
  'automation-sales-abandoned-cart': 'automations',
  'automation-sales-promo-banner': 'automations',
  'automation-sales-sales-notifications': 'automations',
  'automation-support-auto-responses': 'automations',
  'appointments-bookings': 'crm',
};

const CRM_PAGE_TO_MENU_PAGE: Partial<Record<PageType, PageType>> = {
  'crm-contact-details': 'crm-contacts',
};

const ICON_BAR_WIDTH = '3.5rem';
const SUBMENU_PANEL_WIDTH = '16rem';

interface MenuItemProps {
  label: string | React.ReactNode;
  page: PageType;
  currentPage: PageType;
  onClick: (page: PageType) => void;
  icon: React.ReactNode;
  className?: string;
  pro?: boolean;
  badge?: React.ReactNode;
}

function SubmenuItem({
  label,
  page,
  currentPage,
  onClick,
  icon,
  className,
  pro,
  badge,
}: MenuItemProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <SidebarMenuSubItem
      className="!mb-0"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <SidebarMenuButton
        size="sm"
        className={cn(
          'cursor-pointer data-[active=true]:bg-secondary-50',
          className
        )}
        onClick={() => onClick(page)}
        isActive={currentPage === page}
      >
        {icon && (
          <div
            className={cn(
              'text-foreground !text-sm',
              currentPage === page &&
              'text-sidebar-primary-foreground [&_path]:stroke-primary'
            )}
          >
            {icon}{' '}
          </div>
        )}
        {label}
      </SidebarMenuButton>
      {badge && <SidebarMenuBadge>{badge}</SidebarMenuBadge>}
      {pro && (
        <SidebarMenuBadge
          className={cn(
            'transition-opacity',
            currentPage === page || isHovered ? 'opacity-100' : 'opacity-0'
          )}
        >
          <Crown className="w-4 h-4 text-primary" strokeWidth={1.5} />
        </SidebarMenuBadge>
      )}
    </SidebarMenuSubItem>
  );
}

function AutomationGroup({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-border">
      <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-semibold text-foreground rounded-t-md bg-border/25">
        {icon && (
          <span className="text-foreground [&_svg]:w-4 [&_svg]:h-4">
            {icon}
          </span>
        )}
        {title}
      </div>

      <div className="!p-1">
        {children}
      </div>
    </div>
  );
}

export function AppSidebar() {
  const { page, setPage, modules } = useMain();
  const { getProQuery } = useSettings();
  const isPro = getProQuery.data ?? false;
  const { apiKeyQuery } = useApi();
  const apiKey = apiKeyQuery.data?.api_key;
  const { data: unreadCounts } = useUnreadCounts();
  const { data: inboxCounts } = useQuery({
    queryKey: ['social-counts'],
    queryFn: async () => {
      const { data } = await api.get<{
        error: boolean;
        unread: number;
        handoff_pending: number;
        by_inbox?: {
          chatbot: number;
          live_chat: number;
          tickets: number;
          social_messages: number;
          comments: number;
        };
      }>('/social/counts');
      return data;
    },
    refetchInterval: 30_000,
  });
  const inboxUnread = inboxCounts?.unread ?? 0;
  const byInbox = inboxCounts?.by_inbox;
  const {
    canAccess,
    hasRole,
    isLoading: permissionsLoading,
  } = usePermissions();
  const { isMobile, submenuOpen, setSubmenuOpen, openMobile, setOpenMobile } =
    useSidebar();

  const [selectedSection, setSelectedSection] = useState<SectionId | null>(null);

  const activeSection: SectionId = useMemo(() => {
    return selectedSection ?? PAGE_TO_SECTION[page] ?? 'dashboard';
  }, [selectedSection, page]);

  // Sync sidebar section when page changes (e.g. Connect from Auto DM → Channels)
  useEffect(() => {
    const section = PAGE_TO_SECTION[page];
    if (section) {
      setSelectedSection(section);
      if (section !== 'dashboard') setSubmenuOpen(true);
    }
  }, [page, setSubmenuOpen]);

  const setActiveSectionAndOpen = useCallback(
    (section: SectionId, firstPage?: PageType) => {
      setSelectedSection(section);
      if (section === 'dashboard') {
        setPage('control-center-dashboard');
        setSubmenuOpen(false);
      } else {
        setSubmenuOpen(true);
        if (firstPage != null) setPage(firstPage);
      }
    },
    [setPage, setSubmenuOpen]
  );

  // Inbox menu items (badges from conversation unread counts, not header notifications)
  const inboxMenuItems: SidebarMenuItemType[] = useMemo(() => {
    const badge = (n: number) =>
      n > 0 ? (
        <span className="bg-primary text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
          {n}
        </span>
      ) : undefined;
    return [
      {
        label: 'All Conversations',
        page: 'inbox-all',
        icon: <Inbox className="w-4 h-4" strokeWidth={1.5} />,
        badge: badge(inboxUnread),
      },
      {
        label: 'Chatbot',
        page: 'inbox-chatbot',
        icon: <Bot className="w-4 h-4" strokeWidth={1.5} />,
        badge: badge(byInbox?.chatbot ?? 0),
      },
      {
        label: 'Live Chat',
        page: 'inbox-live-chat',
        icon: <ChangeSvgColor src={liveChat} strokeWidth="1.5px" className="w-4 h-4 stroke-current [&_path]:stroke-current" />,
        pro: !isPro,
      },
      {
        label: 'Tickets',
        page: 'inbox-tickets',
        icon: <ChangeSvgColor src={ticketSystem} strokeWidth="1.5px" className="w-4 h-4 stroke-current [&_path]:stroke-current" />,
        badge: badge(byInbox?.tickets ?? 0),
      },
      {
        label: 'Social Messages',
        page: 'inbox-social-messages',
        icon: <Share2 className="w-4 h-4" strokeWidth={1.5} />,
        badge: badge(byInbox?.social_messages ?? 0),
        pro: !isPro,
      },
      {
        label: 'Comments',
        page: 'inbox-comments',
        icon: <ChangeSvgColor src={comments} strokeWidth="1.5px" className="w-4 h-4" />,
        badge: badge(byInbox?.comments ?? 0),
        pro: !isPro,
      },
      {
        label: 'Archived',
        page: 'inbox-archived',
        icon: <Archive className="w-4 h-4" strokeWidth={1.5} />,
      },
    ];
  }, [inboxUnread, byInbox, isPro]);

  const filteredInboxMenuItems = useMemo(() => {
    if (permissionsLoading || !canAccess('live_chat')) return [];
    return inboxMenuItems.filter(
      (item) =>
        item.page !== 'inbox-tickets' || canAccess('tickets')
    );
  }, [inboxMenuItems, permissionsLoading, canAccess]);

  const channelsMenuItems: SidebarMenuItemType[] = useMemo(
    () => [
      {
        label: 'Facebook',
        page: 'social-chat-facebook' as PageType,
        icon: <Facebook className="w-4 h-4" strokeWidth={1.5} />,
        pro: !isPro,
      },
      {
        label: 'Instagram',
        page: 'social-chat-instagram' as PageType,
        icon: <Instagram className="w-4 h-4" strokeWidth={1.5} />,
        pro: !isPro,
      },
      {
        label: 'WhatsApp',
        page: 'social-chat-whatsapp' as PageType,
        icon: <Icon icon="mdi:whatsapp" className="w-4 h-4" />,
        pro: !isPro,
      },
      {
        label: 'TikTok (coming soon)',
        page: 'social-chat-tiktok' as PageType,
        icon: (
          <Icon
            icon="ph:tiktok-logo-thin"
            className="w-4 h-4 [&_path]:stroke-[8] [&_path]:fill-none [&_path]:stroke-current"
          />
        ),
        pro: !isPro,
      },
    ],
    [isPro]
  );

  const filteredChannelsMenuItems = useMemo(() => {
    if (permissionsLoading) return [];
    return channelsMenuItems.filter(() => canAccess('chat_settings'));
  }, [channelsMenuItems, permissionsLoading, canAccess]);

  const liveChatMenuItem: SidebarMenuItemType = useMemo(
    () => ({
      label: 'Live Chat',
      page: 'live-chat-settings' as PageType,
      icon: <ChangeSvgColor src={liveChat} strokeWidth="1.5px" className="w-4 h-4 stroke-current [&_path]:stroke-current" />,
      pro: !isPro,
    }),
    [isPro]
  );
  const showLiveChatMenuItem = !permissionsLoading && canAccess('live_chat');

  const chatbotMenuItems: SidebarMenuItemType[] = [
    {
      label: 'Test Chatbot',
      page: 'test-chatbot',
      icon: <FlaskConical className="w-4 h-4" strokeWidth={1.5} />,
    },
    {
      label: 'Customization',
      page: 'settings',
      icon: <Settings2 className="w-4 h-4" strokeWidth={1.5} />,
    },
  ];

  const controlCenterMenuItems: SidebarMenuItemType[] = useMemo(() => {
    const items: SidebarMenuItemType[] = [
      {
        label: 'Teams & Roles',
        page: 'control-center-team',
        icon: <ChangeSvgColor src={teamManagement} strokeWidth="1.5px" className="w-4 h-4" />,
      },
    ];
    if (apiKey) {
      items.push({
        label: 'Manage API Key',
        page: 'manage-api',
        icon: <KeyRound className="w-4 h-4" strokeWidth={1.5} />,
      });
    }
    items.push(
      {
        label: 'Analytics',
        page: 'control-center-analytics',
        icon: <BarChart3 className="w-4 h-4" strokeWidth={1.5} />,
      },
      {
        label: 'Modules',
        page: 'control-center-settings',
        icon: <Package className="w-4 h-4" strokeWidth={1.5} />,
      }
    );
    return items;
  }, [apiKey]);

  const helpmateAIMenuItems: SidebarMenuItemType[] = useMemo(() => {
    if (permissionsLoading || !canAccess('chat_settings')) return [];
    return [
      {
        label: 'Knowledge Base',
        page: 'data-source',
        icon: <Database className="w-4 h-4" strokeWidth={1.5} />,
      },
    ];
  }, [permissionsLoading, canAccess]);

  const appointmentBadgeCount = unreadCounts?.by_type?.appointment ?? 0;
  const leadBadgeCount = unreadCounts?.by_type?.lead ?? 0;
  const taskBadgeCount = unreadCounts?.by_type?.task ?? 0;
  const crmMenuItems: SidebarMenuItemType[] = useMemo(
    () => [
      {
        label: 'Contacts',
        page: 'crm-contacts',
        icon: <BookUser className="w-4 h-4" strokeWidth={1.5} />,
      },
      {
        label: 'Leads',
        page: 'crm-leads',
        icon: <UserSearch className="w-4 h-4" strokeWidth={1.5} />,
        badge:
          leadBadgeCount > 0 ? (
            <span className="bg-primary text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
              {leadBadgeCount}
            </span>
          ) : undefined,
      },
      {
        label: 'Appointments & Bookings',
        page: 'appointments-bookings',
        icon: <CalendarClock className="w-4 h-4" strokeWidth={1.5} />,
        pro: !isPro,
        badge:
          appointmentBadgeCount > 0 ? (
            <span className="bg-primary text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
              {appointmentBadgeCount}
            </span>
          ) : undefined,
      },
      {
        label: 'Segments',
        page: 'crm-segments',
        icon: <Layers className="w-4 h-4" strokeWidth={1.5} />,
        pro: !isPro,
      },
      {
        label: 'Custom Fields',
        page: 'crm-custom-fields',
        icon: <TextCursorInput className="w-4 h-4" strokeWidth={1.5} />,
        pro: !isPro,
      },
      {
        label: 'Tasks',
        page: 'tasks',
        icon: <ListChecks className="w-4 h-4" strokeWidth={1.5} />,
        pro: !isPro,
        badge:
          taskBadgeCount > 0 ? (
            <span className="bg-primary text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
              {taskBadgeCount}
            </span>
          ) : undefined,
      },
      {
        label: 'Email Templates',
        page: 'crm-emails',
        icon: <ChangeSvgColor src={emailTemplate} strokeWidth=".14px" className="w-4 h-4 stroke-white fill-current [&_path]:fill-current [&_path]:!stroke-white" />,
        pro: !isPro,
      },
    ],
    [isPro, appointmentBadgeCount, leadBadgeCount, taskBadgeCount]
  );

  const moduleItems: SidebarMenuItemType[] = useMemo(
    () => [
      {
        label: 'Order Status Tracking',
        page: 'order-tracker',
        icon: (
          <ChangeSvgColor src={truckLocation} strokeWidth="2px" className="w-4 h-4 stroke-current [&_path]:stroke-current" />
        ),
        status: modules['order-tracker'],
        pro: !isPro,
      },
      {
        label: 'Product Search by Image',
        page: 'image-search',
        icon: <ScanSearch className="w-4 h-4" strokeWidth={1.5} />,
        status: modules['image-search'],
        pro: !isPro,
      },
      {
        label: 'Refund & Return',
        page: 'refund-return',
        icon: (
          <ChangeSvgColor src={rotateCCW} strokeWidth="2px" className="w-4 h-4 stroke-current [&_path]:stroke-current" />
        ),
        status: modules['refund-return'],
        pro: !isPro,
      },
    ],
    [modules, isPro]
  );

  const automationSupportMenuItems: SidebarMenuItemType[] = useMemo(
    () => [
      {
        label: 'Auto DM & Comments',
        page: 'automation-support-auto-responses',
        icon: <MessageCircleReply className="w-4 h-4" strokeWidth={1.5} />,
        pro: !isPro,
      },
    ],
    [isPro]
  );

  const automationMarketingMenuItems: SidebarMenuItemType[] = useMemo(
    () => [
      {
        label: 'Email Campaigns',
        page: 'automation-marketing-email-campaigns',
        icon: <Send className="w-4 h-4" strokeWidth={1.5} />,
        pro: !isPro,
      },
      {
        label: 'Lead Capture',
        page: 'automation-marketing-lead-capture',
        icon: <UserRoundSearch className="w-4 h-4" strokeWidth={1.5} />,
      },
      {
        label: 'Coupon Delivery',
        page: 'automation-marketing-coupon-delivery',
        icon: <TicketPercent className="w-4 h-4" strokeWidth={1.5} />,
        status: modules['coupon-delivery'],
        pro: !isPro,
      },
      {
        label: 'Proactive Sales',
        page: 'automation-marketing-proactive-sales',
        icon: <Rocket className="w-4 h-4" strokeWidth={1.5} />,
        status: modules['proactive-sales'],
        pro: !isPro,
      },
    ],
    [isPro, modules]
  );

  const automationSalesMenuItems: SidebarMenuItemType[] = useMemo(
    () => [
      {
        label: 'Email Sequences',
        page: 'automation-sales-email-sequences',
        icon: <Mails className="w-4 h-4" strokeWidth={1.5} />,
        pro: !isPro,
      },
      {
        label: 'Abandoned Cart',
        page: 'automation-sales-abandoned-cart',
        icon: (
          <ChangeSvgColor src={shoppingCartAbandoned} strokeWidth="2px" className="w-4 h-4 stroke-current [&_path]:stroke-current" />
        ),
        pro: !isPro,
      },
    ],
    [isPro, modules]
  );

  const automationConversionMenuItems: SidebarMenuItemType[] = useMemo(
    () => [
      {
        label: 'Promo Bar',
        page: 'automation-sales-promo-banner',
        icon: <ChangeSvgColor src={promoMegaphone} strokeWidth="2px" className="w-4 h-4 stroke-current [&_path]:stroke-current" />,
        status: modules['promo-banner'],
      },
      {
        label: 'Sales Notifications',
        page: 'automation-sales-sales-notifications',
        icon: <BellRing className="w-4 h-4" strokeWidth={1.5} />,
        status: modules['sales-notifications'],
      },
    ],
    [modules]
  );

  const filteredAutomationSupportMenuItems = useMemo(() => {
    if (permissionsLoading || !canAccess('chat_settings')) return [];
    return automationSupportMenuItems;
  }, [automationSupportMenuItems, permissionsLoading, canAccess]);

  const filteredAutomationMarketingMenuItems = useMemo(() => {
    if (permissionsLoading) return [];
    return automationMarketingMenuItems.filter((item) => {
      if (!item.status) {
        if (
          item.page === 'automation-marketing-proactive-sales' ||
          item.page === 'automation-marketing-coupon-delivery'
        )
          return true;
      }
      if (
        item.page === 'automation-marketing-email-campaigns' ||
        item.page === 'automation-marketing-lead-capture'
      ) {
        return (
          canAccess('emails') ||
          canAccess('crm_emails') ||
          canAccess('leads') ||
          canAccess('crm_leads')
        );
      }
      if (
        item.page === 'automation-marketing-proactive-sales' ||
        item.page === 'automation-marketing-coupon-delivery'
      ) {
        return canAccess('chat_settings');
      }
      return true;
    });
  }, [
    automationMarketingMenuItems,
    permissionsLoading,
    canAccess,
  ]);

  const filteredAutomationSalesMenuItems = useMemo(() => {
    if (permissionsLoading) return [];
    return automationSalesMenuItems.filter(
      () =>
        canAccess('emails') ||
        canAccess('crm_emails') ||
        canAccess('chat_settings')
    );
  }, [automationSalesMenuItems, permissionsLoading, canAccess]);

  const filteredAutomationConversionMenuItems = useMemo(() => {
    if (permissionsLoading) return [];
    if (!canAccess('chat_settings') && !canAccess('conversion_automation'))
      return [];
    return automationConversionMenuItems;
  }, [automationConversionMenuItems, permissionsLoading, canAccess]);

  const filteredChatbotMenuItems = useMemo(() => {
    if (permissionsLoading) return [];
    return chatbotMenuItems.filter((item) => {
      if (item.page === 'test-chatbot' || item.page === 'settings') {
        return canAccess('chat_settings');
      }
      return true;
    });
  }, [chatbotMenuItems, permissionsLoading, canAccess]);

  const filteredModuleItems = useMemo(() => {
    if (permissionsLoading) return [];
    return moduleItems.filter((item) => {
      if (item.page === 'refund-return') {
        return canAccess('live_chat') || canAccess('tickets');
      }
      if (item.page === 'order-tracker' || item.page === 'image-search') {
        return canAccess('chat_settings');
      }
      return true;
    });
  }, [moduleItems, permissionsLoading, canAccess]);

  const filteredControlCenterMenuItems = useMemo(() => {
    if (permissionsLoading) return [];
    return controlCenterMenuItems.filter((item) => {
      if (item.page === 'control-center-analytics') return canAccess('analytics');
      if (item.page === 'control-center-settings') return hasRole('admin');
      if (item.page === 'control-center-team') return canAccess('team_management');
      if (item.page === 'manage-api') return hasRole('admin');
      return true;
    });
  }, [controlCenterMenuItems, permissionsLoading, canAccess, hasRole]);

  const filteredCrmMenuItems = useMemo(() => {
    if (permissionsLoading) return [];
    return crmMenuItems.filter((item) => {
      if (item.page === 'crm-contacts') {
        return (
          canAccess('crm_contacts') ||
          canAccess('contacts_view') ||
          canAccess('contacts_full')
        );
      }
      if (item.page === 'crm-leads') return canAccess('crm_leads') || canAccess('leads');
      if (item.page === 'tasks') return canAccess('crm_tasks') || canAccess('tasks');
      if (item.page === 'crm-emails')
        return canAccess('crm_emails') || canAccess('emails');
      if (item.page === 'crm-segments')
        return canAccess('crm_segments') || canAccess('segments');
      if (item.page === 'crm-custom-fields') return canAccess('crm_custom_fields');
      if (item.page === 'appointments-bookings')
        return canAccess('appointments') || canAccess('crm_contacts');
      return true;
    });
  }, [crmMenuItems, permissionsLoading, canAccess]);

  const hasAnyAutomationAccess = useMemo(() => {
    if (permissionsLoading) return false;
    return (
      filteredAutomationSupportMenuItems.length > 0 ||
      filteredAutomationConversionMenuItems.length > 0 ||
      filteredAutomationMarketingMenuItems.length > 0 ||
      filteredAutomationSalesMenuItems.length > 0
    );
  }, [
    permissionsLoading,
    filteredAutomationSupportMenuItems,
    filteredAutomationConversionMenuItems,
    filteredAutomationMarketingMenuItems,
    filteredAutomationSalesMenuItems,
  ]);

  const dashboardMenuItem = useMemo(
    () => ({
      label: 'Dashboard',
      page: 'control-center-dashboard' as PageType,
      icon: <LayoutDashboard className="w-4 h-4" strokeWidth={1.5} />,
    }),
    []
  );

  // Combined badge counts per top-level section (sum of submenu notification counts)
  const inboxSectionBadge = inboxUnread;
  const crmSectionBadge =
    (appointmentBadgeCount ?? 0) + (leadBadgeCount ?? 0) + (taskBadgeCount ?? 0);

  const sectionFirstPages = useMemo((): Partial<Record<SectionId, PageType>> => {
    const map: Partial<Record<SectionId, PageType>> = {};
    if (helpmateAIMenuItems.length > 0) {
      map['helpmate-ai'] = helpmateAIMenuItems[0]?.page;
    }
    if (hasAnyAutomationAccess) {
      const automationsFirst =
        filteredAutomationSupportMenuItems[0]?.page ??
        filteredAutomationConversionMenuItems[0]?.page ??
        (modules['chatbot']
          ? apiKey
            ? filteredChatbotMenuItems[0]?.page ?? filteredModuleItems[0]?.page
            : ('data-source' as PageType)
          : undefined) ??
        filteredAutomationSalesMenuItems[0]?.page ??
        filteredAutomationMarketingMenuItems[0]?.page;
      if (automationsFirst) map['automations'] = automationsFirst;
    }
    if (filteredInboxMenuItems.length > 0) {
      map['inbox'] = filteredInboxMenuItems[0]?.page;
    }
    map['channels'] = filteredChannelsMenuItems[0]?.page ?? (showLiveChatMenuItem
      ? liveChatMenuItem.page
      : undefined);
    if (filteredCrmMenuItems.length > 0) {
      map['crm'] = filteredCrmMenuItems[0]?.page;
    }
    if (filteredControlCenterMenuItems.length > 0) {
      map['control-center'] = filteredControlCenterMenuItems[0]?.page;
    }
    return map;
  }, [
    helpmateAIMenuItems,
    hasAnyAutomationAccess,
    filteredAutomationSupportMenuItems,
    filteredAutomationConversionMenuItems,
    modules['chatbot'],
    apiKey,
    filteredChatbotMenuItems,
    filteredModuleItems,
    filteredAutomationSalesMenuItems,
    filteredAutomationMarketingMenuItems,
    filteredInboxMenuItems,
    showLiveChatMenuItem,
    liveChatMenuItem,
    filteredChannelsMenuItems,
    filteredCrmMenuItems,
    filteredControlCenterMenuItems,
  ]);

  const topLevelSections = useMemo(() => {
    const sections: {
      id: SectionId;
      label: string;
      icon: React.ReactNode;
      badgeCount?: number;
    }[] = [];
    if (canAccess('analytics')) {
      sections.push({
        id: 'dashboard',
        label: 'Dashboard',
        icon: <LayoutDashboard className="w-5 h-5" strokeWidth={1.5} />,
      });
    }
    if (helpmateAIMenuItems.length > 0) {
      sections.push({
        id: 'helpmate-ai',
        label: 'Helpmate AI',
        icon: <Brain className="w-5 h-5" strokeWidth={1.5} />,
      });
    }
    if (hasAnyAutomationAccess) {
      sections.push({
        id: 'automations',
        label: 'Automations',
        icon: <ChangeSvgColor src={automation} stroke="currentColor" className="w-5 h-5" />,
      });
    }
    if (filteredInboxMenuItems.length > 0) {
      sections.push({
        id: 'inbox',
        label: 'Inbox',
        icon: <Inbox className="w-5 h-5" strokeWidth={1.5} />,
        badgeCount: inboxSectionBadge,
      });
    }
    sections.push({
      id: 'channels',
      label: 'Channels',
      icon: <Radio className="w-5 h-5" strokeWidth={1.5} />,
    });
    if (filteredCrmMenuItems.length > 0) {
      sections.push({
        id: 'crm',
        label: 'CRM',
        icon: <ChangeSvgColor src={crm} strokeWidth="1.5px" className="w-5 h-5 stroke-current [&_path]:stroke-current" />,
        badgeCount: crmSectionBadge,
      });
    }
    if (filteredControlCenterMenuItems.length > 0) {
      sections.push({
        id: 'control-center',
        label: 'Admin Hub',
        icon: <ChangeSvgColor src={adminHub} strokeWidth="1.5px" className="w-5 h-5" />,
      });
    }
    return sections;
  }, [
    canAccess,
    helpmateAIMenuItems.length,
    hasAnyAutomationAccess,
    filteredInboxMenuItems.length,
    filteredCrmMenuItems.length,
    filteredControlCenterMenuItems.length,
    inboxSectionBadge,
    crmSectionBadge,
  ]);

  const renderSubmenuContent = () => {
    if (activeSection === 'dashboard') {
      return (
        <SidebarMenuSub className="border-0">
          <SubmenuItem
            label={dashboardMenuItem.label}
            page={dashboardMenuItem.page}
            currentPage={page}
            onClick={setPage}
            icon={dashboardMenuItem.icon}
            className="!ml-0"
          />
        </SidebarMenuSub>
      );
    }
    if (activeSection === 'helpmate-ai') {
      return (
        <SidebarMenuSub className="border-0">
          {helpmateAIMenuItems.map((item) => (
            <SubmenuItem
              key={item.page}
              label={item.label}
              page={item.page}
              currentPage={page}
              onClick={setPage}
              icon={item.icon}
              className="!ml-0"
              pro={item.pro}
              badge={item.badge}
            />
          ))}
        </SidebarMenuSub>
      );
    }
    if (activeSection === 'automations') {
      return (
        <div className="flex flex-col gap-2">
          {filteredAutomationSupportMenuItems.length > 0 && (
            <AutomationGroup title="Support Automation" icon={<ChangeSvgColor
              stroke='#6a7282'
              src={supportAutomation}
              className="w-4 h-4 stroke-current [&_path]:stroke-current"
            />}>
              <SidebarMenuSub className="border-0">
                {filteredAutomationSupportMenuItems.map((item) => (
                  <SubmenuItem
                    key={item.page}
                    label={item.label}
                    page={item.page}
                    currentPage={page}
                    onClick={setPage}
                    icon={item.icon}
                    className="!ml-0"
                    pro={item.pro}
                  />
                ))}
              </SidebarMenuSub>
              {modules['chatbot'] && (
                <Collapsible defaultOpen className="group/cbot">
                  <CollapsibleTrigger className="flex w-full items-center gap-2 px-2 py-1.5 text-xs font-semibold text-foreground rounded-md hover:!bg-none text-inherit cursor-pointer">
                    <span className="text-foreground [&_svg]:w-4 [&_svg]:h-4">
                      <Bot className="w-4 h-4" strokeWidth={1.5} />
                    </span>
                    Chatbot
                    <ChevronRight className="ml-auto w-4 h-4 shrink-0 transition-transform duration-200 group-data-[state=open]/cbot:rotate-90" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub className="border-0">
                      {!apiKey ? (
                        <SubmenuItem
                          label="Chatbot"
                          page="data-source"
                          currentPage={page}
                          onClick={setPage}
                          icon={<Bot className="w-4 h-4" strokeWidth={1.5} />}
                          className="!ml-0 hover:!bg-none"
                        />
                      ) : (
                        <>
                          {filteredChatbotMenuItems.map((item) => (
                            <SubmenuItem
                              key={item.page}
                              label={item.label}
                              page={item.page}
                              currentPage={page}
                              onClick={setPage}
                              icon={item.icon}
                              className="!ml-0"
                              pro={item.pro}
                              badge={item.badge}
                            />
                          ))}
                          {filteredModuleItems.map((item) => (
                            <SubmenuItem
                              key={item.page}
                              label={item.label}
                              page={item.page}
                              currentPage={page}
                              onClick={setPage}
                              icon={item.icon}
                              className="!ml-0"
                              pro={item.pro}
                              badge={item.badge}
                            />
                          ))}
                        </>
                      )}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </AutomationGroup>
          )}
          {filteredAutomationSalesMenuItems.length > 0 && (
            <AutomationGroup title="Sales Automation" icon={<ChangeSvgColor
              stroke='#6a7282'
              src={salesAutomation}
              className="w-4 h-4 stroke-current [&_path]:stroke-current"
            />}>
              <SidebarMenuSub className="border-0">
                {filteredAutomationSalesMenuItems.map((item) => (
                  <SubmenuItem
                    key={item.page}
                    label={item.label}
                    page={item.page}
                    currentPage={page}
                    onClick={setPage}
                    icon={item.icon}
                    className="!ml-0"
                    pro={item.pro}
                  />
                ))}
              </SidebarMenuSub>
            </AutomationGroup>
          )}
          {filteredAutomationMarketingMenuItems.length > 0 && (
            <AutomationGroup title="Marketing Automation" icon={<ChangeSvgColor
              stroke='#6a7282'
              src={marketingAutomation}
              className="w-4 h-4 stroke-current [&_path]:stroke-current"
            />}>
              <SidebarMenuSub className="border-0">
                {filteredAutomationMarketingMenuItems.map((item) => (
                  <SubmenuItem
                    key={item.page}
                    label={item.label}
                    page={item.page}
                    currentPage={page}
                    onClick={setPage}
                    icon={item.icon}
                    className="!ml-0"
                    pro={item.pro}
                  />
                ))}
              </SidebarMenuSub>
            </AutomationGroup>
          )}
          {filteredAutomationConversionMenuItems.length > 0 && (
            <AutomationGroup title="Conversion Automation" icon={<ChangeSvgColor
              stroke='#6a7282'
              src={conversionAutomation}
              className="w-4 h-4 stroke-current [&_path]:stroke-current"
            />}>
              <SidebarMenuSub className="border-0">
                {filteredAutomationConversionMenuItems.map((item) => (
                  <SubmenuItem
                    key={item.page}
                    label={item.label}
                    page={item.page}
                    currentPage={page}
                    onClick={setPage}
                    icon={item.icon}
                    className="!ml-0"
                    pro={item.pro}
                  />
                ))}
              </SidebarMenuSub>
            </AutomationGroup>
          )}
        </div>
      );
    }
    if (activeSection === 'inbox') {
      return (
        <SidebarMenuSub className="border-0">
          {filteredInboxMenuItems.map((item) => (
            <SubmenuItem
              key={item.page}
              label={item.label}
              page={item.page}
              currentPage={page}
              onClick={setPage}
              icon={item.icon}
              className="!ml-0"
              pro={item.pro}
              badge={item.badge}
            />
          ))}
        </SidebarMenuSub>
      );
    }
    if (activeSection === 'channels') {
      return (
        <div className="flex flex-col gap-2">
          {filteredChannelsMenuItems.length > 0 && (
            <AutomationGroup
              title="Social platforms"
              icon={<Share2 className="w-4 h-4" strokeWidth={1.5} />}
            >
              <SidebarMenuSub className="border-0">
                {filteredChannelsMenuItems.map((item) => (
                  <SubmenuItem
                    key={item.page}
                    label={item.label}
                    page={item.page}
                    currentPage={page}
                    onClick={setPage}
                    icon={item.icon}
                    className="!ml-0"
                    pro={item.pro}
                    badge={item.badge}
                  />
                ))}
              </SidebarMenuSub>
            </AutomationGroup>
          )}
          {showLiveChatMenuItem && (
            <SidebarMenuSub className="border-0">
              <SubmenuItem
                label={liveChatMenuItem.label}
                page={liveChatMenuItem.page}
                currentPage={page}
                onClick={setPage}
                icon={liveChatMenuItem.icon}
                className="!ml-0"
                pro={liveChatMenuItem.pro}
              />
            </SidebarMenuSub>
          )}
        </div>
      );
    }
    if (activeSection === 'crm') {
      const crmMenuCurrentPage = (CRM_PAGE_TO_MENU_PAGE[page] ?? page) as PageType;
      return (
        <SidebarMenuSub className="border-0">
          {filteredCrmMenuItems.map((item) => (
            <SubmenuItem
              key={item.page}
              label={item.label}
              page={item.page}
              currentPage={crmMenuCurrentPage}
              onClick={setPage}
              icon={item.icon}
              className="!ml-0"
              pro={item.pro}
              badge={item.badge}
            />
          ))}
        </SidebarMenuSub>
      );
    }
    if (activeSection === 'control-center') {
      return (
        <SidebarMenuSub className="border-0">
          {filteredControlCenterMenuItems.map((item) => (
            <SubmenuItem
              key={item.page}
              label={item.label}
              page={item.page}
              currentPage={page}
              onClick={setPage}
              icon={item.icon}
              className="!ml-0"
              pro={item.pro}
              badge={item.badge}
            />
          ))}
        </SidebarMenuSub>
      );
    }
    return null;
  };

  if (permissionsLoading) {
    const iconBarSkeletonCount = 7;
    return (
      <div
        className="flex overflow-hidden h-full min-h-full rounded-lg border shrink-0 bg-sidebar border-border/50"
        style={{ width: ICON_BAR_WIDTH }}
      >
        <div
          className={cn(
            'flex flex-col shrink-0 border-r border-border/50 bg-sidebar gap-3 items-center pt-2',
            'w-[3.5rem] min-w-[3.5rem]'
          )}
        >
          {Array.from({ length: iconBarSkeletonCount }, (_, i) => (
            <Skeleton
              key={i}
              className="w-7 h-7"
            />
          ))}
        </div>
      </div>
    );
  }

  if (isMobile) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile}>
        <SheetContent
          side="left"
          className="w-[18rem] p-0 bg-sidebar text-sidebar-foreground [&>button]:hidden"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>
          <div className="flex overflow-auto flex-col gap-2 py-4">
            {topLevelSections.map((section) => (
              <div key={section.id} className="px-2">
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                  {section.label}
                </div>
                <div className="mt-1">
                  {section.id === 'dashboard' && canAccess('analytics') && (
                    <button
                      type="button"
                      onClick={() => {
                        setPage('control-center-dashboard');
                        setOpenMobile(false);
                      }}
                      className={cn(
                        'flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm',
                        page === 'control-center-dashboard' &&
                        'bg-sidebar-primary text-sidebar-primary-foreground'
                      )}
                    >
                      <LayoutDashboard className="w-4 h-4" />
                      Dashboard
                    </button>
                  )}
                  {section.id === 'helpmate-ai' &&
                    helpmateAIMenuItems.map((item) => (
                      <button
                        key={item.page}
                        type="button"
                        onClick={() => {
                          setPage(item.page);
                          setOpenMobile(false);
                        }}
                        className={cn(
                          'flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm',
                          page === item.page &&
                          'bg-sidebar-primary text-sidebar-primary-foreground'
                        )}
                      >
                        {item.icon}
                        {item.label}
                      </button>
                    ))}
                  {section.id === 'automations' && (
                    <div className="flex flex-col gap-2">
                      {filteredAutomationSupportMenuItems.length > 0 && (
                        <AutomationGroup title="Support Automation" icon={<ChangeSvgColor
                          stroke='#6a7282'
                          src={supportAutomation}
                          className="w-4 h-4"
                        />}>
                          <div className="flex flex-col gap-0.5">
                            {filteredAutomationSupportMenuItems.map((item) => (
                              <button
                                key={item.page}
                                type="button"
                                onClick={() => {
                                  setPage(item.page);
                                  setOpenMobile(false);
                                }}
                                className={cn(
                                  'flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm',
                                  page === item.page &&
                                  'bg-sidebar-primary text-sidebar-primary-foreground'
                                )}
                              >
                                {item.icon}
                                {item.label}
                              </button>
                            ))}
                            {modules['chatbot'] && (
                              <Collapsible defaultOpen className="group/cbot">
                                <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-semibold text-foreground hover:!bg-none">
                                  <Bot className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                                  Chatbot
                                  <ChevronRight className="ml-auto w-4 h-4 shrink-0 transition-transform duration-200 group-data-[state=open]/cbot:rotate-90" />
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                  <div className="flex flex-col gap-0.5">
                                    {!apiKey ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setPage('data-source');
                                          setOpenMobile(false);
                                        }}
                                        className={cn(
                                          'flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm hover:!bg-none',
                                          page === 'data-source' &&
                                          'bg-sidebar-primary text-sidebar-primary-foreground'
                                        )}
                                      >
                                        <Bot className="w-4 h-4" strokeWidth={1.5} />
                                        Chatbot
                                      </button>
                                    ) : (
                                      <>
                                        {filteredChatbotMenuItems.map((item) => (
                                          <button
                                            key={item.page}
                                            type="button"
                                            onClick={() => {
                                              setPage(item.page);
                                              setOpenMobile(false);
                                            }}
                                            className={cn(
                                              'flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm',
                                              page === item.page &&
                                              'bg-sidebar-primary text-sidebar-primary-foreground'
                                            )}
                                          >
                                            {item.icon}
                                            {item.label}
                                          </button>
                                        ))}
                                        {filteredModuleItems.map((item) => (
                                          <button
                                            key={item.page}
                                            type="button"
                                            onClick={() => {
                                              setPage(item.page);
                                              setOpenMobile(false);
                                            }}
                                            className={cn(
                                              'flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm',
                                              page === item.page &&
                                              'bg-sidebar-primary text-sidebar-primary-foreground'
                                            )}
                                          >
                                            {item.icon}
                                            {item.label}
                                          </button>
                                        ))}
                                      </>
                                    )}
                                  </div>
                                </CollapsibleContent>
                              </Collapsible>
                            )}
                          </div>
                        </AutomationGroup>
                      )}
                      {filteredAutomationSalesMenuItems.length > 0 && (
                        <AutomationGroup title="Sales Automation" icon={<ChangeSvgColor
                          stroke='#6a7282'
                          src={salesAutomation}
                          className="w-4 h-4"
                        />}>
                          <div className="flex flex-col gap-0.5">
                            {filteredAutomationSalesMenuItems.map((item) => (
                              <button
                                key={item.page}
                                type="button"
                                onClick={() => {
                                  setPage(item.page);
                                  setOpenMobile(false);
                                }}
                                className={cn(
                                  'flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm',
                                  page === item.page &&
                                  'bg-sidebar-primary text-sidebar-primary-foreground'
                                )}
                              >
                                {item.icon}
                                {item.label}
                              </button>
                            ))}
                          </div>
                        </AutomationGroup>
                      )}
                      {filteredAutomationMarketingMenuItems.length > 0 && (
                        <AutomationGroup title="Marketing Automation" icon={<ChangeSvgColor
                          stroke='#6a7282'
                          src={marketingAutomation}
                          className="w-4 h-4"
                        />}>
                          <div className="flex flex-col gap-0.5">
                            {filteredAutomationMarketingMenuItems.map((item) => (
                              <button
                                key={item.page}
                                type="button"
                                onClick={() => {
                                  setPage(item.page);
                                  setOpenMobile(false);
                                }}
                                className={cn(
                                  'flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm',
                                  page === item.page &&
                                  'bg-sidebar-primary text-sidebar-primary-foreground'
                                )}
                              >
                                {item.icon}
                                {item.label}
                              </button>
                            ))}
                          </div>
                        </AutomationGroup>
                      )}
                      {filteredAutomationConversionMenuItems.length > 0 && (
                        <AutomationGroup title="Conversion Automation" icon={<ChangeSvgColor
                          stroke='#6a7282'
                          src={conversionAutomation}
                          className="w-4 h-4"
                        />}>
                          <div className="flex flex-col gap-0.5">
                            {filteredAutomationConversionMenuItems.map((item) => (
                              <button
                                key={item.page}
                                type="button"
                                onClick={() => {
                                  setPage(item.page);
                                  setOpenMobile(false);
                                }}
                                className={cn(
                                  'flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm',
                                  page === item.page &&
                                  'bg-sidebar-primary text-sidebar-primary-foreground'
                                )}
                              >
                                {item.icon}
                                {item.label}
                              </button>
                            ))}
                          </div>
                        </AutomationGroup>
                      )}
                    </div>
                  )}
                  {section.id === 'inbox' &&
                    filteredInboxMenuItems.map((item) => (
                      <button
                        key={item.page}
                        type="button"
                        onClick={() => {
                          setPage(item.page);
                          setOpenMobile(false);
                        }}
                        className={cn(
                          'flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm',
                          page === item.page &&
                          'bg-sidebar-primary text-sidebar-primary-foreground'
                        )}
                      >
                        {item.icon}
                        {item.label}
                        {item.badge}
                      </button>
                    ))}
                  {section.id === 'channels' && (
                    <>
                      {filteredChannelsMenuItems.length > 0 && (
                        <div className="p-1 rounded-md border border-border">
                          <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-semibold text-foreground rounded-t-md bg-border/25 mb-1">
                            <Share2 className="w-4 h-4" strokeWidth={1.5} />
                            Social platforms
                          </div>
                          {filteredChannelsMenuItems.map((item) => (
                            <button
                              key={item.page}
                              type="button"
                              onClick={() => {
                                setPage(item.page);
                                setOpenMobile(false);
                              }}
                              className={cn(
                                'flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm',
                                page === item.page &&
                                'bg-sidebar-primary text-sidebar-primary-foreground'
                              )}
                            >
                              {item.icon}
                              {item.label}
                              {item.badge}
                              {item.pro && (
                                <Crown className="w-4 h-4 shrink-0 text-primary" strokeWidth={1.5} />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                      {showLiveChatMenuItem && (
                        <button
                          type="button"
                          onClick={() => {
                            setPage('live-chat-settings');
                            setOpenMobile(false);
                          }}
                          className={cn(
                            'flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm mt-2',
                            page === 'live-chat-settings' &&
                            'bg-sidebar-primary text-sidebar-primary-foreground'
                          )}
                        >
                          <ChangeSvgColor src={liveChat} strokeWidth="1.5px" className="w-4 h-4 stroke-current [&_path]:stroke-current" />
                          Live Chat
                          {!isPro && (
                            <Crown className="w-4 h-4 shrink-0 text-primary" strokeWidth={1.5} />
                          )}
                        </button>
                      )}
                    </>
                  )}
                  {section.id === 'crm' &&
                    filteredCrmMenuItems.map((item) => (
                      <button
                        key={item.page}
                        type="button"
                        onClick={() => {
                          setPage(item.page);
                          setOpenMobile(false);
                        }}
                        className={cn(
                          'flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm',
                          page === item.page &&
                          'bg-sidebar-primary text-sidebar-primary-foreground'
                        )}
                      >
                        {item.icon}
                        {item.label}
                        {item.badge}
                        {item.pro && (
                          <Crown className="w-4 h-4 shrink-0 text-primary" strokeWidth={1.5} />
                        )}
                      </button>
                    ))}
                  {section.id === 'control-center' && (
                    <>
                      {filteredControlCenterMenuItems.map((item) => (
                        <button
                          key={item.page}
                          type="button"
                          onClick={() => {
                            setPage(item.page);
                            setOpenMobile(false);
                          }}
                          className={cn(
                            'flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm',
                            page === item.page &&
                            'bg-sidebar-primary text-sidebar-primary-foreground'
                          )}
                        >
                          {item.icon}
                          {item.label}
                        </button>
                      ))}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  const showSubmenuPanel =
    submenuOpen && activeSection !== 'dashboard';

  const sidebarWidth =
    activeSection === 'dashboard'
      ? ICON_BAR_WIDTH
      : showSubmenuPanel
        ? `calc(${ICON_BAR_WIDTH} + ${SUBMENU_PANEL_WIDTH})`
        : ICON_BAR_WIDTH;

  return (
    <div
      className="flex shrink-0 h-full min-h-full bg-sidebar border border-border/50 rounded-lg rounded-r-none overflow-hidden transition-[width] duration-200 ease-linear"
      style={{ width: sidebarWidth }}
    >
      {/* Panel 1: Icon bar */}
      <div
        className={cn(
          'flex flex-col shrink-0 h-full min-h-full border-r border-border/50 bg-sidebar',
          'w-[3.5rem] min-w-[3.5rem]'
        )}
      >
        {topLevelSections.map((section) => (
          <Tooltip key={section.id} delayDuration={0}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => {
                  setActiveSectionAndOpen(section.id, sectionFirstPages[section.id]);
                }}
                className={cn(
                  'relative flex items-center justify-center w-full h-10 rounded-none transition-colors cursor-pointer',
                  activeSection === section.id
                    ? 'bg-primary-100 text-primary'
                    : 'hover:bg-sidebar-accent/50 text-sidebar-foreground'
                )}
                aria-label={section.label}
              >
                {section.icon}
                {section.badgeCount != null && section.badgeCount > 0 && (
                  <span className="absolute top-1 right-1 bg-primary text-primary-foreground text-[10px] font-medium rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-1">
                    {section.badgeCount > 99 ? '99+' : section.badgeCount}
                  </span>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" align="center">
              {section.label}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>

      {/* Panel 2: Submenu (no second level for dashboard) */}
      {showSubmenuPanel && (
        <div
          className="flex flex-col h-full min-h-full shrink-0 bg-sidebar [overflow:overlay]"
          style={{ width: SUBMENU_PANEL_WIDTH, minWidth: SUBMENU_PANEL_WIDTH }}
        >
          <div className="p-2">
            {renderSubmenuContent()}
          </div>
        </div>
      )}
    </div>
  );
}
