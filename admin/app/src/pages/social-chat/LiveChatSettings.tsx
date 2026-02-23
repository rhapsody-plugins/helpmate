import TeamMemberForm from '@/components/crm/TeamMemberForm';
import Loading from '@/components/Loading';
import PageGuard from '@/components/PageGuard';
import PageHeader from '@/components/PageHeader';
import { ProBadge } from '@/components/ProBadge';
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
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { useSettings } from '@/hooks/useSettings';
import { useTeam } from '@/hooks/useTeam';
import { Plus, Trash2, UserCog } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
];

const DEFAULT_BUSINESS_HOURS: Record<
  string,
  { enabled: boolean; startTime: string; endTime: string }
> = Object.fromEntries(
  DAYS_OF_WEEK.map((d) => [
    d.key,
    { enabled: false, startTime: '09:00', endTime: '17:00' },
  ])
);

/** Switch to AI when no human reply for this long (seconds). 0 = Never. */
const AI_TAKEOVER_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: 'Never' },
  { value: 300, label: '5 min' },
  { value: 600, label: '10 min' },
  { value: 900, label: '15 min' },
  { value: 1800, label: '30 min' },
  { value: 3600, label: '1h' },
  { value: 7200, label: '2h' },
  { value: 21600, label: '6h' },
  { value: 43200, label: '12h' },
  { value: 86400, label: '24h' },
];

/** Common IANA timezones for business hours. Empty = use WordPress site timezone. */
const BUSINESS_HOURS_TIMEZONES: { value: string; label: string }[] = [
  { value: '', label: 'Site timezone (WordPress setting)' },
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'Eastern (US)' },
  { value: 'America/Chicago', label: 'Central (US)' },
  { value: 'America/Denver', label: 'Mountain (US)' },
  { value: 'America/Los_Angeles', label: 'Pacific (US)' },
  { value: 'Europe/London', label: 'London' },
  { value: 'Europe/Paris', label: 'Paris' },
  { value: 'Europe/Berlin', label: 'Berlin' },
  { value: 'Asia/Dubai', label: 'Dubai' },
  { value: 'Asia/Kolkata', label: 'India' },
  { value: 'Asia/Singapore', label: 'Singapore' },
  { value: 'Asia/Tokyo', label: 'Tokyo' },
  { value: 'Australia/Sydney', label: 'Sydney' },
];

type BusinessHoursForm = {
  business_hours_enabled: boolean;
  business_hours: Record<
    string,
    { enabled: boolean; startTime: string; endTime: string }
  >;
  business_hours_timezone: string;
  ai_takeover_after_seconds: number;
};

