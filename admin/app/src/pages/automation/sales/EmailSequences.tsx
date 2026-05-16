import PageGuard from '@/components/PageGuard';
import PageHeader from '@/components/PageHeader';
import TabSequences from '@/pages/crm/Emails/tabs/TabSequences';
import { __ } from '@/lib/utils';

export default function EmailSequences() {
  return (
    <PageGuard page="automation-sales-email-sequences">
      <div className="gap-0">
        <PageHeader title={__('Email Sequences')} />
        <TabSequences />
      </div>
    </PageGuard>
  );
}
