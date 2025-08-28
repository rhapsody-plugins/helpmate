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
import { InfoTooltip } from '@/components/ui/info-tooltip';
import {
  RadioCard,
  RadioCardGroup,
  RadioCardLabel,
} from '@/components/ui/radio-card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { useSettings } from '@/hooks/useSettings';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const formSchema = z.object({
  temperature: z.number().min(0).max(1).step(0.1),
  tone: z.string().min(1, { message: 'Tone is required' }),
  language: z.string().min(1, { message: 'Language is required' }),
  similarity_threshold: z.number().min(0.05).max(1).step(0.05),
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
    th: { name: 'Thai' }
  };

  const { mutate: getSettings, isPending: isFetching } = getSettingsMutation;
  const { mutate: updateSettings, isPending: isUpdating } =
    updateSettingsMutation;

  const form = useForm<FormData>({
    defaultValues: {
      temperature: 0.5,
      tone: 'friendly',
      language: 'default',
      similarity_threshold: 0.3,
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
          language:
            (data.language as string) === ''
              ? 'default'
              : (data.language as string),
          // ensure a safe default if not present in saved settings
          similarity_threshold:
            (data as Partial<FormData>).similarity_threshold ?? 0.3,
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
                <div className="grid grid-cols-1 gap-4">
                  <FormField
                    control={form.control}
                    name="temperature"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Temperature {field.value}
                          <InfoTooltip message="Choose a low temperature for consistent, on-brand replies, or raise it for more creative, varied answers" />
                        </FormLabel>
                        <FormControl className="h-[36px]">
                          <Slider
                            min={0}
                            max={1}
                            step={0.1}
                            value={[field.value]}
                            onValueChange={([value]) => field.onChange(value)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="similarity_threshold"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Minimum Match Score {Math.round(field.value * 100)}%
                        <InfoTooltip message="Sets how closely results must match your query. Higher = fewer but more accurate. Lower = more but less precise." />
                      </FormLabel>
                      <FormControl className="h-[36px]">
                        <Slider
                          min={0}
                          max={1}
                          step={0.05}
                          value={[field.value]}
                          onValueChange={([value]) => field.onChange(value)}
                        />
                      </FormControl>
                      <FormMessage />
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
