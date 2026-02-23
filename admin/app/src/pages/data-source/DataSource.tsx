import PageGuard from '@/components/PageGuard';
import { DataSourceContent } from '@/pages/data-source/DataSourceContent';

export default function DataSource() {
  return (
    <PageGuard page="data-source">
      <DataSourceContent />
    </PageGuard>
  );
}
