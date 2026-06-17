import { Button } from '@/components/ui/button';
import { __ } from '@/lib/utils';
import { ClipboardList, Loader2 } from 'lucide-react';
import type { UseQueryResult } from '@tanstack/react-query';
import type { IntegrationFormsResponse } from '../types';

type IntegrationFormsSheetStatesProps = {
  query: UseQueryResult<IntegrationFormsResponse, Error>;
  notInstalledText: string;
  createFormUrl: string;
  primaryCtaText: string;
  emptySupportingText: string;
};

export default function IntegrationFormsSheetStates({
  query,
  notInstalledText,
  createFormUrl,
  primaryCtaText,
  emptySupportingText,
}: IntegrationFormsSheetStatesProps) {
  if (query.isLoading) {
    return (
      <div className="flex flex-1 min-h-[min(320px,55vh)] flex-col items-center justify-center gap-3 px-4">
        <Loader2 className="h-9 w-9 animate-spin text-primary" aria-hidden />
        <p className="text-sm text-muted-foreground">{__('Loading forms…')}</p>
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="flex flex-1 min-h-[min(240px,45vh)] flex-col items-center justify-center gap-2 px-4 text-center">
        <p className="text-sm text-destructive max-w-sm">
          {__(
            'Could not load forms. Try closing and reopening this panel.'
          )}
        </p>
      </div>
    );
  }

  const installed = query.data?.installed ?? false;
  if (!installed) {
    return (
      <div className="flex flex-1 min-h-[min(240px,45vh)] flex-col items-center justify-center gap-2 px-4 text-center">
        <p className="text-sm text-muted-foreground max-w-sm">
          {__(notInstalledText)}
        </p>
      </div>
    );
  }

  const forms = query.data?.forms ?? [];
  if (forms.length === 0) {
    return (
      <div className="flex flex-1 min-h-[min(320px,55vh)] flex-col items-center justify-center gap-5 px-6 text-center">
        <div className="rounded-full bg-muted/70 p-5 ring-1 ring-border/50" aria-hidden>
          <ClipboardList className="h-10 w-10 text-muted-foreground" strokeWidth={1.5} />
        </div>
        <div className="space-y-2 max-w-sm">
          <p className="!text-base !font-semibold text-foreground">{__('No forms yet')}</p>
          <p className="!text-sm !text-muted-foreground !leading-relaxed">
            {__(emptySupportingText)}
          </p>
        </div>
        <Button asChild>
          <a className="!text-white" href={createFormUrl}>
            {__(primaryCtaText)}
          </a>
        </Button>
      </div>
    );
  }

  return null;
}
