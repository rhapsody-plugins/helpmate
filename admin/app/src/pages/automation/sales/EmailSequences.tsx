import PageGuard from '@/components/PageGuard';
import PageHeader from '@/components/PageHeader';
import TabSequences from '@/pages/crm/Emails/tabs/TabSequences';

export default function EmailSequences() {
  return (
    <PageGuard page="automation-sales-email-sequences">
      <div className="gap-0">
        <PageHeader title="Email Sequences" />
        <TabSequences />
      </div>
    </PageGuard>
  );
}
