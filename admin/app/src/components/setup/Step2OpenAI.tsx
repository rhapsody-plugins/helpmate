import { useState } from 'react';
import { ProBadge } from '@/components/ProBadge';
import { Button } from '@/components/ui/button';
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
import { useSettings } from '@/hooks/useSettings';
import {
  OpenAIApiKeysURL,
  OpenAIBillingURL,
} from '@/lib/constants';
import { cn } from '@/lib/utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Info } from 'lucide-react';

const openAiSchema = z.object({
  openAiKey: z
    .string()
    .min(1, 'OpenAI API key is required')
    .refine((val) => val.startsWith('sk-'), {
      message: 'OpenAI API key must start with "sk-"',
    }),
});

type OpenAiFormData = z.infer<typeof openAiSchema>;

interface Step2OpenAIProps {
  onComplete: () => void;
  onSkip: () => void;
}

export default function Step2OpenAI({ onComplete, onSkip }: Step2OpenAIProps) {
  const { getProQuery } = useSettings();
  const { data: isPro } = getProQuery;
  const { saveOpenAiKeyMutation } = useApi();
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<OpenAiFormData>({
    defaultValues: {
      openAiKey: '',
    },
    resolver: zodResolver(openAiSchema),
  });

  const handleSubmit = (data: OpenAiFormData) => {
    if (!isPro) return;
    setIsSaving(true);
    saveOpenAiKeyMutation.mutate(data.openAiKey, {
      onSuccess: () => {
        setIsSaving(false);
        onComplete();
      },
      onError: () => {
        setIsSaving(false);
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="mb-6 text-center">
        <h2 className="!mb-2 !mt-0 !text-2xl !font-bold">
          Step 2: Add Your OpenAI API Key (Optional)
        </h2>
        <p className="text-muted-foreground !my-0">
          You can add your own OpenAI API key for additional credits
        </p>
      </div>

      <div className="mx-auto space-y-6 max-w-2xl">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            <div className="relative">
              {!isPro && (
                <ProBadge
                  topMessage="Unlimited Chat Usage (via Your OpenAI API Key)"
                  buttonText="Enable Unlimited Chats"
                  tooltipMessage={null}
                />
              )}
              <div
                className={cn(
                  !isPro && 'opacity-15 cursor-not-allowed pointer-events-none'
                )}
              >
                <div className="flex gap-3 items-start p-4 mb-4 bg-blue-50 rounded-lg border border-blue-200">
                  <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 space-y-2 text-sm text-blue-800">
                    <p className="!text-base">
                      <strong>Note:</strong> You'll still get free credits even
                      if you don't add your OpenAI API key. This step is
                      completely optional.
                    </p>
                    <p className="!text-base">
                      <strong>Get your API key:</strong>{' '}
                      <a
                        href={OpenAIApiKeysURL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-700 underline hover:no-underline"
                      >
                        OpenAI API keys
                      </a>
                      {' '}— sign in at platform.openai.com → API keys →
                      Create new secret key.
                    </p>
                    <p className="!text-base">
                      <strong>Add credit/balance:</strong> You must add credit
                      in your OpenAI account for the API to work without
                      issues:{' '}
                      <a
                        href={OpenAIBillingURL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-700 underline hover:no-underline"
                      >
                        Billing
                      </a>
                      .
                    </p>
                    <p className="!text-base">
                      This uses the OpenAI API (pay-as-you-go), not a ChatGPT
                      Plus subscription.
                    </p>
                  </div>
                </div>
                <FormField
                  control={form.control}
                  name="openAiKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>OpenAI API Key</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="sk-..."
                          {...field}
                          disabled={!isPro}
                        />
                      </FormControl>
                      <FormMessage />
                      <p className="text-xs text-muted-foreground">
                        Your key will be encrypted and stored securely
                      </p>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={onSkip}
                className="flex-1"
                disabled={isSaving}
              >
                Skip This Step
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={isSaving || !isPro}
                loading={isSaving}
              >
                Save & Continue
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
