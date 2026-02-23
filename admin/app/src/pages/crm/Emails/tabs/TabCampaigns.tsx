import CampaignForm from '@/components/crm/CampaignForm';
import { FailedEmailsSheet } from '@/components/crm/FailedEmailsSheet';
import { ReusableTable } from '@/components/ReusableTable';
import { ProBadge } from '@/components/ProBadge';
import { useSettings } from '@/hooks/useSettings';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { useCrm } from '@/hooks/useCrm';
import { Campaign } from '@/types/crm';
import { ColumnDef } from '@tanstack/react-table';
import { formatDistanceToNow } from 'date-fns';
import { parseUTCDate, defaultLocale } from '@/pages/crm/contacts/utils';
import { Pencil, Send, Trash } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type TabCampaignsProps = {
  formOpen: boolean;
  onFormOpenChange: (open: boolean) => void;
};

export default function TabCampaigns({
  formOpen,
  onFormOpenChange,
}: TabCampaignsProps) {
  const { getProQuery } = useSettings();
  const isPro = getProQuery.data ?? false;
  const {
    useCampaigns,
    useCampaignFailedEmails,
    deleteCampaignMutation,
    sendCampaignMutation,
  } = useCrm();

  const { data: campaignsData, isLoading } = useCampaigns();
  const campaigns = campaignsData?.campaigns || [];
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [formDefaultType, setFormDefaultType] = useState<
    'one_time' | 'recurring'
  >('one_time');
  const [failuresCampaignId, setFailuresCampaignId] = useState<number | null>(
    null
  );

  const { data: failedEmails, isLoading: failedEmailsLoading } =
    useCampaignFailedEmails(failuresCampaignId, failuresCampaignId !== null);

  useEffect(() => {
    if (formOpen && editingCampaign === null) {
      setFormDefaultType('one_time');
    }
  }, [formOpen, editingCampaign]);

  // Split campaigns by type
  const oneTimeCampaigns = useMemo(() => {
    return campaigns.filter((c) => !c.type || c.type === 'one_time');
  }, [campaigns]);

  const recurringCampaigns = useMemo(() => {
    return campaigns.filter((c) => c.type === 'recurring');
  }, [campaigns]);

  // Columns for one-time campaigns
  const oneTimeColumns: ColumnDef<Campaign>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <span className="capitalize">{row.original.status}</span>
      ),
    },
    {
      accessorKey: 'sent_count',
      header: 'Sent',
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span>
            {row.original.sent_count} / {row.original.total_contacts}
          </span>
          {row.original.failed_count > 0 && (
            <span className="text-xs text-destructive">
              {row.original.failed_count} failed
            </span>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'created_at',
      header: 'Created',
      cell: ({ row }) =>
        formatDistanceToNow(parseUTCDate(row.original.created_at), {
          addSuffix: true,
          locale: defaultLocale,
        }),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex gap-2 justify-end items-center">
          {row.original.status === 'draft' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => sendCampaignMutation.mutate(row.original.id)}
              disabled={sendCampaignMutation.isPending || !isPro}
            >
              <Send className="mr-2 w-4 h-4" />
              Send
            </Button>
          )}
          {row.original.failed_count > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFailuresCampaignId(row.original.id)}
            >
              View failures
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditingCampaign(row.original);
              setFormDefaultType('one_time');
              onFormOpenChange(true);
            }}
            disabled={!isPro}
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (confirm('Are you sure you want to delete this campaign?')) {
                deleteCampaignMutation.mutate(row.original.id);
              }
            }}
            disabled={!isPro}
          >
            <Trash className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  // Columns for recurring campaigns
  const recurringColumns: ColumnDef<Campaign>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
    },
    {
      accessorKey: 'interval_value',
      header: 'Interval',
      cell: ({ row }) => (
        <span>
          Every {row.original.interval_value} {row.original.interval_unit}
        </span>
      ),
    },
    {
      accessorKey: 'is_active',
      header: 'Status',
      cell: ({ row }) => (
        <span>{row.original.is_active ? 'Active' : 'Inactive'}</span>
      ),
    },
    {
      accessorKey: 'next_run_at',
      header: 'Next Run',
      cell: ({ row }) =>
        row.original.next_run_at
          ? formatDistanceToNow(parseUTCDate(row.original.next_run_at), {
              addSuffix: true,
              locale: defaultLocale,
            })
          : 'N/A',
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex gap-2 justify-end items-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditingCampaign(row.original);
              setFormDefaultType('recurring');
              onFormOpenChange(true);
            }}
            disabled={!isPro}
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (
                confirm(
                  'Are you sure you want to delete this recurring campaign?'
                )
              ) {
                deleteCampaignMutation.mutate(row.original.id);
              }
            }}
            disabled={!isPro}
          >
            <Trash className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="relative p-6 space-y-6">
        {!isPro && (
          <ProBadge
            topMessage="Create and manage email campaigns. Automate sends using sequences."
            buttonText="Unlock Campaigns"
            tooltipMessage={null}
          />
        )}

        {/* One-Time Campaigns Card */}
        <Card
          className={cn(
            !isPro && 'opacity-50 cursor-not-allowed pointer-events-none'
          )}
        >
          <CardHeader>
            <CardTitle className="flex gap-1 items-center text-xl font-bold">
              One-Time Campaigns{' '}
              <InfoTooltip message="Send emails to your segments immediately or schedule them for later." />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-96" />
            ) : oneTimeCampaigns.length > 0 ? (
              <ReusableTable
                data={oneTimeCampaigns}
                columns={oneTimeColumns}
                rightAlignedColumns={['actions']}
              />
            ) : (
              <div className="py-12 text-center">
                <p className="text-muted-foreground">
                  No one-time campaigns yet.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recurring Campaigns Card */}
        <Card
          className={cn(
            !isPro && 'opacity-50 cursor-not-allowed pointer-events-none'
          )}
        >
          <CardHeader>
            <CardTitle className="flex gap-1 items-center text-xl font-bold">
              Recurring Campaigns{' '}
              <InfoTooltip message="Set up campaigns that automatically send emails at regular intervals." />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-96" />
            ) : recurringCampaigns.length > 0 ? (
              <ReusableTable
                data={recurringCampaigns}
                columns={recurringColumns}
                rightAlignedColumns={['actions']}
              />
            ) : (
              <div className="py-12 text-center">
                <p className="text-muted-foreground">
                  No recurring campaigns yet.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <FailedEmailsSheet
        open={failuresCampaignId !== null}
        onOpenChange={(open) => !open && setFailuresCampaignId(null)}
        title="Failed emails"
        failures={failedEmails}
        isLoading={failedEmailsLoading}
        failedCount={
          campaigns.find((c) => c.id === failuresCampaignId)?.failed_count ?? 0
        }
      />

      <Sheet
        open={formOpen}
        onOpenChange={(open) => {
          onFormOpenChange(open);
          if (!open) setEditingCampaign(null);
        }}
      >
        <SheetContent className="sm:!max-w-2xl">
          <SheetHeader>
            <SheetTitle>
              {editingCampaign ? 'Edit Campaign' : 'Create Campaign'}
            </SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto flex-1 p-4 pt-6">
            <CampaignForm
              key={editingCampaign?.id || 'new'}
              campaign={editingCampaign}
              defaultType={formDefaultType}
              onClose={() => {
                onFormOpenChange(false);
                setEditingCampaign(null);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
