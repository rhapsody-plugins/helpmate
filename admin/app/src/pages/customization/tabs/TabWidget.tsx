import HelpmateIcon from '@/assets/helpmate-logo-icon.svg';
import ChatBotPreview from '@/components/ChatBotPreview';
import GradientPicker from '@/components/GradientPicker';
import MediaPicker from '@/components/MediaPicker';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { useSettings } from '@/hooks/useSettings';
import { zodResolver } from '@hookform/resolvers/zod';
import { PlayIcon } from 'lucide-react';
import { useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { ChangeSvgColor } from 'svg-color-tools';
import { z } from 'zod';

const SOUND_EFFECTS = [
  `notification-1.mp3`,
  `notification-2.mp3`,
  `notification-3.mp3`,
  `notification-4.mp3`,
  `notification-5.mp3`,
];

const formSchema = z.object({
  bot_name: z.string(),
  bot_icon: z.string(),
  primary_color: z.string(),
  primary_gradient: z.string(),
  secondary_color: z.string(),
  secondary_gradient: z.string(),
  font_size: z.string(),
  sound_effect: z.string(),
  icon: z.string(),
  icon_size: z.string(),
  position: z.string(),
  icon_shape: z.string(),
  hide_on_mobile: z.boolean(),
});

type FormData = z.infer<typeof formSchema>;

export default function TabWidget() {
  const { getSettingsMutation, updateSettingsMutation } = useSettings();

  const { mutate: getSettings, isPending: isFetching } = getSettingsMutation;
  const { mutate: updateSettings, isPending: isUpdating } =
    updateSettingsMutation;

  const form = useForm<FormData>({
    defaultValues: {
      bot_name: 'Helpmate',
      bot_icon: '',
      primary_color: '#000000',
      primary_gradient: '#000000',
      secondary_color: '#000000',
      secondary_gradient: '#000000',
      font_size: '1rem',
      sound_effect: 'none',
      icon: '',
      icon_size: '60px',
      position: 'right',
      icon_shape: 'circle',
      hide_on_mobile: false,
    },
    resolver: zodResolver(formSchema),
  });

  const { watch } = form;
  const values = watch();

  /*
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │     Handlers                                                                │
  └─────────────────────────────────────────────────────────────────────────────┘
 */

  const handleSubmit = (data: FormData) => {
    updateSettings(
      { key: 'customization', data },
      {
        onSuccess: () => handleReset(),
      }
    );
  };

  const handleStyleUpdate = useCallback((data: FormData) => {
    const {
      primary_color,
      primary_gradient,
      secondary_color,
      secondary_gradient,
      font_size,
      icon_size,
      position,
    } = data;
    document.documentElement.style.setProperty(
      '--primary-2',
      primary_color as unknown as string
    );
    document.documentElement.style.setProperty(
      '--primary-gradient',
      primary_gradient as unknown as string
    );
    document.documentElement.style.setProperty(
      '--secondary-2',
      secondary_color as unknown as string
    );
    document.documentElement.style.setProperty(
      '--secondary-gradient',
      secondary_gradient as unknown as string
    );
    document.documentElement.style.setProperty(
      '--font-size',
      font_size as unknown as string
    );
    document.documentElement.style.setProperty(
      '--icon-size',
      icon_size as unknown as string
    );
    document.documentElement.style.setProperty(
      '--position',
      position as unknown as string
    );
  }, []);

  const handleReset = useCallback(() => {
    getSettings('customization', {
      onSuccess: (data) => {
        form.reset(data);
        handleStyleUpdate(data as unknown as FormData);
      },
    });
  }, [form, getSettings, handleStyleUpdate]);

  useEffect(() => {
    handleStyleUpdate(values);
  }, [values, handleStyleUpdate]);

  useEffect(() => {
    handleReset();
  }, [getSettings, form, handleReset]);

  /*
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │     Renders                                                                 │
  └─────────────────────────────────────────────────────────────────────────────┘
 */

  return (
    <div className="flex gap-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex gap-1 items-center text-xl font-bold">
            Chatbot{' '}
            <InfoTooltip message="Settings for the Helpmate chatbot widget." />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-6"
            >
              {isFetching ? (
                <div className="grid grid-cols-2 gap-4">
                  <Skeleton className="w-full h-10" />
                  <Skeleton className="w-full h-10" />
                  <Skeleton className="w-full h-10" />
                  <Skeleton className="w-full h-10" />
                  <Skeleton className="w-full h-10" />
                  <Skeleton className="w-full h-10" />
                  <Skeleton className="w-full h-20" />
                  <Skeleton className="w-full h-20" />
                  <Skeleton className="w-full h-10" />
                  <Skeleton className="w-full h-10" />
                  <Skeleton className="w-full h-10" />
                  <Skeleton className="w-full h-6" />
                  <div className="col-span-2">
                    <Skeleton className="w-20 h-10" />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="bot_icon"
                    render={({ field }) => (
                      <FormItem className="flex flex-col gap-2">
                        <FormLabel>Bot Icon</FormLabel>
                        <FormControl>
                          <MediaPicker
                            imageUrl={field.value}
                            setImageUrl={field.onChange}
                            defaultImage={
                              <div className="flex justify-center items-center">
                                <ChangeSvgColor
                                  src={HelpmateIcon}
                                  fill="black"
                                  className="flex justify-center items-center"
                                />
                              </div>
                            }
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="bot_name"
                    render={({ field }) => (
                      <FormItem className="flex flex-col gap-2">
                        <FormLabel>Bot Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Helpmate" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="primary_color"
                    render={({ field }) => (
                      <FormItem className="flex flex-col gap-2">
                        <FormLabel>Primary Color</FormLabel>
                        <FormControl>
                          <GradientPicker
                            background={field.value}
                            setBackground={field.onChange}
                            availableTabs={['solid']}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="primary_gradient"
                    render={({ field }) => (
                      <FormItem className="flex flex-col gap-2">
                        <FormLabel>Primary Gradient</FormLabel>
                        <FormControl>
                          <GradientPicker
                            background={field.value}
                            setBackground={field.onChange}
                            availableTabs={['gradient']}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="secondary_color"
                    render={({ field }) => (
                      <FormItem className="flex flex-col gap-2">
                        <FormLabel>Secondary Color</FormLabel>
                        <FormControl>
                          <GradientPicker
                            background={field.value}
                            setBackground={field.onChange}
                            availableTabs={['solid']}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="secondary_gradient"
                    render={({ field }) => (
                      <FormItem className="flex flex-col gap-2">
                        <FormLabel>Secondary Gradient</FormLabel>
                        <FormControl>
                          <GradientPicker
                            background={field.value}
                            setBackground={field.onChange}
                            availableTabs={['gradient']}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="font_size"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Font Size</FormLabel>
                        <FormControl>
                          <div className="space-y-2">
                            <Slider
                              min={1}
                              max={5}
                              step={0.1}
                              value={[
                                parseFloat(field.value.replace('rem', '')),
                              ]}
                              onValueChange={([value]) =>
                                field.onChange(`${value}rem`)
                              }
                            />
                            <div className="text-sm text-center text-muted-foreground">
                              {field.value}
                            </div>
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="icon_size"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Icon Size</FormLabel>
                        <FormControl>
                          <div className="space-y-2">
                            <Slider
                              min={60}
                              max={100}
                              step={1}
                              value={[parseInt(field.value.replace('px', ''))]}
                              onValueChange={([value]) =>
                                field.onChange(`${value}px`)
                              }
                            />
                            <div className="text-sm text-center text-muted-foreground">
                              {field.value}
                            </div>
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="sound_effect"
                    render={({ field }) => (
                      <FormItem className="flex flex-col gap-2">
                        <FormLabel>Sound Effect</FormLabel>
                        <div className="flex gap-2 items-center">
                          <FormControl className="w-full">
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select a sound effect" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                {SOUND_EFFECTS.map((soundEffect, index) => (
                                  <SelectItem key={index} value={soundEffect}>
                                    Notification {index + 1}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormControl>
                          {field.value !== 'none' && (
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => {
                                const audio = new Audio(
                                  `${window.wpHelpmateApiSettings?.site_url}/wp-content/plugins/helpmate/public/sounds/${field.value}`
                                );
                                audio.play();
                              }}
                            >
                              <PlayIcon className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </FormItem>
                    )}
                  />

                  {/* <FormField
                      control={form.control}
                      name="position"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Position</FormLabel>
                          <FormControl>
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select a position" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="right">Right</SelectItem>
                                <SelectItem value="left">Left</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                        </FormItem>
                      )}
                    /> */}

                  <FormField
                    control={form.control}
                    name="icon_shape"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Icon Shape</FormLabel>
                        <FormControl>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select a shape" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="circle">Circle</SelectItem>
                              <SelectItem value="square">Square</SelectItem>
                              <SelectItem value="rounded">Rounded</SelectItem>
                              <SelectItem value="rectangle">
                                Rectangle
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="icon"
                    render={({ field }) => (
                      <FormItem className="flex flex-col gap-2">
                        <FormLabel>Button Icon</FormLabel>
                        <FormControl>
                          <MediaPicker
                            imageUrl={field.value}
                            setImageUrl={field.onChange}
                            defaultImage={
                              <div className="flex justify-center items-center">
                                <ChangeSvgColor
                                  src={HelpmateIcon}
                                  fill="black"
                                  className="flex justify-center items-center"
                                />
                              </div>
                            }
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="hide_on_mobile"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Hide on Mobile</FormLabel>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <div className="col-span-2">
                    <Button
                      type="submit"
                      disabled={isUpdating}
                      loading={isUpdating}
                    >
                      {isUpdating ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                </div>
              )}
            </form>
          </Form>
        </CardContent>
      </Card>
      <ChatBotPreview
        icon={values.icon}
        position={values.position}
        bot_name={values.bot_name}
        bot_icon={values.bot_icon}
        loading={isFetching}
        icon_shape={values.icon_shape}
      />
    </div>
  );
}
