import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import {
  RadioCard,
  RadioCardGroup,
  RadioCardLabel,
} from '@/components/ui/radio-card';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useSettings } from '@/hooks/useSettings';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const formSchema = z.object({
  ai_enabled: z.boolean(),
  tone: z.string().min(1, { message: 'Tone is required' }),
  language: z.string().min(1, { message: 'Language is required' }),
});

type FormData = z.infer<typeof formSchema>;

const tones = [
  {
    value: 'friendly',
    label: 'Friendly',
    description: 'Warm and approachable',
  },
  {
    value: 'professional',
    label: 'Professional',
    description: 'Formal and business-like',
  },
  { value: 'casual', label: 'Casual', description: 'Relaxed and informal' },
  {
    value: 'technical',
    label: 'Technical',
    description: 'Precise and detailed',
  },
];

export default function TabAi() {
  const { getSettingsMutation, updateSettingsMutation } = useSettings();

  // Static language list based on README.txt
  const languages = {
    default: { name: 'Default (Auto-detect)' },
    en: { name: 'English' },
    es: { name: 'Spanish' },
    fr: { name: 'French' },
    de: { name: 'German' },
    zh: { name: 'Chinese (Simplified and Traditional)' },
    ja: { name: 'Japanese' },
    ko: { name: 'Korean' },
    it: { name: 'Italian' },
    pt: { name: 'Portuguese' },
    nl: { name: 'Dutch' },
    ru: { name: 'Russian' },
    ar: { name: 'Arabic' },
    hi: { name: 'Hindi' },
    bn: { name: 'Bengali' },
    tr: { name: 'Turkish' },
    sv: { name: 'Swedish' },
    no: { name: 'Norwegian' },
    da: { name: 'Danish' },
    fi: { name: 'Finnish' },
    pl: { name: 'Polish' },
    el: { name: 'Greek' },
    he: { name: 'Hebrew' },
    vi: { name: 'Vietnamese' },
    th: { name: 'Thai' },
  };

  const { mutate: getSettings, isPending: isFetching } = getSettingsMutation;
  const { mutate: updateSettings, isPending: isUpdating } =
    updateSettingsMutation;

  const form = useForm<FormData>({
    defaultValues: {
      ai_enabled: true,
      tone: 'friendly',
      language: 'default',
    },
    resolver: zodResolver(formSchema),
  });

  /*
  ┌─────────────────────────────────────────────────────────────────────────┐
  │   Handlers                                                              │
  └─────────────────────────────────────────────────────────────────────────┘
 */

  useEffect(() => {
    getSettings('ai', {
      onSuccess: (data) => {
        const formData = {
          ...data,
          ai_enabled: (data as Partial<FormData>).ai_enabled ?? true,
          language:
            (data.language as string) === ''
              ? 'default'
              : (data.language as string),
        };
        form.reset(formData);
      },
    });
  }, [getSettings, form]);

  const handleSubmit = (data: FormData) => {
    const submitData = {
      ...data,
      language: data.language === 'default' ? '' : data.language,
    };
    updateSettings({ key: 'ai', data: submitData });
  };

  /*
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │     Render                                                                  │
  └─────────────────────────────────────────────────────────────────────────────┘
 */
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex gap-1 items-center text-xl font-bold">
          Chatbot <InfoTooltip message="Settings for the AI model." />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-6"
          >
            {isFetching ? (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Skeleton className="w-32 h-5" />
                  <Skeleton className="w-full h-10" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="w-32 h-5" />
                  <Skeleton className="w-full h-10" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="w-16 h-5" />
                  <div className="grid grid-cols-2 gap-4">
                    <Skeleton className="h-20" />
                    <Skeleton className="h-20" />
                    <Skeleton className="h-20" />
                    <Skeleton className="h-20" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Skeleton className="w-20 h-5" />
                  <Skeleton className="w-full h-10" />
                </div>
                <Skeleton className="w-20 h-10" />
              </div>
            ) : (
              <>
                <FormField
                  control={form.control}
                  name="ai_enabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          Enable AI Responses
                          <InfoTooltip message="When disabled, the chatbot will remain visible but AI will not respond to any messages. Messages will still be stored for admin review." />
                        </FormLabel>
                        <FormDescription>
                          Globally enable or disable AI responses for all chat conversations
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="tone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Tone
                        <InfoTooltip message="The right tone builds connection, makes your AI feel like part of your team." />
                      </FormLabel>
                      <FormControl>
                        <RadioCardGroup
                          onValueChange={field.onChange}
                          value={field.value}
                          className="grid grid-cols-2 gap-4"
                        >
                          {tones.map((tone) => (
                            <div key={tone.value}>
                              <RadioCard value={tone.value} id={tone.value} />
                              <RadioCardLabel
                                htmlFor={tone.value}
                                className="cursor-pointer"
                              >
                                <div className="font-medium">{tone.label}</div>
                                <div className="text-sm text-muted-foreground">
                                  {tone.description}
                                </div>
                              </RadioCardLabel>
                            </div>
                          ))}
                        </RadioCardGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="language"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Language
                        <InfoTooltip message="Select the language for AI responses." />
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select a language" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-[300px] overflow-y-auto">
                          {Object.entries(languages).map(([code, langData]) => (
                            <SelectItem key={code} value={code}>
                              {langData.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator />

                <Button
                  type="submit"
                  disabled={isUpdating}
                  loading={isUpdating}
                >
                  {isUpdating ? 'Saving...' : 'Save'}
                </Button>
              </>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
