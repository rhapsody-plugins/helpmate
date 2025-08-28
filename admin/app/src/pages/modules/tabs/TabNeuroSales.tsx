import aiChatbotIcon from '@/assets/apps/ai.svg';
import abandonedCart from '@/assets/apps/abandoned-cart.svg';
import couponDelivery from '@/assets/apps/coupon-delivery.svg';
import proactiveSales from '@/assets/apps/proactive-sales.svg';
import promoBar from '@/assets/apps/promo-bar.svg';
import promoMegaphoneIcon from '@/assets/apps/promo-megaphone.svg';
import refundReturn from '@/assets/apps/refund-return.svg';
import rotateCCWIcon from '@/assets/apps/rotate-ccw.svg';
import salesNotifications from '@/assets/apps/sales-notifications.svg';
import shoppingCartAbandonedIcon from '@/assets/apps/shopping-cart-abandoned.svg';
import { ProBadge } from '@/components/ProBadge';
import { Card } from '@/components/ui/card';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useMain } from '@/context/MainContext';
import { useCustomIcons } from '@/hooks/useCustomIcons';
import { useSettings } from '@/hooks/useSettings';
import { cn } from '@/lib/utils';
import { BellRing, Rocket, TicketPercent } from 'lucide-react';
import { JSX, useCallback, useMemo } from 'react';
import { ChangeSvgColor } from 'svg-color-tools';

interface Module {
  id: string;
  title: string;
  icon: JSX.Element;
  disabled?: boolean;
  dependencies?: JSX.Element[];
  pro?: boolean;
  image?: string;
  tooltipMessage?: string;
  proTooltipMessage?: string;
  buttonText?: string;
}

interface ModuleCardProps {
  module: Module;
  isEnabled: boolean;
  onToggle: (moduleId: string) => void;
  isPending: boolean;
  disabled?: boolean;
  dependencies?: JSX.Element[];
  pro?: boolean;
  image?: string;
  className?: string;
}

const ModuleCard = ({
  module,
  isEnabled,
  onToggle,
  isPending,
  disabled,
  className,
}: Omit<ModuleCardProps, 'pro' | 'image' | 'dependencies'>) => {
  return (
    <Card
      className={cn(
        'flex relative flex-col gap-3 justify-between p-4 rounded-2xl group',
        className
      )}
    >
      {!module.pro && (
        <ProBadge
          topMessage={module.proTooltipMessage}
          tooltipMessage={null}
          className="opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          buttonText={module.buttonText}
          messageBg={className}
        />
      )}
      <div
        className={cn(
          'flex flex-col gap-3',
          !module.pro &&
            'group-hover:opacity-30 transition-opacity duration-300 cursor-not-allowed pointer-events-none'
        )}
      >
        <div className="flex gap-3 items-center">
          <div className="text-2xl">{module.icon}</div>
          <h2 className="!text-base !font-bold !m-0 !p-0 !flex items-center gap-1">
            {module.title}{' '}
            {module.tooltipMessage && (
              <InfoTooltip message={module.tooltipMessage} />
            )}
          </h2>
          <div className="ml-auto">
            <Switch
              checked={isEnabled}
              onCheckedChange={() => onToggle(module.id)}
              disabled={isPending || disabled}
            />
          </div>
        </div>
        {module.image && (
          <img
            src={module.image}
            alt={module.title}
            className="object-contain mt-auto w-full"
          />
        )}
        {module.dependencies && module.dependencies.length > 0 && (
          <div className="flex justify-center items-center -my-2">
            {module.dependencies.map(
              (dependency: JSX.Element, index: number) => (
                <span
                  key={index}
                  className="flex justify-center items-center w-10 h-10"
                >
                  {dependency}
                </span>
              )
            )}
          </div>
        )}
      </div>
    </Card>
  );
};

const ModuleCardSkeleton = ({ className }: { className?: string }) => {
  return (
    <Card
      className={cn(
        'flex relative flex-col gap-3 justify-between p-4 rounded-2xl',
        className
      )}
    >
      <div className="flex flex-col gap-3">
        <div className="flex gap-3 items-center">
          <Skeleton className="w-6 h-6 rounded" />
          <Skeleton className="w-32 h-4" />
          <div className="ml-auto">
            <Skeleton className="w-10 h-6 rounded-full" />
          </div>
        </div>
        <Skeleton className="w-full h-32 rounded-lg" />
      </div>
    </Card>
  );
};

