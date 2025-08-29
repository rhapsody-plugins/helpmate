import { ConsentProvider } from '@/contexts/ConsentContext';
import { DataSourceContent } from '@/pages/data-source/DataSourceContent';

export default function DataSource() {
  return (
    <ConsentProvider>
      <DataSourceContent />
    </ConsentProvider>
  );
}
