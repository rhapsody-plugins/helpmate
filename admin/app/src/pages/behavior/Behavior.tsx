import PageHeader from '@/components/PageHeader';
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
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useSettings } from '@/hooks/useSettings';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

const formSchema = z
  .object({
    human_handover: z.array(
      z.object({
        enabled: z.boolean(),
        title: z.string(),
        value: z.string(),
      })
    ),
    welcome_message: z.array(z.string()),
    welcome_message_sound: z.boolean(),
    show_ticket_creation_option: z.boolean(),
    collect_lead: z.boolean(),
    lead_form_fields: z.array(z.string()),
    hide_on_mobile: z.boolean(),
  })
  .refine(
    (data) => {
      return data.human_handover.every((item) => {
        if (item.enabled) {
          return (
            item.value &&
            item.value.length > 0 &&
            item.title &&
            item.title.length > 0
          );
        }
        return true;
      });
    },
    {
      message: 'Title and value are required when enabled',
      path: ['human_handover'],
    }
  );

type FormData = z.infer<typeof formSchema>;

export default function Behavior() {
  const { getSettingsMutation, updateSettingsMutation } = useSettings();
  const [newWelcomeMessage, setNewWelcomeMessage] = useState('');

  const { mutate: getSettings, isPending: isFetching } = getSettingsMutation;
  const { mutate: updateSettings, isPending: isUpdating } =
    updateSettingsMutation;

  const form = useForm<FormData>({
    defaultValues: {
      human_handover: [
        { enabled: false, title: 'Phone Number', value: '' },
        { enabled: false, title: 'Email', value: '' },
        { enabled: false, title: 'WhatsApp', value: '' },
        { enabled: false, title: 'Messenger', value: '' },
      ],
      welcome_message: [],
      welcome_message_sound: true,
      show_ticket_creation_option: true,
      collect_lead: false,
      lead_form_fields: ['name', 'email', 'message'],
      hide_on_mobile: false,
    },
    resolver: zodResolver(formSchema),
    mode: 'onChange',
  });

  useEffect(() => {
    const subscription = form.watch((value) => {
      console.log('Form values changed:', value);
      console.log('Form errors:', form.formState.errors);
    });
    return () => subscription.unsubscribe();
  }, [form.watch, form.formState.errors]);

  const { fields, append, remove } = useFieldArray<FormData>({
    control: form.control,
    name: 'human_handover',
  });

  const welcomeMessages = form.watch('welcome_message');

  useEffect(() => {
    getSettings('behavior', {
      onSuccess: (data) => {
        form.reset(data);
      },
    });
  }, [getSettings, form]);

  useEffect(() => {
    if (form.formState.errors.human_handover) {
      console.log('Form errors:', form.formState.errors);
      toast.error('Please fill in the required fields');
    }
  }, [form.formState.errors.human_handover]);

  const handleSubmit = (data: FormData) => {
    updateSettings({ key: 'behavior', data });
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
    <div className="gap-0">
      <PageHeader title="Behavior" />
      <div className="p-6">
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

                    {/* Welcome Messages Section Skeleton */}
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

                    {/* Human Handover Section Skeleton */}
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <Skeleton className="w-56 h-6" />
                        <Skeleton className="w-28 h-8" />
                      </div>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div className="p-1 rounded-md border border-gray-200">
                          <div className="flex gap-2 items-center">
                            <Skeleton className="w-16 h-6" />
                            <Skeleton className="flex-1 h-8" />
                            <Skeleton className="flex-1 h-8" />
                            <Skeleton className="w-8 h-8" />
                          </div>
                        </div>
                        <div className="p-1 rounded-md border border-gray-200">
                          <div className="flex gap-2 items-center">
                            <Skeleton className="w-16 h-6" />
                            <Skeleton className="flex-1 h-8" />
                            <Skeleton className="flex-1 h-8" />
                            <Skeleton className="w-8 h-8" />
                          </div>
                        </div>
                        <div className="p-1 rounded-md border border-gray-200">
                          <div className="flex gap-2 items-center">
                            <Skeleton className="w-16 h-6" />
                            <Skeleton className="flex-1 h-8" />
                            <Skeleton className="flex-1 h-8" />
                            <Skeleton className="w-8 h-8" />
                          </div>
                        </div>
                        <div className="p-1 rounded-md border border-gray-200">
                          <div className="flex gap-2 items-center">
                            <Skeleton className="w-16 h-6" />
                            <Skeleton className="flex-1 h-8" />
                            <Skeleton className="flex-1 h-8" />
                            <Skeleton className="w-8 h-8" />
                          </div>
                        </div>
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
                      {/* Welcome Messages Section */}
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

                      <Separator />

                      {/* Human Handover Section */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center mb-3">
                          <h3 className="!flex gap-1 items-center text-lg font-medium !my-0">
                            Human Handover Options{' '}
                            <InfoTooltip message="Shows contact options when users ask for a human." />
                          </h3>
                          <div className="flex gap-2 items-center">
                            <div className="flex gap-2 items-center">
                              <h4 className="!flex gap-1 items-center text-lg font-medium !my-0">
                                Show Ticket Creation Option
                                <InfoTooltip message="Whether to show the ticket creation option also when users ask for a human." />
                              </h4>
                              <Switch
                                checked={form.watch(
                                  'show_ticket_creation_option'
                                )}
                                onCheckedChange={(checked) =>
                                  form.setValue(
                                    'show_ticket_creation_option',
                                    checked
                                  )
                                }
                              />
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                append({ enabled: false, title: '', value: '' })
                              }
                            >
                              <Plus className="w-4 h-4" />
                              Add Option
                            </Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          {fields.map((field, index) => (
                            <Card
                              key={field.id}
                              className="py-0 bg-transparent border border-gray-200 shadow-none"
                            >
                              <CardContent className="p-1">
                                <div className="flex gap-2 items-center">
                                  <FormField
                                    control={form.control}
                                    name={`human_handover.${index}.enabled`}
                                    render={({ field }) => (
                                      <FormItem className="flex items-center mb-0">
                                        <FormControl>
                                          <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                            className="scale-90"
                                          />
                                        </FormControl>
                                        <FormLabel className="mb-0 text-xs">
                                          Enable
                                        </FormLabel>
                                      </FormItem>
                                    )}
                                  />
                                  <FormField
                                    control={form.control}
                                    name={`human_handover.${index}.title`}
                                    render={({ field }) => (
                                      <FormItem className="flex-1 mb-0">
                                        <FormControl>
                                          <Input
                                            className="h-8 text-sm bg-white"
                                            placeholder="Title"
                                            {...field}
                                          />
                                        </FormControl>
                                      </FormItem>
                                    )}
                                  />
                                  <FormField
                                    control={form.control}
                                    name={`human_handover.${index}.value`}
                                    render={({ field }) => (
                                      <FormItem className="flex-1 mb-0">
                                        <FormControl>
                                          <Input
                                            className="h-8 text-sm bg-white"
                                            placeholder="Value"
                                            {...field}
                                          />
                                        </FormControl>
                                      </FormItem>
                                    )}
                                  />
                                  {fields.length > 1 && (
                                    <Button
                                      type="button"
                                      variant="destructive"
                                      size="icon"
                                      className="p-1 h-8"
                                      onClick={() => remove(index)}
                                    >
                                      <Trash className="w-3 h-3" />
                                    </Button>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>

                      <Separator />

                      <div className="flex flex-col gap-3">
                        <h3 className="!flex gap-1 items-center text-lg font-medium !my-0">
                          Collect Lead
                          <InfoTooltip message="When enabled, the AI will collect lead information at the start of the conversation." />
                        </h3>

                        <FormField
                          control={form.control}
                          name="collect_lead"
                          render={({ field }) => (
                            <FormItem className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-row justify-between items-center self-end p-2 h-9 rounded-md border border-input">
                                  <FormLabel>Enable Lead Collection</FormLabel>
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                    />
                                  </FormControl>
                                </div>
                              </div>
                              {field.value && (
                                <FormField
                                  control={form.control}
                                  name="lead_form_fields"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Lead Form Fields</FormLabel>
                                      <FormControl>
                                        <div className="flex flex-wrap gap-2">
                                          {[
                                            'name',
                                            'email',
                                            'phone',
                                            'website',
                                            'message',
                                          ].map((fieldName) => (
                                            <Button
                                              key={fieldName}
                                              type="button"
                                              variant={
                                                (field.value || []).includes(
                                                  fieldName
                                                )
                                                  ? 'secondary'
                                                  : 'outline'
                                              }
                                              onClick={() => {
                                                const currentValue =
                                                  field.value || [];
                                                const newValue =
                                                  currentValue.includes(
                                                    fieldName
                                                  )
                                                    ? currentValue.filter(
                                                        (v) => v !== fieldName
                                                      )
                                                    : [
                                                        ...currentValue,
                                                        fieldName,
                                                      ];
                                                field.onChange(newValue);
                                              }}
                                              className="capitalize"
                                            >
                                              {fieldName}
                                            </Button>
                                          ))}
                                        </div>
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              )}
                              <FormMessage />
                            </FormItem>
                          )}
                        />
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
      </div>
    </div>
  );
}
