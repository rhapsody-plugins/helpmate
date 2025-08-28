import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  Sidebar,
  SidebarFooter,
  SidebarMenu,
  SidebarProvider,
} from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { RefreshCw } from 'lucide-react';
import { ReactNode } from 'react';

interface ActivityLayoutProps {
  title: string;
  description: string;
  isRefreshing: boolean;
  onRefresh: () => void;
  sidebarContent: ReactNode;
  mainContent: ReactNode;
  pagination?: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
  };
  isLoading?: boolean;
}

export function ActivityLayout({
  title,
  description,
  isRefreshing,
  onRefresh,
  sidebarContent,
  mainContent,
  pagination,
  isLoading = false,
}: ActivityLayoutProps) {
  const renderPaginationItems = () => {
    if (!pagination) return null;
    const { currentPage, totalPages, onPageChange } = pagination;
    const items = [];

    // Always show first page
    items.push(
      <PaginationItem key="first">
        <PaginationLink
          href="#"
          onClick={(e) => {
            e.preventDefault();
            onPageChange(1);
          }}
          isActive={currentPage === 1}
          className="w-7"
        >
          1
        </PaginationLink>
      </PaginationItem>
    );

    // Show ellipsis if there are pages before the current page
    if (currentPage > 2) {
      items.push(
        <PaginationItem key="ellipsis-1">
          <PaginationEllipsis />
        </PaginationItem>
      );
    }

    // Show current page and one before and after
    for (
      let i = Math.max(2, currentPage - 1);
      i <= Math.min(totalPages - 1, currentPage + 1);
      i++
    ) {
      items.push(
        <PaginationItem key={i}>
          <PaginationLink
            href="#"
            onClick={(e) => {
              e.preventDefault();
              onPageChange(i);
            }}
            isActive={currentPage === i}
            className="w-7"
          >
            {i}
          </PaginationLink>
        </PaginationItem>
      );
    }

    // Show ellipsis if there are pages after the current page
    if (currentPage < totalPages - 1) {
      items.push(
        <PaginationItem key="ellipsis-2">
          <PaginationEllipsis />
        </PaginationItem>
      );
    }

    // Always show last page if there is more than one page
    if (totalPages > 1) {
      items.push(
        <PaginationItem key="last">
          <PaginationLink
            href="#"
            onClick={(e) => {
              e.preventDefault();
              onPageChange(totalPages);
            }}
            isActive={currentPage === totalPages}
            className="w-7"
          >
            {totalPages}
          </PaginationLink>
        </PaginationItem>
      );
    }

    return items;
  };

  const renderSidebarSkeleton = () => (
    <>
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="p-3 border-b">
          <div className="space-y-2">
            <Skeleton className="w-32 h-4" />
            <div className="flex gap-2">
              <Skeleton className="w-16 h-3" />
              <Skeleton className="w-16 h-3" />
            </div>
          </div>
        </div>
      ))}
    </>
  );

  const renderMainContentSkeleton = () => (
    <div className="overflow-y-auto flex-1 p-4 h-full">
      <div className="flex flex-col-reverse gap-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="space-y-3">
            <div className="flex gap-3 items-start">
              <Skeleton className="w-8 h-8 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="w-24 h-4" />
                <Skeleton className="w-full h-16" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <Card className="pb-0">
      <CardHeader className="flex flex-row justify-between items-center">
        <div>
          <CardTitle className="flex gap-1 items-center text-xl font-bold">
            {title} <InfoTooltip message={description} />
          </CardTitle>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onRefresh}
                disabled={isRefreshing || isLoading}
              >
                <RefreshCw
                  className={cn('h-4 w-4', (isRefreshing || isLoading) && 'animate-spin')}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              Refresh the activity list
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </CardHeader>
      <CardContent className="p-0">
        <SidebarProvider className="rounded-xl border-r-0 border-b-0 border-l-0 !min-h-0">
          <div className="flex gap-4 h-[600px] w-full bg-white">
            <Sidebar className="min-w-[260px] max-w-xs border-r flex flex-col">
              <SidebarMenu className="overflow-y-auto flex-1 gap-0">
                {isLoading ? renderSidebarSkeleton() : sidebarContent}
              </SidebarMenu>
              {pagination && !isLoading && (
                <SidebarFooter className="pt-4 border-t">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            if (pagination.currentPage > 1) {
                              pagination.onPageChange(
                                pagination.currentPage - 1
                              );
                            }
                          }}
                          className={cn(
                            pagination.currentPage === 1 &&
                              'pointer-events-none opacity-50',
                            '!px-1'
                          )}
                        />
                      </PaginationItem>
                      {renderPaginationItems()}
                      <PaginationItem>
                        <PaginationNext
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            if (
                              pagination.currentPage < pagination.totalPages
                            ) {
                              pagination.onPageChange(
                                pagination.currentPage + 1
                              );
                            }
                          }}
                          className={cn(
                            pagination.currentPage === pagination.totalPages &&
                              'pointer-events-none opacity-50',
                            '!px-1'
                          )}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </SidebarFooter>
              )}
            </Sidebar>
            {isLoading ? renderMainContentSkeleton() : mainContent}
          </div>
        </SidebarProvider>
      </CardContent>
    </Card>
  );
}