export default function LiveChatSettings() {
  const { getProQuery, getSettingsMutation, updateSettingsMutation } = useSettings();
  const isPro = getProQuery.data ?? false;
  const { mutate: getSettings, isPending: isFetching } = getSettingsMutation;
  const { mutate: updateSettings, isPending: isUpdating } =
    updateSettingsMutation;

  const [businessHours, setBusinessHours] = useState(DEFAULT_BUSINESS_HOURS);
  const [businessHoursEnabled, setBusinessHoursEnabled] = useState(false);
  const [isAddAgentOpen, setIsAddAgentOpen] = useState(false);

  const { useTeamMembers, useRemoveRole } = useTeam();
  const agentsQuery = useTeamMembers({ role: 'live_chat_agent' });
  const removeRoleMutation = useRemoveRole();

  const form = useForm<BusinessHoursForm>({
    defaultValues: {
      business_hours_enabled: false,
      business_hours: DEFAULT_BUSINESS_HOURS,
      business_hours_timezone: '',
      ai_takeover_after_seconds: 0,
    },
  });

  useEffect(() => {
    getSettings('behavior', {
      onSuccess: (data) => {
        const bh =
          (data.business_hours as Record<
            string,
            { enabled: boolean; startTime: string; endTime: string }
          >) ?? DEFAULT_BUSINESS_HOURS;
        const enabled = (data.business_hours_enabled as boolean | undefined) ?? false;
        const merged = Object.keys(DEFAULT_BUSINESS_HOURS).reduce(
          (acc, key) => ({
            ...acc,
            [key]: bh[key] ?? DEFAULT_BUSINESS_HOURS[key],
          }),
          {} as Record<string, { enabled: boolean; startTime: string; endTime: string }>
        );
        setBusinessHours(merged);
        setBusinessHoursEnabled(enabled);
        const tz = (data.business_hours_timezone as string | undefined) ?? '';
        const takeover =
          (data.ai_takeover_after_seconds as number | undefined) ?? 0;
        form.reset({
          business_hours_enabled: enabled,
          business_hours: merged,
          business_hours_timezone: tz,
          ai_takeover_after_seconds: takeover,
        });
      },
    });
  }, [getSettings, form]);

  const handleBusinessHoursChange = (
    dayKey: string,
    field: 'enabled' | 'startTime' | 'endTime',
    value: boolean | string
  ) => {
    const next = {
      ...businessHours,
      [dayKey]: { ...businessHours[dayKey], [field]: value },
    };
    setBusinessHours(next);
    form.setValue('business_hours', next);
  };

  const handleSubmit = (data: BusinessHoursForm) => {
    getSettings('behavior', {
      onSuccess: (existingData) => {
        updateSettings({
          key: 'behavior',
          data: {
            ...existingData,
            business_hours_enabled: data.business_hours_enabled ?? false,
            business_hours: data.business_hours ?? DEFAULT_BUSINESS_HOURS,
            business_hours_timezone: data.business_hours_timezone ?? '',
            ai_takeover_after_seconds: data.ai_takeover_after_seconds ?? 0,
          },
        });
      },
    });
  };

  const currentEnabled = form.watch('business_hours_enabled') ?? businessHoursEnabled;

  const handleRemoveAgent = (userId: number) => {
    if (!confirm('Are you sure you want to remove this live chat agent?')) return;
    removeRoleMutation.mutate({ user_id: userId, role: 'live_chat_agent' });
  };

  return (
    <PageGuard page="live-chat-settings">
      <div className="gap-0">
        <PageHeader title="Live Chat" />
        <div className="p-6">
          <Card
            className={cn(
              'relative',
              !isPro && 'opacity-50 cursor-not-allowed pointer-events-none'
            )}
          >
            {!isPro && (
              <ProBadge
                topMessage="Configure business hours to control when live agents are available. Upgrade to Pro to enable Live Chat settings."
                buttonText="Unlock Live Chat Settings"
                tooltipMessage={null}
              />
            )}
            <CardHeader>
              <CardTitle className="flex gap-1 items-center text-xl font-bold">
                Settings
                <InfoTooltip message="When Use business hours is OFF, live agents are always available. When ON, the chat widget uses these hours to show availability." />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(handleSubmit)}
                  className="space-y-6"
                >
                  {isFetching ? (
                    <div className="space-y-4">
                      <Skeleton className="w-48 h-6" />
                      <div className="flex gap-2 items-center">
                        <Skeleton className="w-12 h-6" />
                        <Skeleton className="w-24 h-6" />
                      </div>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {DAYS_OF_WEEK.map((day) => (
                          <Skeleton key={day.key} className="h-20" />
                        ))}
                      </div>
                      <Skeleton className="w-20 h-10" />
                    </div>
                  ) : (
                    <>

                      <div className="space-y-4">
                        <h3 className="!flex gap-1 items-center text-lg font-medium !mt-0 !mb-2">
                          Live Chat Agents
                        </h3>
                        {agentsQuery.isLoading ? (
                          <Loading />
                        ) : agentsQuery.isError ? (
                          <div className="py-6 text-center text-red-500">
                            Failed to load live chat agents
                          </div>
                        ) : !agentsQuery.data || agentsQuery.data.length === 0 ? (
                          <div className="py-8 text-center">
                            <UserCog className="mx-auto mb-4 w-12 h-12 text-gray-400" />
                            <h4 className="mb-2 text-base font-semibold text-gray-900">
                              No live chat agents yet
                            </h4>
                            <p className="mb-4 text-gray-500 text-sm">
                              Add team members as live chat agents to handle live chats.
                            </p>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setIsAddAgentOpen(true)}
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              Add Live Chat Agent
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {agentsQuery.data.map((member) => (
                              <div
                                key={member.user_id}
                                className="flex justify-between items-center py-2 px-3 rounded-md border border-gray-200"
                              >
                                <div>
                                  <div className="font-medium">
                                    {member.user?.display_name || member.user?.login}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {member.user?.email}
                                  </div>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveAgent(member.user_id)}
                                  className="p-0 w-8 h-8 text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            ))}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setIsAddAgentOpen(true)}
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              Add Live Chat Agent
                            </Button>
                          </div>
                        )}
                      </div>

                      <div className="space-y-4">
                        <FormField
                          control={form.control}
                          name="ai_takeover_after_seconds"
                          render={({ field }) => (
                            <FormItem className="max-w-xs">
                              <FormLabel className="flex gap-1 items-center">
                                Switch to AI when no human reply for
                                <InfoTooltip message="If no agent replies within this time, the chat switches back to AI." />
                              </FormLabel>
                              <Select
                                value={String(field.value)}
                                onValueChange={(v) =>
                                  field.onChange(parseInt(v, 10))
                                }
                                disabled={!isPro}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {AI_TAKEOVER_OPTIONS.map((opt) => (
                                    <SelectItem
                                      key={opt.value}
                                      value={String(opt.value)}
                                    >
                                      {opt.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <h3 className="!flex gap-1 items-center text-lg font-medium !my-0">
                            Business hours
                            <InfoTooltip message="When Use business hours is OFF, live agents are always available. When ON, users can be connected during these hours; outside these hours they will be offered a support ticket." />
                          </h3>
                          <FormField
                            control={form.control}
                            name="business_hours_enabled"
                            render={({ field }) => (
                              <FormItem className="flex items-center gap-2 mb-0">
                                <FormControl>
                                  <Switch
                                    checked={field.value ?? false}
                                    onCheckedChange={(checked) => {
                                      field.onChange(!!checked);
                                      setBusinessHoursEnabled(!!checked);
                                    }}
                                    disabled={!isPro}
                                  />
                                </FormControl>
                                <FormLabel className="mb-0">Use business hours</FormLabel>
                              </FormItem>
                            )}
                          />
                        </div>
                        {currentEnabled && (
                          <>
                            <FormField
                              control={form.control}
                              name="business_hours_timezone"
                              render={({ field }) => (
                                <FormItem className="max-w-xs">
                                  <FormLabel>Timezone for business hours</FormLabel>
                                  <Select
                                    value={field.value === '' ? '__site__' : field.value}
                                    onValueChange={(v) =>
                                      field.onChange(v === '__site__' ? '' : v)
                                    }
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Site timezone" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {BUSINESS_HOURS_TIMEZONES.map((opt) => (
                                        <SelectItem
                                          key={opt.value || '__site__'}
                                          value={opt.value || '__site__'}
                                        >
                                          {opt.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <p className="text-xs text-muted-foreground">
                                    Business hours are evaluated in this timezone. Choose
                                    &quot;Site timezone&quot; to use your WordPress
                                    Settings → General timezone.
                                  </p>
                                </FormItem>
                              )}
                            />
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                              {DAYS_OF_WEEK.map((day) => (
                                <Card
                                  key={day.key}
                                  className="py-2 px-3 bg-transparent border border-gray-200 shadow-none"
                                >
                                  <div className="flex gap-3 items-center">
                                    <FormField
                                      control={form.control}
                                      name={`business_hours.${day.key}.enabled`}
                                      render={({ field }) => (
                                        <FormItem className="flex items-center gap-2 mb-0 flex-shrink-0">
                                          <FormControl>
                                            <Switch
                                              checked={field.value ?? false}
                                              onCheckedChange={(checked) => {
                                                field.onChange(!!checked);
                                                handleBusinessHoursChange(
                                                  day.key,
                                                  'enabled',
                                                  !!checked
                                                );
                                              }}
                                              className="scale-90"
                                              disabled={!isPro}
                                            />
                                          </FormControl>
                                          <FormLabel className="mb-0 text-sm w-20">
                                            {day.label}
                                          </FormLabel>
                                        </FormItem>
                                      )}
                                    />
                                    <FormField
                                      control={form.control}
                                      name={`business_hours.${day.key}.startTime`}
                                      render={({ field }) => (
                                        <FormItem className="mb-0 flex-1">
                                          <FormControl>
                                            <Input
                                              type="time"
                                              className="h-8 text-sm bg-white"
                                              {...field}
                                            />
                                          </FormControl>
                                        </FormItem>
                                      )}
                                    />
                                    <span className="text-sm text-muted-foreground">–</span>
                                    <FormField
                                      control={form.control}
                                      name={`business_hours.${day.key}.endTime`}
                                      render={({ field }) => (
                                        <FormItem className="mb-0 flex-1">
                                          <FormControl>
                                            <Input
                                              type="time"
                                              className="h-8 text-sm bg-white"
                                              {...field}
                                            />
                                          </FormControl>
                                        </FormItem>
                                      )}
                                    />
                                  </div>
                                </Card>
                              ))}
                            </div>
                          </>
                        )}
                      </div>

                      <Button
                        type="submit"
                        disabled={isUpdating || !isPro}
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

        {isAddAgentOpen && (
          <TeamMemberForm
            member={null}
            onClose={() => setIsAddAgentOpen(false)}
            onSuccess={() => setIsAddAgentOpen(false)}
            addRoleOnly="live_chat_agent"
          />
        )}
      </div>
    </PageGuard>
  );
}
