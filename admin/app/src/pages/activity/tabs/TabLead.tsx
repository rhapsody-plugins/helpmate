import {
  Card,
  CardTitle,
  CardHeader,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import useActivity from '@/hooks/useActivity';
import { Lead } from '@/types';
import { useEffect, useState } from 'react';
import { ActivityLayout } from '@/components/layout/ActivityLayout';
import { SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

export default function TabLead() {
  const { getLeads } = useActivity();
  const [page, setPage] = useState(1);
  const [perPage] = useState(10);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const { data: leads, isPending: leadsLoading } = getLeads;

  const isLoading = Boolean(leadsLoading);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await getLeads.mutateAsync({ page, per_page: perPage });
    setIsRefreshing(false);
  };

  useEffect(() => {
    getLeads.mutate(
      { page, per_page: perPage },
      {
        onSuccess: (data) => {
          setSelectedLead(data.leads[0]);
        },
      }
    );
  }, [page, perPage]);

  const sidebarContent = (leads?.leads ?? []).map((lead, index) => (
    <SidebarMenuItem key={index} className="pb-2">
      <SidebarMenuButton
        onClick={() => setSelectedLead(lead)}
        isActive={selectedLead?.id === lead.id}
        className={cn('p-3 h-auto rounded-none')}
      >
        <div className={cn('flex flex-col items-start')}>
          <span className="font-medium text-sm truncate max-w-[180px]">
            {lead.name}
          </span>
          <div className="flex gap-2 items-center">
            <span className="text-xs">
              {lead.timestamp}
            </span>
          </div>
        </div>
      </SidebarMenuButton>
    </SidebarMenuItem>
  ));

  const mainContent = (
    <div className="overflow-y-auto flex-1 p-4 -ml-3 h-full">
      {selectedLead ? (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{selectedLead.name}</CardTitle>
              <CardDescription>
                Created on {selectedLead.timestamp}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(selectedLead.metadata).map(
                  ([key, value]) =>
                    !!value && (
                      <div key={key} className="grid grid-cols-2 gap-4">
                        <div className="font-medium capitalize">{key}</div>
                        <div>{String(value)}</div>
                      </div>
                    )
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="py-12 text-center text-muted-foreground">
          No leads available.
        </div>
      )}
    </div>
  );

  return (
    <ActivityLayout
      title="Leads"
      description="View and manage customer leads."
      isRefreshing={isRefreshing}
      onRefresh={handleRefresh}
      sidebarContent={sidebarContent}
      mainContent={mainContent}
      isLoading={isLoading}
      pagination={
        leads?.pagination
          ? {
              currentPage: leads.pagination.current_page,
              totalPages: leads.pagination.total_pages,
              onPageChange: setPage,
            }
          : undefined
      }
    />
  );
}
