import aiChatbot from '@/assets/apps/ai-chatbot.svg';
import aiChatbotIcon from '@/assets/apps/ai.svg';
import imageSearch from '@/assets/apps/image-search.svg';
import orderTracker from '@/assets/apps/order-tracker.svg';
import ticketSystemIcon from '@/assets/apps/ticket-system-icon.svg';
import ticketSystem from '@/assets/apps/ticket-system.svg';
import truckLocationIcon from '@/assets/apps/truck-location.svg';
import { ProBadge } from '@/components/ProBadge';
import { Card } from '@/components/ui/card';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useMain } from '@/contexts/MainContext';
import { useCustomIcons } from '@/hooks/useCustomIcons';
import { useSettings } from '@/hooks/useSettings';
import { cn } from '@/lib/utils';
import { ScanSearch } from 'lucide-react';
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

export default function TabNeuroServe() {
  const { modules } = useMain();
  const { updateSettingsMutation, getModulesQuery, getProQuery } =
    useSettings();
  const isPro = getProQuery.data ?? false;
  const { mutateAsync: updateSettings, isPending: updateIsPending } =
    updateSettingsMutation;
  const icons = useCustomIcons(['woocommerce']);

  // Check if any queries are loading
  const isLoading = getModulesQuery.isLoading || getProQuery.isLoading;

  const neuroServeModules = useMemo(
    () => [
      {
        id: 'chatbot',
        title: 'Chatbot',
        tooltipMessage:
          'The chatbot can guide users, suggest products, and even handle support tasks, making your store more efficient. It enhances user experience while saving you time and resources.',
        proTooltipMessage:
          'Every "How do I...?" can become a sale. Our chatbot answers, guides, and sales',
        icon: <ChangeSvgColor src={aiChatbotIcon} className="w-6 h-6" />,
        pro: true,
        image: aiChatbot,
        disabled: false,
        buttonText: 'Activate 24/7 Support Now',
      },
      {
        id: 'order-tracker',
        title: 'Order Tracker',
        tooltipMessage:
          'Customers can track their orders in real-time using email, phone number, or order ID, right from the chat window. It reduces customer anxiety and the feature enhances transparency, which helps build trust and loyalty.',
        proTooltipMessage:
          'Give them answers before they ask. Real-time order tracking reduces refunds and raises trust',
        icon: (
          <img
            src={truckLocationIcon}
            className="w-6 h-6"
            alt="order-tracker"
          />
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
        image: orderTracker,
        disabled: false,
        buttonText: 'Make Shipping Transparent',
      },
      {
        id: 'ticket-system',
        title: 'Ticket System',
        tooltipMessage:
          "The ticket system allows customers to raise support requests directly from the chat window. It's ideal for handling complex issues that need manual attention beyond chatbot automation.",
        proTooltipMessage:
          'Every ticket is an opportunity to earn trust. Respond faster, smarter, and in one place',
        icon: (
          <img src={ticketSystemIcon} className="w-6 h-6" alt="ticket-system" />
        ),
        pro: true,
        dependencies: [
          <ChangeSvgColor
            src={aiChatbotIcon}
            className="w-6 h-6"
            stroke="#94A3B8"
          />,
        ],
        image: ticketSystem,
        disabled: false,
        buttonText: 'Simplify Your Service Desk',
      },
      {
        id: 'image-search',
        title: 'Image Search',
        tooltipMessage:
          "Customers can upload an image to search for similar or exact products from your store. It's perfect for mobile-first shoppers who use screenshots or photos to find products.",
        proTooltipMessage:
          '"I saw it, I want it." Let customers upload a photo and find the exact product instantly',
        icon: <ScanSearch strokeWidth={1} className="w-6 h-6" />,
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
        image: imageSearch,
        disabled: false,
        buttonText: 'Turn Photos into Purchases',
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
        NeuroServe
        <sup className="flex justify-center items-center w-3.5 h-3.5 text-[8px] p-0.5 rounded-full border border-black -mt-1">
          RP
        </sup>{' '}
        Apps
        <InfoTooltip message="NeuroServe is a collection of tools that help you serve your customers better. It includes features like chatbot, order tracker, ticket system, image search, and more." />
      </h2>
      {isLoading ? (
        // Show skeleton loading state
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3 min-[1600px]:grid-cols-4">
          {Array.from({ length: neuroServeModules.length }).map((_, index) => (
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
          {neuroServeModules.map((module, index) => (
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
