import Loading from '@/components/Loading';
import { Button } from '@/components/ui/button';
import { useApi } from '@/hooks/useApi';
import { DataSourceContent } from '@/pages/data-source/DataSourceContent';

export default function DataSource() {
  const { apiKeyQuery } = useApi();
  const { data: api, isLoading: isApiLoading } = apiKeyQuery;

  if (isApiLoading) {
    return <Loading />;
  }

  if (api && !api.api_key) {
    return (
      <div className="p-6">
        Please activate your API key to continue.{' '}
        <Button
          variant="link"
          className="p-0"
          onClick={() =>
            (window.location.href = '/wp-admin/admin.php?page=helpmate')
          }
        >
          Activate API Key
        </Button>
      </div>
    );
  }

  return <DataSourceContent />;
}
