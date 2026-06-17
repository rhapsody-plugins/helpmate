import PageGuard from '@/components/PageGuard';
import PageHeader from '@/components/PageHeader';
import { __ } from '@/lib/utils';
import { Suspense, lazy } from 'react';

// Lazy load tab components
const TabTemplates = lazy(() => import('./Emails/tabs/TabTemplates'));

export default function Emails() {
  return (
    <PageGuard page="crm-emails">
      <div className="relative">
        <PageHeader title={__('Email Templates')} />
        <Suspense fallback={<div className="p-6">{__('Loading...')}</div>}>
          <TabTemplates />
        </Suspense>
      </div>
    </PageGuard>
  );
}
