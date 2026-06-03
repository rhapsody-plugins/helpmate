import { useDataSource } from '@/hooks/useDataSource';
import api from '@/lib/axios';
import { useCallback, useState } from 'react';
import { AxiosError } from 'axios';

export function useSetupQuickTrain() {
  const { getSourcesMutation, addSourceMutation, updateSourceMutation } =
    useDataSource();
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const { mutateAsync: fetchSources } = getSourcesMutation;
  const { mutateAsync: addSource } = addSourceMutation;
  const { mutateAsync: updateSource } = updateSourceMutation;

  const runQuickTrain = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setProgress(0);
    setError(null);

    const contentProgressInterval = setInterval(() => {
      setProgress((prev) => (prev >= 45 ? prev : prev + Math.random() * 8));
    }, 150);

    let homepage: { title: string; content: string } | undefined;

    try {
      setProgress(10);
      const response = await api.post('/quick-train-homepage');
      if (response.data.error) {
        throw new Error(response.data.message);
      }
      homepage = response.data;
    } catch (err) {
      const errorMessage =
        (err as AxiosError<{ message: string }>).response?.data?.message ??
        (err instanceof Error ? err.message : 'Failed to fetch URL content');
      setError(errorMessage);
      clearInterval(contentProgressInterval);
      setIsLoading(false);
      setProgress(0);
      return false;
    } finally {
      clearInterval(contentProgressInterval);
      setProgress(50);
    }

    if (!homepage?.title || !homepage?.content) {
      setError('Failed to fetch homepage content. Try again.');
      setIsLoading(false);
      setProgress(0);
      return false;
    }

    const saveProgressInterval = setInterval(() => {
      setProgress((prev) => (prev >= 95 ? prev : prev + Math.random() * 8));
    }, 150);

    try {
      setProgress(55);
      const existing = await fetchSources('general');
      if (existing?.[0]?.id) {
        await updateSource({
          id: existing[0].id,
          document_type: 'general',
          title: homepage.title,
          content: homepage.content,
          vector: existing[0].vector,
          metadata: {},
          last_updated: Math.floor(Date.now() / 1000),
        });
      } else {
        await addSource({
          document_type: 'general',
          title: homepage.title,
          content: homepage.content,
          metadata: {},
        });
      }
      clearInterval(saveProgressInterval);
      setProgress(100);
      await new Promise((resolve) => setTimeout(resolve, 500));
      setIsLoading(false);
      setProgress(0);
      return true;
    } catch (err) {
      clearInterval(saveProgressInterval);
      setError(
        err instanceof Error ? err.message : 'Failed to save content. Try again.'
      );
      setIsLoading(false);
      setProgress(0);
      return false;
    }
  }, [addSource, fetchSources, updateSource]);

  return { runQuickTrain, isLoading, progress, error, setError };
}

export function isPromoteTargetNotEmpty(data: unknown): boolean {
  if (!data || typeof data !== 'object') {
    return false;
  }
  const record = data as Record<string, unknown>;
  if (record.code === 'target_not_empty') {
    return true;
  }
  const detail = record.detail;
  if (detail && typeof detail === 'object') {
    return (detail as { code?: string }).code === 'target_not_empty';
  }
  return false;
}
