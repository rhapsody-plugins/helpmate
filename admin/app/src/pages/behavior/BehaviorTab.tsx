import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel
} from '@/components/ui/form';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useSettings } from '@/hooks/useSettings';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const formSchema = z.object({
  welcome_message: z.array(z.string()),
  welcome_message_sound: z.boolean(),
  hide_on_mobile: z.boolean(),
});

type FormData = z.infer<typeof formSchema>;

export default function BehaviorTab() {
  const { getSettingsMutation, updateSettingsMutation } = useSettings();
  const [newWelcomeMessage, setNewWelcomeMessage] = useState('');

  const { mutate: getSettings, isPending: isFetching } = getSettingsMutation;
  const { mutate: updateSettings, isPending: isUpdating } =
    updateSettingsMutation;

  const form = useForm<FormData>({
    defaultValues: {
      welcome_message: [],
      welcome_message_sound: true,
      hide_on_mobile: false,
    },
    resolver: zodResolver(formSchema),
    mode: 'onChange',
  });

  const welcomeMessages = form.watch('welcome_message');

  useEffect(() => {
    getSettings('behavior', {
      onSuccess: (data) => {
        form.reset({
          hide_on_mobile: (data.hide_on_mobile as boolean | undefined) ?? false,
          welcome_message: (data.welcome_message as string[]) || [],
          welcome_message_sound: (data.welcome_message_sound as boolean | undefined) ?? true,
        });
      },
    });
  }, [getSettings, form]);

  const handleSubmit = (data: FormData) => {
    getSettings('behavior', {
      onSuccess: (existingData) => {
        const mergedData = {
          ...existingData,
          hide_on_mobile: data.hide_on_mobile,
          welcome_message: data.welcome_message,
          welcome_message_sound: data.welcome_message_sound,
        };
        updateSettings({ key: 'behavior', data: mergedData });
      },
    });
  };

  const handleAddWelcomeMessage = () => {
    if (newWelcomeMessage.trim()) {
      const currentMessages = form.getValues('welcome_message');
      form.setValue('welcome_message', [
        ...currentMessages,
        newWelcomeMessage.trim(),
      ]);
      setNewWelcomeMessage('');
    }
  };

  const handleRemoveWelcomeMessage = (index: number) => {
    const currentMessages = form.getValues('welcome_message');
    form.setValue(
      'welcome_message',
      currentMessages.filter((_, i) => i !== index)
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex gap-1 items-center text-xl font-bold">
          Behavior <InfoTooltip message="Settings for the AI Behavior." />
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
                <Separator />

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Skeleton className="w-48 h-6" />
                    <div className="flex gap-2 items-center">
                      <Skeleton className="w-12 h-6" />
                      <Skeleton className="w-10 h-6" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="w-full h-10" />
                    <Skeleton className="w-full h-10" />
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="flex-1 h-10" />
                    <Skeleton className="w-24 h-10" />
                  </div>
                </div>

                <Separator />

                <Skeleton className="w-20 h-10" />
              </div>
            ) : (
              <>
                <Separator />

                <FormField
                  control={form.control}
                  name="hide_on_mobile"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="!flex gap-1 items-center !my-0">
                        Hide on Mobile
                        <InfoTooltip message="The chatbot will be hidden on screen under 600px." />
                      </FormLabel>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <Separator />

                <div className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="!flex gap-1 items-center text-lg font-medium !my-0">
                        Welcome Messages
                        <InfoTooltip message="The welcome messages that will be shown to the user when they first enter the chat." />
                      </h3>

                      <div className="flex gap-2 items-center">
                        <h4 className="!flex gap-1 items-center text-lg font-medium !my-0">
                          Sound
                          <InfoTooltip message="Whether to play a sound when the welcome message is shown." />
                        </h4>
                        <Switch
                          checked={form.watch('welcome_message_sound')}
                          onCheckedChange={(checked) =>
                            form.setValue('welcome_message_sound', checked)
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-4">
                      {welcomeMessages.length > 0 && (
                        <div className="space-y-2">
                          {welcomeMessages.map((message, index) => (
                            <div
                              key={index}
                              className="flex gap-2 items-center"
                            >
                              <div className="flex-1 p-2 bg-gray-50 rounded-md">
                                {message}
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  handleRemoveWelcomeMessage(index)
                                }
                              >
                                <Trash className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Input
                          className="bg-white"
                          placeholder="Enter welcome message"
                          value={newWelcomeMessage}
                          onChange={(e) =>
                            setNewWelcomeMessage(e.target.value)
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddWelcomeMessage();
                            }
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleAddWelcomeMessage}
                        >
                          <Plus className="w-4 h-4" />
                          Add
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

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
