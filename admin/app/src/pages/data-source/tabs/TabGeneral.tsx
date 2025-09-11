import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useConsent } from '@/contexts/ConsentContext';
import { useDataSource } from '@/hooks/useDataSource';
import api from '@/lib/axios';
import { zodResolver } from '@hookform/resolvers/zod';
import { AxiosError } from 'axios';
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

const formSchema = z.object({
  title: z.string(),
  content: z.string().min(1, 'Content is required'),
});

type FormData = z.infer<typeof formSchema>;

export default function TabGeneral({ setHasGeneralContent }: { setHasGeneralContent: (hasGeneralContent: boolean) => void }) {
  const { requestConsent, checkConsentAndExecute } = useConsent();
  const { getSourcesMutation, addSourceMutation, updateSourceMutation } =
    useDataSource();
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);

  const {
    data: fetchData,
    isPending: isFetching,
    mutate: fetchMutate,
  } = getSourcesMutation;

  const { isPending: addIsPending, mutate: addMutate } = addSourceMutation;

  const { isPending: updateIsPending, mutate: updateMutate } =
    updateSourceMutation;

  const form = useForm<FormData>({
    defaultValues: {
      title: 'General context of the website',
      content: '',
    },
    resolver: zodResolver(formSchema),
  });

  /*
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │   Handlers                                                                  │
  └─────────────────────────────────────────────────────────────────────────────┘
 */

  // Initial data fetch
  useEffect(() => {
    fetchMutate('general', {
      onSuccess: (data) => {
        if (data.length > 0) {
          form.reset({
            title: data[0].title,
            content: data[0].content,
          });
        }
      },
    });
  }, [fetchMutate, form]);

  const handleSubmit = useCallback(
    (data: FormData) => {
      if (fetchData?.[0]?.id) {
        updateMutate(
          {
            id: fetchData[0].id,
            document_type: 'general',
            title: data.title,
            content: data.content,
            vector: fetchData[0].vector,
            metadata: {},
            last_updated: Math.floor(Date.now() / 1000),
          },
          {
            onSuccess: () => {
              form.reset({
                title: data.title,
                content: data.content,
              });
            },
            onError: (error) => {
              // If consent is required, request it through the context
              if (error.message === 'CONSENT_REQUIRED') {
                requestConsent(() => handleSubmit(data));
              }
            },
          }
        );
      } else {
        addMutate(
          {
            document_type: 'general',
            title: data.title,
            content: data.content,
            metadata: {},
          },
          {
            onSuccess: () => {
              form.reset({
                title: data.title,
                content: data.content,
              });
              setHasGeneralContent(true);
            },
            onError: (error) => {
              // If consent is required, request it through the context
              if (error.message === 'CONSENT_REQUIRED') {
                requestConsent(() => handleSubmit(data));
              }
            },
          }
        );
      }
    },
    [addMutate, fetchData, updateMutate, form]
  );

  const quickTrainInternal = useCallback(async () => {
    setIsLoading(true);
    setProgress(0);
    let data: { title: string; content: string } | undefined;

    // Phase 1: Getting content (0% to 50%)
    setProgress(10);
    const contentProgressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 45) return prev; // Stop at 45% until content API call completes
        return prev + Math.random() * 8; // Random increment between 0-8%
      });
    }, 150);

    try {
      const response = await api.post('/quick-train-homepage');

      if (response.data.error) {
        toast.error(response.data.message);
        return;
      }
      data = response.data;
    } catch (error) {
      console.error('Error fetching URL:', error);
      toast.error(
        (error as AxiosError<{ message: string }>).response?.data?.message ??
          'Failed to fetch URL content'
      );
      clearInterval(contentProgressInterval);
      setIsLoading(false);
      setProgress(0);
      return;
    } finally {
      clearInterval(contentProgressInterval);
      setProgress(50); // Complete first phase
    }

    // Phase 2: Saving content (50% to 100%)
    setProgress(55);
    const saveProgressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) return prev; // Stop at 95% until save API call completes
        return prev + Math.random() * 8; // Random increment between 0-8%
      });
    }, 150);

    if (!data?.title || !data?.content) {
      toast.error('Failed to fetch homepage content. Try Again.');
      clearInterval(saveProgressInterval);
      setIsLoading(false);
      setProgress(0);
      return;
    }

    if (fetchData?.[0]?.id) {
      updateMutate(
        {
          id: fetchData[0].id,
          document_type: 'general',
          title: data.title,
          content: data.content,
          vector: fetchData[0].vector,
          metadata: {},
          last_updated: Math.floor(Date.now() / 1000),
        },
        {
          onSuccess: () => {
            clearInterval(saveProgressInterval);
            setProgress(100);
            form.reset({
              title: data.title,
              content: data.content,
            });
            setIsEditSheetOpen(false);
            // Small delay to show 100% completion
            setTimeout(() => {
              setIsLoading(false);
              setProgress(0);
            }, 500);
          },
          onError: (error) => {
            clearInterval(saveProgressInterval);
            setIsLoading(false);
            setProgress(0);
            // If consent is required, request it through the context
            if (error.message === 'CONSENT_REQUIRED') {
              requestConsent(() => handleSubmit(data));
            }
          },
        }
      );
    } else {
      addMutate(
        {
          document_type: 'general',
          title: data.title,
          content: data.content,
          metadata: {},
        },
        {
          onSuccess: () => {
            clearInterval(saveProgressInterval);
            setHasGeneralContent(true);
            setProgress(100);
            form.reset({
              title: data.title,
              content: data.content,
            });
            setIsEditSheetOpen(false);
            // Small delay to show 100% completion
            setTimeout(() => {
              setIsLoading(false);
              setProgress(0);
            }, 500);
          },
          onError: (error) => {
            clearInterval(saveProgressInterval);
            setIsLoading(false);
            setProgress(0);
            // If consent is required, request it through the context
            if (error.message === 'CONSENT_REQUIRED') {
              requestConsent(() => handleSubmit(data));
            }
          },
        }
      );
    }
  }, [
    addMutate,
    fetchData,
    updateMutate,
    form,
    requestConsent,
    setIsEditSheetOpen,
  ]);

  const quickTrain = useCallback(() => {
    checkConsentAndExecute(() => quickTrainInternal());
  }, [checkConsentAndExecute, quickTrainInternal]);

  /*
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │   Renders                                                                   │
  └─────────────────────────────────────────────────────────────────────────────┘
 */

  // Check if there's any trained data
  const hasTrainedData =
    fetchData && fetchData.length > 0 && fetchData[0].content;

  return (
    <div className="flex flex-col gap-4">
      {isFetching ? (
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-0 shadow-lg">
          <CardContent className="flex flex-col justify-center items-center p-8">
            <Card className="py-12 w-full text-center rounded-xl border border-primary-200">
              <CardContent>
                {/* Action Button Skeleton */}
                <div className="flex flex-col gap-4 items-center mx-auto">
                  <Skeleton className="w-full h-12 rounded-xl" />
                  <Skeleton className="h-3 w-76" />
                  <Skeleton className="w-80 h-3" />
                </div>
              </CardContent>
            </Card>

            {/* Feature Cards Skeleton */}
            <div className="grid px-6 w-full max-w-4xl md:grid-cols-2">
              <div className="p-6">
                <Skeleton className="mb-3 w-40 h-6" />
                <div className="space-y-2">
                  <Skeleton className="w-full h-4" />
                  <Skeleton className="w-full h-4" />
                  <Skeleton className="w-3/4 h-4" />
                </div>
              </div>

              <div className="p-6">
                <Skeleton className="mb-3 w-36 h-6" />
                <div className="space-y-2">
                  <Skeleton className="w-full h-4" />
                  <Skeleton className="w-full h-4" />
                  <Skeleton className="w-2/3 h-4" />
                </div>
              </div>
            </div>

            <Separator />

            <Skeleton className="mt-6 w-80 h-4" />
            <Skeleton className="mt-4 h-4 w-76" />
          </CardContent>
        </Card>
      ) : (
        // Show centered content when no data is trained
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-0 shadow-lg">
          <CardContent className="flex flex-col justify-center items-center p-8">
            <Card className="py-12 w-full text-center rounded-xl border border-primary-200">
              <CardContent>
                {/* Action Button */}
                <div className="flex flex-col gap-4 items-center mx-auto">
                  {!hasTrainedData ? (
                    <div className="w-full">
                      <Button
                        disabled={isLoading}
                        onClick={quickTrain}
                        size="lg"
                        className="!p-6 !text-lg font-semibold text-white bg-gradient-to-r from-blue-500 to-indigo-600 shadow-lg transition-all duration-200 transform hover:from-blue-600 hover:to-indigo-700 hover:shadow-xl hover:scale-105 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
                      >
                        {isLoading ? (
                          <>
                            <svg
                              className="mr-2 w-6 h-6 animate-spin"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              ></circle>
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              ></path>
                            </svg>
                            Auto Training...
                          </>
                        ) : (
                          <>
                            <svg
                              className="mr-2 !w-5 !h-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M13 10V3L4 14h7v7l9-11h-7z"
                              />
                            </svg>
                            Auto Train Homepage
                          </>
                        )}
                      </Button>

                      {/* Loading Progress Bar */}
                      {isLoading && (
                        <div className="mt-4 w-full">
                          <div className="flex justify-between items-center mb-2 text-sm text-gray-600">
                            <span>
                              {progress < 50
                                ? 'Analyzing homepage content...'
                                : 'Saving training data...'}
                            </span>
                            <span>{Math.round(progress)}%</span>
                          </div>
                          <div className="overflow-hidden w-full h-2 bg-gray-200 rounded-full">
                            <div
                              className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-300 ease-out"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => setIsEditSheetOpen(true)}
                      size="lg"
                      className="!p-6 !text-lg font-semibold text-blue-600 border-2 border-blue-200 shadow-sm transition-all duration-200 hover:bg-blue-50 hover:shadow-md"
                    >
                      <svg
                        className="mr-2 !w-5 !h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                      Edit Content
                    </Button>
                  )}

                  {/* Additional Info */}
                  <p className="max-w-lg !text-base !my-0">
                    <strong>Note:</strong> Train Products, Pages and Posts in their respective tabs.
                    <br /> You need to train as many as possible data to get
                    good results.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Feature Cards */}
            <div className="grid px-6 w-full max-w-4xl md:grid-cols-2">
              <div className="p-6">
                <h3 className="mb-3 !text-lg font-semibold !text-gray-500">
                  Smart Auto Training
                </h3>
                <p className="!text-base leading-relaxed !text-gray-500">
                  Our AI automatically analyzes your homepage to understand your
                  website's functionality, content, and key features. This
                  creates a solid foundation for intelligent conversations.
                </p>
              </div>

              <div className="p-6">
                <h3 className="mb-3 !text-lg font-semibold !text-gray-500">
                  Easy Customization
                </h3>
                <p className="!text-base leading-relaxed !text-gray-500">
                  After auto-training, you can easily review, modify, and add
                  more information to ensure your chatbot handles detailed
                  queries with perfect accuracy.
                </p>
              </div>
            </div>

            <Separator />

            <p className="pt-6 max-w-lg !text-base text-center text-gray-500">
              💡 <strong>Pro tip:</strong> Keep the auto-trained content as your
              foundation for best results. You can always add more specific
              information later.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Edit Content Sheet */}
      <Sheet open={isEditSheetOpen} onOpenChange={setIsEditSheetOpen}>
        <SheetContent className="sm:!max-w-2xl flex flex-col h-full gap-0">
          <SheetHeader className="mt-6">
            <SheetTitle className="text-lg font-bold !my-0">
              Edit General Content
            </SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto flex-1 p-4 pt-0">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(handleSubmit)}
                className="space-y-6"
              >
                <FormField
                  control={form.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Content</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter text"
                          {...field}
                          className="min-h-[300px]"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => setIsEditSheetOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={isLoading}
                    loading={isLoading}
                    type="button"
                    onClick={quickTrain}
                  >
                    {isLoading ? 'Auto Training...' : 'Auto Train'}
                  </Button>
                  <Button
                    disabled={addIsPending || updateIsPending}
                    loading={addIsPending || updateIsPending}
                    type="submit"
                  >
                    {addIsPending || updateIsPending ? 'Saving...' : 'Save'}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
