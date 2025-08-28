import aiChatbot from '@/assets/apps/ai.svg';
import promoMegaphone from '@/assets/apps/promo-megaphone.svg';
import rotateCCW from '@/assets/apps/rotate-ccw.svg';
import shoppingCartAbandoned from '@/assets/apps/shopping-cart-abandoned.svg';
import truckLocation from '@/assets/apps/truck-location.svg';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar';
import { PageType, useMain } from '@/context/MainContext';
import { useSettings } from '@/hooks/useSettings';
import { cn } from '@/lib/utils';
import { SidebarMenuItemType } from '@/types';
import {
  BellRing,
  Brain,
  ChevronRight,
  Crown,
  Rocket,
  ScanSearch,
  TicketPercent,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import Score from './Score';
import { ChangeSvgColor } from 'svg-color-tools';

interface MenuItemProps {
  label: string | React.ReactNode;
  page: PageType;
  currentPage: PageType;
  onClick: (page: PageType) => void;
  icon: React.ReactNode;
  className?: string;
  pro?: boolean;
}

function MenuItem({
  label,
  page,
  currentPage,
  onClick,
  icon,
  className,
  pro,
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
              'text-gray-500 !text-sm',
              currentPage === page &&
                'text-sidebar-primary-foreground [&_path]:stroke-primary'
            )}
          >
            {icon}{' '}
          </div>
        )}
        {label}
      </SidebarMenuButton>
      {pro && (
        <SidebarMenuBadge
          className={cn("transition-opacity", (currentPage === page || isHovered) ? "opacity-100" : "opacity-0")}
        >
          <Crown className="w-4 h-4 text-primary" strokeWidth={1.5} />
        </SidebarMenuBadge>
      )}
    </SidebarMenuSubItem>
  );
}

export function AppSidebar() {
  const { page, setPage, modules, totalScore } = useMain();
  const { getProQuery } = useSettings();
  const isPro = getProQuery.data ?? false;

  const menuItems: SidebarMenuItemType[] = [
    {
      label: 'Train Chatbot',
      page: 'data-source',
    },
    {
      label: 'Analytics',
      page: 'dashboard',
    },
    {
      label: 'Activity',
      page: 'activity',
    },
    {
      label: 'Customization',
      page: 'customization',
    },
    {
      label: 'Behavior',
      page: 'behavior',
    },
    {
      label: 'Settings',
      page: 'settings',
    },
  ];

  const moduleItems: SidebarMenuItemType[] = useMemo(
    () => [
      {
        label: 'Order Tracker',
        page: 'order-tracker',
        icon: <ChangeSvgColor src={truckLocation} className="w-4 h-4" />,
        status: modules['order-tracker'],
        pro: isPro,
      },
      {
        label: 'Image Search',
        page: 'image-search',
        icon: <ScanSearch className="w-4 h-4" strokeWidth={1.5} />,
        status: modules['image-search'],
        pro: isPro,
      },
      {
        label: 'Proactive Sales',
        page: 'proactive-sales',
        icon: <Rocket className="w-4 h-4" strokeWidth={1.5} />,
        status: modules['proactive-sales'],
        pro: isPro,
      },
      {
        label: 'Sales Notifications',
        page: 'sales-notifications',
        icon: <BellRing className="w-4 h-4" strokeWidth={1.5} />,
        status: modules['sales-notifications'],
        pro: true,
      },
      {
        label: 'Promo Bar',
        page: 'promo-banner',
        icon: <ChangeSvgColor src={promoMegaphone} className="w-4 h-4" />,
        status: modules['promo-banner'],
        pro: true,
      },
      {
        label: 'Coupon Delivery',
        page: 'coupon-delivery',
        icon: <TicketPercent className="w-4 h-4" strokeWidth={1.5} />,
        status: modules['coupon-delivery'],
        pro: isPro,
      },
      {
        label: 'Abandoned Cart',
        page: 'abandoned-cart',
        icon: (
          <ChangeSvgColor src={shoppingCartAbandoned} className="w-4 h-4" />
        ),
        status: modules['abandoned-cart'],
        pro: isPro,
      },
      {
        label: 'Refund & Return',
        page: 'refund-return',
        icon: <ChangeSvgColor src={rotateCCW} className="w-4 h-4" />,
        status: modules['refund-return'],
        pro: isPro,
      },
    ],
    [modules, isPro]
  );

  return (
    <Sidebar className="p-2">
      <SidebarContent className="gap-0">
        <div className="p-2 pb-0">
          <SidebarMenu>
            <SidebarMenuSubItem className="!mb-0">
              <SidebarMenuButton
                className="cursor-pointer"
                onClick={() => setPage('apps')}
                isActive={page === 'apps'}
              >
                <Brain className="w-5 h-5" strokeWidth={1.5} />
                App Center
              </SidebarMenuButton>
            </SidebarMenuSubItem>
          </SidebarMenu>
        </div>
        {modules['chatbot'] && (
          <div className="p-2">
            <SidebarMenu>
              <Collapsible defaultOpen className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton className="cursor-pointer">
                      <img src={aiChatbot} className="w-4 h-4" /> AI Chatbot
                      <ChevronRight
                        className="w-5 h-5 ml-auto group-data-[state=open]/collapsible:rotate-90"
                        strokeWidth={1.5}
                      />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub className="border-border/70">
                      {menuItems.map((item) => (
                        <MenuItem
                          key={item.page}
                          label={item.label}
                          page={item.page}
                          currentPage={page}
                          onClick={setPage}
                          icon={item.icon}
                          className="!ml-2"
                        />
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            </SidebarMenu>
          </div>
        )}
        {moduleItems?.some((module) => module.status) && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-base">
              App Settings
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {moduleItems.map(
                  (item) =>
                    item.status && (
                      <MenuItem
                        key={item.page}
                        label={item.label}
                        page={item.page}
                        currentPage={page}
                        onClick={setPage}
                        icon={item.icon}
                        pro={!item.pro}
                      />
                    )
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter>
        <div className="flex flex-col gap-2 items-center">
          <Score score={totalScore} />
          <div className="pt-2 w-full text-xs text-center text-gray-400 border-t border-gray-200">
            Helpmate v0.0.1
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