export default function TabNeuroSales() {
  const { modules } = useMain();
  const { updateSettingsMutation, getModulesQuery, getProQuery } =
    useSettings();
  const isPro = getProQuery.data ?? false;
  const { mutateAsync: updateSettings, isPending: updateIsPending } =
    updateSettingsMutation;
  const icons = useCustomIcons(['woocommerce']);

  // Check if any queries are loading
  const isLoading = getModulesQuery.isLoading || getProQuery.isLoading;

  const neuroSalesModules = useMemo(
    () => [
      {
        id: 'proactive-sales',
        title: 'Proactive Sales',
        tooltipMessage:
          'This feature lets the chatbot automatically suggest discounted products on the Chat window. It increases conversion rates and average order value.',
        proTooltipMessage:
          "It's like having a sales rep in every visitor's pocket, ready with the perfect pitch",
        icon: <Rocket strokeWidth={1} className="w-6 h-6" />,
        pro: isPro,
        dependencies: icons['woocommerce']
          ? [
              icons['woocommerce'],
              <ChangeSvgColor
                src={aiChatbotIcon}
                className="w-6 h-6"
                stroke="#94A3B8"
              />,
            ]
          : [],
        image: proactiveSales,
        disabled: false,
        buttonText: 'Boost Sales Conversations',
      },
      {
        id: 'sales-notifications',
        title: 'Sales Notifications',
        tooltipMessage:
          'Display real-time sales activity like "Someone just purchased this" to create social proof. It helps to build urgency and trust by showing that others are buying the product.',
        proTooltipMessage:
          '"John from Dallas just bought this." Now it\'s your turn. Leverage social proof instantly',
        icon: <BellRing strokeWidth={1} className="w-6 h-6" />,
        pro: true,
        dependencies: icons['woocommerce'] ? [icons['woocommerce']] : [],
        image: salesNotifications,
        disabled: false,
        buttonText: 'Create Buying Momentum',
      },
      {
        id: 'promo-banner',
        title: 'Promo Bar',
        tooltipMessage:
          'The promo bar allows you to display ongoing deals, free shipping offers, or announcements at the top or bottom of your site. You can drive more clicks and sales by highlighting limited-time offers or coupons.',
        proTooltipMessage:
          'Want them to buy more? A promo bar nudges average cart value up',
        icon: (
          <img
            src={promoMegaphoneIcon}
            className="w-6 h-6"
            alt="promo-banner"
          />
        ),
        pro: true,
        image: promoBar,
        disabled: false,
        buttonText: 'Highlight Your Best Deals',
      },
      {
        id: 'coupon-delivery',
        title: 'Coupon Delivery',
        tooltipMessage:
          'Automatically deliver personalized coupons when customers engage in chat or show exit intent. Helps reduce cart abandonment and increase average order value.',
        proTooltipMessage:
          'Imagine your chatbot whispering "Here\'s 10% off" right before they bounce. That\'s smart conversion',
        icon: <TicketPercent strokeWidth={1} className="w-6 h-6" />,
        pro: isPro,
        dependencies: icons['woocommerce']
          ? [
              icons['woocommerce'],
              <ChangeSvgColor
                src={aiChatbotIcon}
                className="w-6 h-6"
                stroke="#94A3B8"
              />,
            ]
          : [],
        image: couponDelivery,
        disabled: false,
        buttonText: 'Turn Exits into Orders',
      },
      {
        id: 'abandoned-cart',
        title: 'Abandoned Cart',
        tooltipMessage:
          'Sends reminder messages via email to bring users back and recover lost sales. Helps boost revenue by converting missed opportunities into purchases.',
        proTooltipMessage:
          "You paid for the click. Don't lose the cart. Recover sales automatically",
        icon: (
          <img
            src={shoppingCartAbandonedIcon}
            className="w-6 h-6"
            alt="abandoned-cart"
          />
        ),
        pro: isPro,
        dependencies: icons['woocommerce'] ? [icons['woocommerce']] : [],
        image: abandonedCart,
        disabled: false,
        buttonText: 'Recover Lost Carts Now',
      },
      {
        id: 'refund-return',
        title: 'Refund & Return',
        tooltipMessage:
          'This tool lets users initiate refund or return requests directly through chat. Makes your store more trustworthy by offering an easy and transparent return experience.',
        proTooltipMessage:
          "It's not just a refund. It's your reputation. Offer seamless return experiences and build trust",
        icon: (
          <img src={rotateCCWIcon} className="w-6 h-6" alt="refund-return" />
        ),
        pro: isPro,
        dependencies: icons['woocommerce']
          ? [
              icons['woocommerce'],
              <ChangeSvgColor
                src={aiChatbotIcon}
                className="w-6 h-6"
                stroke="#94A3B8"
              />,
            ]
          : [],
        image: refundReturn,
        disabled: false,
        buttonText: 'Build Loyalty with Ease',
      },
    ],
    [icons, isPro]
  );

  const handleModuleToggle = useCallback(
    async (moduleId: string) => {
      const newSettings = { ...modules, [moduleId]: !modules[moduleId] };
      await updateSettings(
        {
          key: 'modules',
          data: newSettings,
        },
        {
          onSuccess: () => {
            getModulesQuery.refetch();
          },
        }
      );
    },
    [modules, updateSettings, getModulesQuery]
  );

  return (
    <div className="flex flex-col gap-2">
      <h2 className="!text-[18px] !font-semibold !m-0 !mb-4 bg-primary-100 rounded-lg px-4 py-3 !flex items-center">
        NeuroSales
        <sup className="flex justify-center items-center w-3.5 h-3.5 text-[8px] p-0.5 rounded-full border border-black -mt-1">
          RP
        </sup>{' '}
        Apps
        <InfoTooltip message="NeuroSales is a collection of tools that help you sell more products and increase your revenue. It includes features like proactive sales, sales notifications, promo bar, coupon delivery, abandoned cart, refund & return, and more." />
      </h2>
      {isLoading ? (
        // Show skeleton loading state
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3 min-[1600px]:grid-cols-4">
          {Array.from({ length: neuroSalesModules.length }).map((_, index) => (
            <ModuleCardSkeleton
              key={index}
              className={cn(
                index % 2 === 0 ? 'bg-secondary-50' : 'bg-primary-50'
              )}
            />
          ))}
        </div>
      ) : (
        // Show actual content
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3 min-[1600px]:grid-cols-4">
          {neuroSalesModules.map((module, index) => (
            <ModuleCard
              key={index}
              module={module}
              isEnabled={Boolean(modules[module.id])}
              onToggle={handleModuleToggle}
              isPending={updateIsPending}
              disabled={module.disabled || !module.pro}
              className={cn(index % 2 === 0 ? 'bg-[#EFF9FF]' : 'bg-primary-50')}
            />
          ))}
        </div>
      )}
    </div>
  );
}
