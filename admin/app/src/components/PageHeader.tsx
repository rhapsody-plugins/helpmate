import { Separator } from '@/components/ui/separator';
import { SidebarTrigger, useSidebarOptional } from '@/components/ui/sidebar';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { MenuItem } from '@/types';
import { ChevronRight } from 'lucide-react';
export default function PageHeader({
  menuItems,
  title,
  rightActions,
  disableTrigger = false,
}: {
  menuItems?: MenuItem[];
  title?: string;
  rightActions?: React.ReactNode;
  disableTrigger?: boolean;
}) {
  const sidebar = useSidebarOptional();
  const showSidebarChrome = !disableTrigger && sidebar != null;

  return (
    <header className="flex sticky top-0 z-10 gap-2 items-center p-2 bg-white border-b border-border/50 min-h-[62px]">
      {showSidebarChrome && (
        <>
          <SidebarTrigger className="my-1" />
          <Separator orientation="vertical" className="mr-2 !h-4" />
        </>
      )}
      {title && (
        <h1
          className={cn(
            '!text-sm !text-muted-foreground !m-0 !p-0',
            !showSidebarChrome && '!ml-[18px]'
          )}
        >
          {title}
        </h1>
      )}
      {menuItems && (
        <>
          <ChevronRight className="!w-4 !h-4 opacity-50" />
          <TabsList className="bg-transparent">
            {menuItems.map((item) => (
              <TabsTrigger
                key={item.title}
                value={item.title}
                disabled={!item.status}
                className={`bg-transparent !font-semibold !shadow-none border-b-2 border-b-border rounded-none data-[state=active]:text-primary data-[state=active]:border-b-primary ${
                  item.status
                    ? 'text-muted-foreground'
                    : 'text-muted-foreground/50 cursor-not-allowed opacity-50'
                }`}
              >
                {item.title}
              </TabsTrigger>
            ))}
          </TabsList>
        </>
      )}
      {rightActions && <div className="ml-auto">{rightActions}</div>}
    </header>
  );
}
