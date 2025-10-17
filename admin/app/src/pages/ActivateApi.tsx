import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useApi } from '@/hooks/useApi';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  HelpmatePrivacyPolicyURL,
  HelpmateTermsOfServiceURL,
} from '@/lib/constants';

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

export default function ActivateApi() {
  const { activateApiKeyMutation, getFreeApiKeyMutation } = useApi();

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

  const handleSignupSubmit = (data: SignupFormData) => {
    getFreeApiKeyMutation.mutate({
      email: data.email,
      password: data.password,
    });
  };

  const handleActivateSubmit = (data: ActivateFormData) => {
    activateApiKeyMutation.mutate(data.apiKey);
  };

  return (
    <div className="min-h-[30vh]">
      <Card className="py-0 mx-auto w-full">
        <CardContent className="p-8">
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
                  <CardTitle className="text-xl">
                    Activate Your API Key
                  </CardTitle>
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
                <p className="mt-4 text-sm text-muted-foreground">
                  Already have an API key? Enter it above to get started.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
