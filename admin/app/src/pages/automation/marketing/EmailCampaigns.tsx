import PageGuard from '@/components/PageGuard';
import PageHeader from '@/components/PageHeader';
import TabCampaigns from '@/pages/crm/Emails/tabs/TabCampaigns';
import { Button } from '@/components/ui/button';
import { useSettings } from '@/hooks/useSettings';
import { Plus } from 'lucide-react';
import { useState } from 'react';

export default function EmailCampaigns() {
  const { getProQuery } = useSettings();
  const isPro = getProQuery.data ?? false;
  const [formOpen, setFormOpen] = useState(false);

  return (
    <PageGuard page="automation-marketing-email-campaigns">
      <div className="gap-0">
        <PageHeader
          title="Email Campaigns"
          rightActions={
            <Button
              size="sm"
              disabled={!isPro}
              onClick={() => setFormOpen(true)}
            >
              <Plus className="mr-2 w-4 h-4" />
              Create Campaign
            </Button>
          }
        />
        <TabCampaigns formOpen={formOpen} onFormOpenChange={setFormOpen} />
      </div>
    </PageGuard>
  );
}
