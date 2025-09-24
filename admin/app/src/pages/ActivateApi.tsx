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
import { useApi } from '@/hooks/useApi';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const signupSchema = z
  .object({
    email: z.string().email('Please enter a valid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string(),
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
