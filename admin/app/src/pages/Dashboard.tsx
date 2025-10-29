import aiChatbot from '@/assets/apps/ai.svg';
import rotateCCW from '@/assets/apps/rotate-ccw.svg';
import shoppingCartAbandoned from '@/assets/apps/shopping-cart-abandoned.svg';
import truckLocation from '@/assets/apps/truck-location.svg';
import Loading from '@/components/Loading';
import RichTextEditor from '@/components/RichTextEditor';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useMain } from '@/contexts/MainContext';
import { useApi } from '@/hooks/useApi';
import { useDataSource } from '@/hooks/useDataSource';
import api from '@/lib/axios';
import { HelpmatePricingURL, HelpmateURL } from '@/lib/constants';
import ActivateApi from '@/pages/ActivateApi';
import { zodResolver } from '@hookform/resolvers/zod';
import { AxiosError } from 'axios';
import {
  ArrowUpRight,
  Brain,
  Crown,
  Headset,
  Rocket,
  ScanSearch,
  SquarePen,
  TicketPercent,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { ChangeSvgColor } from 'svg-color-tools';
import { z } from 'zod';

const formSchema = z.object({
  title: z.string(),
  content: z.string().min(1, 'Content is required'),
});

type FormData = z.infer<typeof formSchema>;

interface DashboardProps {
  setAppPage: (page: string) => void;
}

export default function Dashboard({ setAppPage }: DashboardProps) {
  const { setPage } = useMain();
  const { apiKeyQuery } = useApi();
  const { data: apiKeyData, isLoading: isApiKeyLoading } = apiKeyQuery;
  const { getSourcesMutation, addSourceMutation, updateSourceMutation } =
    useDataSource();
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [autoTrainError, setAutoTrainError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
  const hasCheckedRef = useRef(false);

  const { data: fetchData, mutate: fetchMutate } = getSourcesMutation;

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

  const quickTrainInternal = useCallback(async () => {
    setIsLoading(true);
    setProgress(0);
    setAutoTrainError(null);
    let data: { title: string; content: string } | undefined;

    // Phase 1: Getting content (0% to 50%)
    setProgress(10);
    const contentProgressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 45) return prev;
        return prev + Math.random() * 8;
      });
    }, 150);

    try {
      const response = await api.post('/quick-train-homepage');

      if (response.data.error) {
        throw new Error(response.data.message);
      }
      data = response.data;
    } catch (error) {
      console.error('Error fetching URL:', error);
      const errorMessage =
        (error as AxiosError<{ message: string }>).response?.data?.message ??
        'Failed to fetch URL content';
      setAutoTrainError(errorMessage);
      clearInterval(contentProgressInterval);
      setIsLoading(false);
      setProgress(0);
      return;
    } finally {
      clearInterval(contentProgressInterval);
      setProgress(50);
    }

    // Phase 2: Saving content (50% to 100%)
    setProgress(55);
    const saveProgressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) return prev;
        return prev + Math.random() * 8;
      });
    }, 150);

    if (!data?.title || !data?.content) {
      setAutoTrainError('Failed to fetch homepage content. Try Again.');
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
            setTimeout(() => {
              setIsLoading(false);
              setProgress(0);
              setIsComplete(true);
              navigateToDataSource();
            }, 500);
          },
          onError: (error) => {
            clearInterval(saveProgressInterval);
            setIsLoading(false);
            setProgress(0);
            setAutoTrainError(
              error.message || 'Failed to save content. Try again.'
            );
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
            setProgress(100);
            form.reset({
              title: data.title,
              content: data.content,
            });
            setTimeout(() => {
              setIsLoading(false);
              setProgress(0);
              setIsComplete(true);
              navigateToDataSource();
            }, 500);
          },
          onError: (error) => {
            clearInterval(saveProgressInterval);
            setIsLoading(false);
            setProgress(0);
            setAutoTrainError(
              error.message || 'Failed to save content. Try again.'
            );
          },
        }
      );
    }
  }, [addMutate, fetchData, updateMutate, form]);

  const quickTrain = useCallback(() => {
    setAutoTrainError(null); // Clear any previous errors
    quickTrainInternal();
  }, [quickTrainInternal]);

  // Check if content already exists, if not auto-train (only once)
  useEffect(() => {
    if (apiKeyData?.api_key && !hasCheckedRef.current) {
      hasCheckedRef.current = true;
      fetchMutate('general', {
        onSuccess: (data) => {
          if (data.length > 0 && data[0].content) {
            // Data exists, show edit button
            setIsComplete(true);
            form.reset({
              title: data[0].title,
              content: data[0].content,
            });
          } else {
            // No data exists, trigger auto-train
            quickTrain();
          }
        },
      });
    }
  }, [apiKeyData?.api_key, fetchMutate, quickTrain]);

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
              setIsEditSheetOpen(false);
            },
            onError: (error) => {
              toast.error(
                error.message || 'Failed to save content. Try again.'
              );
            },
          }
        );
      }
    },
    [fetchData, updateMutate, form]
  );

  const navigateToDataSource = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', 'data-source');
    window.history.pushState({}, '', url.toString());
    setPage('data-source');
    setAppPage('home');
  }, [setPage, setAppPage]);

  const navigateToApps = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', 'apps');
    window.history.pushState({}, '', url.toString());
    setPage('apps');
    setAppPage('home');
  }, [setPage, setAppPage]);

  if (isApiKeyLoading) {
    return (
      <div className="min-h-[30vh] flex flex-col justify-between">
        <Loading />
      </div>
    );
  }

  return (
    <div className="min-h-[30vh] flex flex-col justify-between">
      {!apiKeyData?.api_key ? (
        <ActivateApi />
      ) : (
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-0 shadow-lg">
          <CardContent className="flex flex-col justify-center items-center p-8">
            <Card className="py-12 w-full text-center rounded-xl border border-primary-200">
              <CardContent>
                <div className="flex flex-col gap-4 items-center mx-auto max-w-lg">
                  {isLoading && (
                    <>
                      <div className="flex gap-2 items-center">
                        <svg
                          className="w-6 h-6 animate-spin"
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
                            className="opacity-75 fill-primary"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        <span className="text-lg font-semibold">
                          Gathering Website Information...
                        </span>
                      </div>
                      <div className="mt-4 w-full">
                        <div className="flex justify-between items-center mb-2 text-sm text-gray-600">
                          <span>
                            {progress < 50
                              ? 'Analyzing website information...'
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
                    </>
                  )}

                  {autoTrainError && !isLoading && (
                    <>
                      <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                        <p className="font-medium text-red-600">
                          {autoTrainError}
                        </p>
                      </div>
                      <Button
                        onClick={quickTrain}
                        size="lg"
                        className="!p-6 !text-lg font-semibold text-white bg-gradient-to-r from-blue-500 to-indigo-600 shadow-lg transition-all duration-200 transform hover:from-blue-600 hover:to-indigo-700 hover:shadow-xl hover:scale-105"
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
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                          />
                        </svg>
                        Retry
                      </Button>
                    </>
                  )}

                  {!isComplete && !isLoading && !autoTrainError && <Loading />}

                  {isComplete && !isLoading && !autoTrainError && (
                    <div className="flex flex-col gap-3 items-center w-full sm:flex-row sm:w-auto">
                      <Button
                        variant="outline"
                        onClick={navigateToDataSource}
                        size="lg"
                      >
                        <ChangeSvgColor src={aiChatbot} className="w-4 h-4" />
                        Train Chatbot
                      </Button>
                      <Button
                        onClick={() => setIsEditSheetOpen(true)}
                        size="lg"
                        className="!text-lg font-semibold"
                      >
                        <SquarePen className="w-5 h-5" />
                        Edit Website Information
                      </Button>
                      <Button
                        variant="outline"
                        onClick={navigateToApps}
                        size="lg"
                      >
                        <Brain className="w-5 h-5" strokeWidth={1.5} />
                        App Center
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      )}

      <Card className="gap-0 py-0 mt-6 shadow-lg border-primary/50">
        <div className="p-6 !flex justify-between items-center bg-[#FAFBFF] rounded-t-xl">
          <div className="flex gap-4 items-center">
            <Crown className="w-12 h-12 text-primary" />
            <div className="flex-1">
              <CardTitle className="text-2xl text-primary-800">
                Why upgrade to pro?
              </CardTitle>
              <CardDescription className="text-base text-primary-800">
                Our top features that driving revenue and elevating the customer
                experience.
              </CardDescription>
            </div>
          </div>
          <CardAction className="flex gap-3 justify-center items-center my-auto">
            <Button
              variant="outline"
              size="default"
              onClick={() => window.open(HelpmateURL, '_blank')}
            >
              Learn More
              <ArrowUpRight className="w-4 h-4" />
            </Button>
            <Button
              size="default"
              onClick={() => window.open(HelpmatePricingURL, '_blank')}
            >
              Upgrade Now
              <ArrowUpRight className="w-4 h-4" />
            </Button>
          </CardAction>
        </div>
        <CardContent className="py-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 [&_path]:stroke-primary">
            <div className="flex gap-3 items-center">
              <Rocket className="w-5 h-5 text-primary" strokeWidth={1.2} />
              <span className="text-sm font-medium text-slate-700">
                Proactive Sales
              </span>
            </div>
            <div className="flex gap-3 items-center">
              <TicketPercent
                className="w-5 h-5 text-primary"
                strokeWidth={1.2}
              />
              <span className="text-sm font-medium text-slate-700">
                Coupon Delivery
              </span>
            </div>
            <div className="flex gap-3 items-center">
              <ScanSearch className="w-5 h-5 text-primary" strokeWidth={1.2} />
              <span className="text-sm font-medium text-slate-700">
                Product Search by Image
              </span>
            </div>
            <div className="flex gap-3 items-center">
              <ChangeSvgColor src={shoppingCartAbandoned} className="w-5 h-5" />
              <span className="text-sm font-medium text-slate-700">
                Abandoned Cart Recovery
              </span>
            </div>
            <div className="flex gap-3 items-center">
              <ChangeSvgColor src={truckLocation} className="w-5 h-5" />
              <span className="text-sm font-medium text-slate-700">
                Order Tracking
              </span>
            </div>
            <div className="flex gap-3 items-center">
              <ChangeSvgColor src={rotateCCW} className="w-5 h-5" />
              <span className="text-sm font-medium text-slate-700">
                Refund & Return
              </span>
            </div>
            <div className="flex gap-3 items-center">
              <Headset className="w-5 h-5 text-primary" strokeWidth={1.2} />
              <span className="text-sm font-medium text-slate-700">
                Human Handover
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Content Sheet */}
      <Sheet open={isEditSheetOpen} onOpenChange={setIsEditSheetOpen}>
        <SheetContent className="sm:!max-w-2xl flex flex-col h-full gap-0">
          <SheetHeader className="mt-6">
            <SheetTitle className="text-lg font-bold !my-0">
              Edit Website Information
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
                        <RichTextEditor
                          content={field.value}
                          onChange={field.onChange}
                          useMarkdown={true}
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
