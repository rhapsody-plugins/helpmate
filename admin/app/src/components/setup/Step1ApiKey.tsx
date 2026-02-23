import { Button } from '@/components/ui/button';
import { CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useApi } from '@/hooks/useApi';
import { useDataSource } from '@/hooks/useDataSource';
import api from '@/lib/axios';
import {
  HelpmateLoginURL,
  HelpmatePrivacyPolicyURL,
  HelpmateTermsOfServiceURL,
} from '@/lib/constants';
import { zodResolver } from '@hookform/resolvers/zod';
import { AxiosError } from 'axios';
import { useCallback, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const signupSchema = z
  .object({
    email: z.string().email('Please enter a valid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string(),
    consentToTerms: z.boolean().refine((val) => val === true, {
      message: 'You must agree to our terms and consent to receive emails',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

const activateSchema = z.object({
  apiKey: z.string().min(1, 'API key is required'),
});

type SignupFormData = z.infer<typeof signupSchema>;
type ActivateFormData = z.infer<typeof activateSchema>;

interface Step1ApiKeyProps {
  onComplete: () => void;
}

export default function Step1ApiKey({ onComplete }: Step1ApiKeyProps) {
  const { activateApiKeyMutation, getFreeApiKeyMutation, apiKeyQuery } =
    useApi();
  const { getSourcesMutation, addSourceMutation, updateSourceMutation } =
    useDataSource();
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [autoTrainError, setAutoTrainError] = useState<string | null>(null);
  const hasTrainedRef = useRef(false);

  const { mutate: fetchMutate } = getSourcesMutation;
  const { mutate: addMutate } = addSourceMutation;
  const { mutate: updateMutate } = updateSourceMutation;
  const { refetch: refetchApiKey } = apiKeyQuery;

  const signupForm = useForm<SignupFormData>({
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      consentToTerms: true,
    },
    resolver: zodResolver(signupSchema),
  });

  const activateForm = useForm<ActivateFormData>({
    defaultValues: {
      apiKey: '',
    },
    resolver: zodResolver(activateSchema),
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

    // Fetch existing data to check if we need to update or add
    fetchMutate('general', {
      onSuccess: (existingData) => {
        if (existingData?.[0]?.id) {
          updateMutate(
            {
              id: existingData[0].id,
              document_type: 'general',
              title: data.title,
              content: data.content,
              vector: existingData[0].vector,
              metadata: {},
              last_updated: Math.floor(Date.now() / 1000),
            },
            {
              onSuccess: () => {
                clearInterval(saveProgressInterval);
                setProgress(100);
                setTimeout(() => {
                  setIsLoading(false);
                  setProgress(0);
                  hasTrainedRef.current = true;
                  onComplete();
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
                setTimeout(() => {
                  setIsLoading(false);
                  setProgress(0);
                  hasTrainedRef.current = true;
                  onComplete();
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
      },
      onError: () => {
        // If fetch fails, try to add anyway
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
              setTimeout(() => {
                setIsLoading(false);
                setProgress(0);
                hasTrainedRef.current = true;
                onComplete();
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
      },
    });
  }, [addMutate, fetchMutate, updateMutate, onComplete]);

  const handleSignupSubmit = (data: SignupFormData) => {
    getFreeApiKeyMutation.mutate(
      {
        email: data.email,
        password: data.password,
      },
      {
        onSuccess: () => {
          refetchApiKey().then(() => {
            // Wait a bit for the API key to be available, then trigger quick train
            setTimeout(() => {
              quickTrainInternal();
            }, 1000);
          });
        },
      }
    );
  };

  const handleActivateSubmit = (data: ActivateFormData) => {
    activateApiKeyMutation.mutate(data.apiKey, {
      onSuccess: () => {
        refetchApiKey().then(() => {
          // Wait a bit for the API key to be available, then trigger quick train
          setTimeout(() => {
            quickTrainInternal();
          }, 1000);
        });
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="mb-6 text-center">
        <h2 className="!mb-2 !mt-0 !text-2xl !font-bold">Step 1: Activate API Key</h2>
        <p className="text-muted-foreground !my-0">
          Create a free API key or use an existing one to get started
        </p>
      </div>

      {isLoading && (
        <div className="space-y-4">
          <div className="flex gap-2 justify-center items-center">
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
              Initializing Chatbot...
            </span>
          </div>
          <div className="w-full">
            <div className="flex justify-between items-center mb-2 text-sm text-gray-600">
              <span>
                {progress < 50
                  ? 'Preparing chatbot...'
                  : 'Finishing up...'}
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
        </div>
      )}

      {autoTrainError && !isLoading && (
        <div className="p-4 bg-red-50 rounded-lg border border-red-200">
          <p className="font-medium text-red-600">{autoTrainError}</p>
          <Button
            onClick={quickTrainInternal}
            size="sm"
            className="mt-2"
            variant="outline"
          >
            Retry
          </Button>
        </div>
      )}

      {!isLoading && !autoTrainError && (
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          {/* Left column - Signup form for new users */}
          <div className="flex flex-col gap-6 pr-8 border-r border-gray-200 max-md:border-none max-md:pr-0">
            <div>
              <CardHeader className="px-0 pb-4">
                <CardTitle className="text-xl">
                  Get Your Free Forever API Key
                </CardTitle>
              </CardHeader>
              <Form {...signupForm}>
                <form
                  onSubmit={signupForm.handleSubmit(handleSignupSubmit)}
                  className="space-y-4"
                >
                  <FormField
                    control={signupForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="Enter your email"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={signupForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="Create a password"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={signupForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm Password</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="Confirm your password"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Combined Consent */}
                  <FormField
                    control={signupForm.control}
                    name="consentToTerms"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-start space-x-3">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="grid gap-1.5 leading-none">
                            <FormLabel className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                              I agree to the{' '}
                              <a
                                href={HelpmateTermsOfServiceURL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 underline hover:text-blue-800"
                              >
                                Terms of Service
                              </a>{' '}
                              and{' '}
                              <a
                                href={HelpmatePrivacyPolicyURL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 underline hover:text-blue-800"
                              >
                                Privacy Policy
                              </a>
                            </FormLabel>
                            <p className="text-xs text-muted-foreground !my-0">
                              I consent to receive emails about product
                              updates, security notices, and account
                              information, and to allow the chatbot to
                              securely store and use the public data I provide
                              to deliver more accurate and personalized
                              responses.
                            </p>
                          </div>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={getFreeApiKeyMutation.isPending}
                    loading={getFreeApiKeyMutation.isPending}
                  >
                    Get Free Forever API Key
                  </Button>
                </form>
              </Form>
            </div>
          </div>

          {/* Right column - Activate API key for existing users */}
          <div className="flex flex-col gap-6">
            <div>
              <CardHeader className="px-0 pb-4">
                <CardTitle className="text-xl">Activate Your API Key</CardTitle>
              </CardHeader>
              <Form {...activateForm}>
                <form
                  onSubmit={activateForm.handleSubmit(handleActivateSubmit)}
                  className="space-y-4"
                >
                  <FormField
                    control={activateForm.control}
                    name="apiKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>API Key</FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            placeholder="Enter your API key"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    className="w-full"
                    variant="secondary"
                    disabled={activateApiKeyMutation.isPending}
                    loading={activateApiKeyMutation.isPending}
                  >
                    Activate API Key
                  </Button>
                </form>
              </Form>
            </div>
            <div className="pt-6 mt-6 border-t border-gray-200">
              <h3 className="mb-4 text-lg font-semibold">
                Already have an API key?
              </h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Log in to retrieve your existing API key and enter it above.
              </p>
              <Button
                className="w-full"
                variant="outline"
                size="lg"
                onClick={() => window.open(HelpmateLoginURL, '_blank', 'noopener,noreferrer')}
              >
                Log In to Get API Key
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

