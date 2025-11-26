import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { BulkJob } from '@/types/bulkJob';
import { Separator } from '@/components/ui/separator';

interface BulkProcessingCardProps {
  activeBulkJob: BulkJob | null;
  onCancel: () => void;
  onDismiss: () => void;
}

export function BulkProcessingCard({
  activeBulkJob,
  onCancel,
  onDismiss,
}: BulkProcessingCardProps) {
  if (!activeBulkJob) return null;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'scheduled':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'processing':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'scheduled':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <Card className="border-blue-200 bg-blue-50/50">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div className="flex gap-2 items-center">
            {getStatusIcon(activeBulkJob.status)}
            <CardTitle className="text-lg">Bulk Processing Progress</CardTitle>
            <Badge className={getStatusColor(activeBulkJob.status)}>
              {activeBulkJob.status.charAt(0).toUpperCase() +
                activeBulkJob.status.slice(1)}
            </Badge>
          </div>
          <div className="flex gap-4 items-center">
            <div className="text-xs text-muted-foreground">
              Started:{' '}
              {format(
                new Date(activeBulkJob.created_at + 'Z'),
                'PPpp'
              )}
              {activeBulkJob.completed_at && (
                <span>
                  {' '}
                  • Completed:{' '}
                  {format(
                    new Date(activeBulkJob.completed_at + 'Z'),
                    'PPpp'
                  )}
                </span>
              )}
            </div>
            {(activeBulkJob.status === 'processing' ||
              activeBulkJob.status === 'scheduled') && (
              <Button
                variant="outline"
                size="sm"
                onClick={onCancel}
                className="text-red-600 hover:text-red-700"
              >
                Cancel
              </Button>
            )}
            {(activeBulkJob.status === 'completed' ||
              activeBulkJob.status === 'failed' ||
              activeBulkJob.status === 'partial' ||
              activeBulkJob.status === 'cancelled') && (
              <Button
                variant="outline"
                size="sm"
                onClick={onDismiss}
                className="text-gray-600 hover:text-gray-700"
              >
                Dismiss
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4 items-center divide-gray-200 lg:flex-row">
          <div className="space-y-2 w-full">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span>
                {activeBulkJob.processed_documents} /{' '}
                {activeBulkJob.total_documents} documents
                {(activeBulkJob.status === 'completed' ||
                  activeBulkJob.status === 'failed') && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    (Finished - will auto-dismiss in{' '}
                    {activeBulkJob.errors && activeBulkJob.errors.length > 0
                      ? '10s'
                      : '3s'}
                    )
                  </span>
                )}
              </span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${
                  activeBulkJob.status === 'processing'
                    ? 'bg-blue-600 animate-pulse'
                    : activeBulkJob.status === 'completed'
                    ? 'bg-green-600'
                    : 'bg-blue-600'
                }`}
                style={{ width: `${activeBulkJob.progress}%` }}
              />
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>
                {activeBulkJob.status === 'processing'
                  ? 'Processing...'
                  : activeBulkJob.status === 'completed'
                  ? 'Completed!'
                  : activeBulkJob.status === 'failed'
                  ? 'Failed'
                  : 'Scheduled'}
              </span>
              <span>{activeBulkJob.progress}% complete</span>
            </div>
          </div>

          <Separator orientation="vertical" className="!h-10" />

          <div className="grid grid-cols-3 gap-4 w-full text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {activeBulkJob.successful_documents}
              </div>
              <div className="text-muted-foreground">Successful</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {activeBulkJob.failed_documents}
              </div>
              <div className="text-muted-foreground">Failed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {parseInt(activeBulkJob.total_documents) -
                  parseInt(activeBulkJob.processed_documents)}
              </div>
              <div className="text-muted-foreground">Remaining</div>
            </div>
          </div>
        </div>

        {activeBulkJob.status === 'completed' && (
          <div className="flex gap-2 items-center p-3 bg-green-50 rounded-lg border border-green-200">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <div className="text-green-800">
              Bulk processing completed successfully!{' '}
              {activeBulkJob.successful_documents} documents were processed.
            </div>
          </div>
        )}

        {activeBulkJob.status === 'failed' && (
          <div className="flex gap-2 items-center p-3 bg-red-50 rounded-lg border border-red-200">
            <XCircle className="w-4 h-4 text-red-600" />
            <div className="text-red-800">
              {activeBulkJob.errors &&
              activeBulkJob.errors.some(
                (error) =>
                  error.error.includes('embedding credits limit') ||
                  error.error.includes('credits limit') ||
                  error.error.includes(
                    'Processing stopped due to embedding credits limit'
                  )
              ) ? (
                <div>
                  <div className="font-semibold">
                    Embedding Credits Limit Reached
                  </div>
                  <div className="mt-1 text-sm">
                    Processing stopped due to insufficient embedding credits.
                    Please try again later or contact support.
                  </div>
                </div>
              ) : (
                `Bulk processing failed. ${activeBulkJob.failed_documents} documents failed to process.`
              )}
            </div>
          </div>
        )}

        {activeBulkJob.errors && activeBulkJob.errors.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">
              Errors:
            </div>
            <div className="overflow-y-auto space-y-1 max-h-32">
              {activeBulkJob.errors.map((error, index) => {
                const isCreditsLimit =
                  error.error.includes('embedding credits limit') ||
                  error.error.includes('credits limit') ||
                  error.error.includes(
                    'Processing stopped due to embedding credits limit'
                  );

                return (
                  <div
                    key={index}
                    className={`p-2 text-xs rounded border ${
                      isCreditsLimit
                        ? 'bg-orange-50 border-orange-200'
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="font-medium">{error.document_title}</div>
                    <div
                      className={
                        isCreditsLimit ? 'text-orange-600' : 'text-red-600'
                      }
                    >
                      {isCreditsLimit
                        ? 'Credits limit reached - processing stopped'
                        : error.error}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
