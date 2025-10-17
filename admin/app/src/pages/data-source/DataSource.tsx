import Loading from '@/components/Loading';
import { useApi } from '@/hooks/useApi';
import ActivateApi from '@/pages/ActivateApi';
import { DataSourceContent } from '@/pages/data-source/DataSourceContent';

export default function DataSource() {
  const { apiKeyQuery } = useApi();
  const { data: api, isLoading: isApiLoading } = apiKeyQuery;

  if (isApiLoading) {
    return <Loading />;
  }

  if (!api?.api_key) {
    return <ActivateApi />;
  }

  return <DataSourceContent />;
}
