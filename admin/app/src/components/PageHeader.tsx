import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MenuItem } from '@/types';
import { ChevronRight } from 'lucide-react';
export default function PageHeader({
  menuItems,
  title,
  rightActions,
}: {
  menuItems?: MenuItem[];
  title?: string;
  rightActions?: React.ReactNode;
}) {
  return (
    <header className="flex gap-2 items-center p-2 border-b border-border/50">
      <SidebarTrigger className="my-1" />
      <Separator orientation="vertical" className="mr-2 !h-4" />
      {title && <h1 className="!text-sm !text-muted-foreground !m-0 !p-0">{title}</h1>}
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
