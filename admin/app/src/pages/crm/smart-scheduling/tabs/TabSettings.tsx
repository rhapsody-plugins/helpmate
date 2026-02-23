import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  useSmartScheduling,
  SmartSchedulingSettings,
} from '@/hooks/useSmartScheduling';
import { useCrm } from '@/hooks/useCrm';
import { Copy, Check } from 'lucide-react';
import { useEffect, useState } from 'react';
import api from '@/lib/axios';
import { ProBadge } from '@/components/ProBadge';
import { useSettings } from '@/hooks/useSettings';
import { cn } from '@/lib/utils';

const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
];

const FORM_FIELDS = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'message', label: 'Message' },
  { key: 'date', label: 'Date' },
  { key: 'time', label: 'Time' },
];

export default function TabSettings() {
  const { getProQuery } = useSettings();
  const isPro = getProQuery.data ?? false;
  const { getSettingsMutation, updateSettingsMutation } = useSmartScheduling();
  const {
    mutate: getSettings,
    isPending: isFetching,
    data: settings,
  } = getSettingsMutation;
  const { mutate: updateSettings, isPending: isUpdating } =
    updateSettingsMutation;
  const { useEmailTemplates } = useCrm();
  const { data: emailTemplates, isLoading: isLoadingTemplates } =
    useEmailTemplates();

  const [copied, setCopied] = useState(false);
  const [localSettings, setLocalSettings] =
    useState<SmartSchedulingSettings | null>(null);
  const [isRecreatingTemplates, setIsRecreatingTemplates] = useState(false);

  const defaultSettings: SmartSchedulingSettings = {
    enabled: false,
    timeSlotDuration: 30,
    slotReserveMinutes: 5,
    buttonText: 'Get Appointments',
    availability: {
      monday: { enabled: false, startTime: '09:00', endTime: '17:00' },
      tuesday: { enabled: false, startTime: '09:00', endTime: '17:00' },
      wednesday: { enabled: false, startTime: '09:00', endTime: '17:00' },
      thursday: { enabled: false, startTime: '09:00', endTime: '17:00' },
      friday: { enabled: false, startTime: '09:00', endTime: '17:00' },
      saturday: { enabled: false, startTime: '09:00', endTime: '17:00' },
      sunday: { enabled: false, startTime: '09:00', endTime: '17:00' },
    },
    formFields: {
      name: { visible: true, required: true },
      email: { visible: true, required: true },
      phone: { visible: true, required: false },
      message: { visible: true, required: false },
      date: { visible: true, required: true },
      time: { visible: true, required: true },
    },
    emailTemplates: {
      pending: null,
      confirmed: null,
      cancelled: null,
    },
  };

  const currentSettings = localSettings || settings || defaultSettings;

  useEffect(() => {
    getSettings();
  }, [getSettings]);

  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
      // Create default templates if they don't exist
      if (emailTemplates && emailTemplates.length > 0) {
        const existingTemplates = emailTemplates;
        const hasPending = existingTemplates.some(
          (t) => t.name === 'Schedule Pending Confirmation'
        );
        const hasConfirmed = existingTemplates.some(
          (t) => t.name === 'Schedule Confirmed'
        );
        const hasCancelled = existingTemplates.some(
          (t) => t.name === 'Schedule Cancelled'
        );

        if (
          (!hasPending || !hasConfirmed || !hasCancelled) &&
          (!settings.emailTemplates?.pending ||
            !settings.emailTemplates?.confirmed ||
            !settings.emailTemplates?.cancelled)
        ) {
          // Create default templates via API
          api
            .post('/crm/smart-schedules/create-default-templates')
            .then((response) => {
              if (response.data && response.data.templates) {
                const newSettings = {
                  ...settings,
                  emailTemplates: {
                    pending:
                      response.data.templates.pending ||
                      settings.emailTemplates?.pending ||
                      null,
                    confirmed:
                      response.data.templates.confirmed ||
                      settings.emailTemplates?.confirmed ||
                      null,
                    cancelled:
                      response.data.templates.cancelled ||
                      settings.emailTemplates?.cancelled ||
                      null,
                  },
                };
                setLocalSettings(newSettings);
                updateSettings(newSettings);
              }
            })
            .catch(() => {
              // Silently fail
            });
        }
      }
    }
  }, [settings, emailTemplates, updateSettings]);

  const handleSave = () => {
    const settingsToSave = localSettings || settings || defaultSettings;
    // Ensure email, date, and time fields are always visible and required
    const enforcedSettings = {
      ...settingsToSave,
      formFields: {
        ...settingsToSave.formFields,
        email: { visible: true, required: true },
        date: { visible: true, required: true },
        time: { visible: true, required: true },
      },
    };
    updateSettings(enforcedSettings);
  };

  const handleEnabledChange = (enabled: boolean) => {
    const settingsToUpdate = localSettings || settings || defaultSettings;
    const updated = { ...settingsToUpdate, enabled };
    setLocalSettings(updated);
    const enforcedSettings = {
      ...updated,
      formFields: {
        ...updated.formFields,
        email: { visible: true, required: true },
        date: { visible: true, required: true },
        time: { visible: true, required: true },
      },
    };
    updateSettings(enforcedSettings);
  };

  const handleTimeSlotDurationChange = (duration: string) => {
    const settingsToUpdate = localSettings || settings || defaultSettings;
    setLocalSettings({
      ...settingsToUpdate,
      timeSlotDuration: parseInt(duration, 10),
    });
  };

  const handleSlotReserveMinutesChange = (minutes: string) => {
    const settingsToUpdate = localSettings || settings || defaultSettings;
    setLocalSettings({
      ...settingsToUpdate,
      slotReserveMinutes: parseInt(minutes, 10),
    });
  };

  const handleDayAvailabilityChange = (
    day: string,
    field: 'enabled' | 'startTime' | 'endTime',
    value: boolean | string
  ) => {
    const settingsToUpdate = localSettings || settings || defaultSettings;
    setLocalSettings({
      ...settingsToUpdate,
      availability: {
        ...settingsToUpdate.availability,
        [day]: {
          ...settingsToUpdate.availability[day],
          [field]: value,
        },
      },
    });
  };

  const handleFormFieldChange = (
    field: string,
    property: 'visible' | 'required',
    value: boolean
  ) => {
    const settingsToUpdate = localSettings || settings || defaultSettings;
    const isRequiredField = ['email', 'date', 'time'].includes(field);

    // Prevent changing required fields
    if (isRequiredField) {
      if (property === 'visible' && !value) {
        return; // Don't allow hiding required fields
      }
      if (property === 'required' && !value) {
        return; // Don't allow unchecking required for required fields
      }
    }

    setLocalSettings({
      ...settingsToUpdate,
      formFields: {
        ...settingsToUpdate.formFields,
        [field]: {
          ...settingsToUpdate.formFields[
            field as keyof typeof settingsToUpdate.formFields
          ],
          [property]: value,
        },
      },
    });
  };

  const handleCopyShortcode = () => {
    const shortcode = '[helpmate_scheduling]';
    navigator.clipboard.writeText(shortcode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleEmailTemplateChange = (
    status: 'pending' | 'confirmed' | 'cancelled',
    templateId: string
  ) => {
    const settingsToUpdate = localSettings || settings || defaultSettings;
    const value = templateId === 'none' ? null : parseInt(templateId, 10);
    setLocalSettings({
      ...settingsToUpdate,
      emailTemplates: {
        ...settingsToUpdate.emailTemplates,
        [status]: value,
      },
    });
  };

  // Check which default templates are missing
  const getMissingTemplates = () => {
    if (!emailTemplates || emailTemplates.length === 0) {
      return ['pending', 'confirmed', 'cancelled'];
    }

    const missing: string[] = [];
    const templateNames = emailTemplates.map((t) => t.name);

    if (!templateNames.includes('Schedule Pending Confirmation')) {
      missing.push('pending');
    }
    if (!templateNames.includes('Schedule Confirmed')) {
      missing.push('confirmed');
    }
    if (!templateNames.includes('Schedule Cancelled')) {
      missing.push('cancelled');
    }

    return missing;
  };

  const handleRecreateMissingTemplates = async () => {
    setIsRecreatingTemplates(true);
    try {
      const response = await api.post(
        '/crm/smart-schedules/create-default-templates'
      );
      if (response.data && response.data.templates) {
        const settingsToUpdate = localSettings || settings || defaultSettings;
        const newSettings = {
          ...settingsToUpdate,
          emailTemplates: {
            pending:
              response.data.templates.pending ||
              settingsToUpdate.emailTemplates?.pending ||
              null,
            confirmed:
              response.data.templates.confirmed ||
              settingsToUpdate.emailTemplates?.confirmed ||
              null,
            cancelled:
              response.data.templates.cancelled ||
              settingsToUpdate.emailTemplates?.cancelled ||
              null,
          },
        };
        setLocalSettings(newSettings);
        updateSettings(newSettings);

        // Refresh email templates list
        window.location.reload();
      }
    } catch (error) {
      console.error('Failed to recreate templates:', error);
    } finally {
      setIsRecreatingTemplates(false);
    }
  };

  const missingTemplates = getMissingTemplates();

  if (isFetching) {
    return (
      <div className="space-y-6">
        <Skeleton className="w-full h-32" />
        <Skeleton className="w-full h-64" />
        <Skeleton className="w-full h-64" />
      </div>
    );
  }

  return (
    <div className="relative space-y-6">
      {!isPro && (
        <ProBadge
          topMessage="Configure your scheduling system with custom availability, time slots, and email notifications."
          buttonText="Unlock Scheduling"
          tooltipMessage={null}
        />
      )}
      <Card
        className={cn(
          !isPro && 'opacity-50 cursor-not-allowed pointer-events-none'
        )}
      >
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex gap-1 items-center text-xl font-bold">
              Appointments & Bookings Settings
              <InfoTooltip message="Enable or disable the Appointments & Bookings feature. When disabled, the shortcode will not display the form." />
            </CardTitle>
            <div className="flex gap-2 items-center">
              <Label htmlFor="enabled-toggle" className="text-sm">
                {currentSettings.enabled ? 'Enabled' : 'Disabled'}
              </Label>
              <Switch
                id="enabled-toggle"
                checked={currentSettings.enabled}
                onCheckedChange={handleEnabledChange}
                disabled={isUpdating || !isPro}
              />
            </div>
          </div>
        </CardHeader>
        {currentSettings.enabled && (
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Shortcode Section */}
              <div className="pt-4 space-y-4 border-t">
                <div className="flex gap-2 items-center">
                  <Label className="text-base font-medium">Shortcode</Label>
                  <InfoTooltip message="Copy this shortcode and paste it on any page or post where you want to display the scheduling form." />
                </div>
                <div className="flex gap-2 items-center">
                  <Input
                    value="[helpmate_scheduling]"
                    readOnly
                    className="font-mono"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopyShortcode}
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Chatbot Button Settings Section */}
              <div className="pt-4 space-y-4 border-t">
                <div className="flex gap-2 items-center">
                  <Label className="text-base font-medium">
                    Chatbot Button Settings
                  </Label>
                  <InfoTooltip message="Configure the button that appears in the chatbot interface to redirect users to the scheduling page." />
                </div>
                <div className="space-y-2">
                  <Input
                    id="button-text"
                    value={currentSettings.buttonText || 'Get Appointments'}
                    onChange={(e) => {
                      const settingsToUpdate =
                        localSettings || settings || defaultSettings;
                      setLocalSettings({
                        ...settingsToUpdate,
                        buttonText: e.target.value,
                      });
                    }}
                    placeholder="Get Appointments"
                  />
                </div>
              </div>
            </div>

            {/* Email Settings Section */}
            <div className="pt-4 space-y-4 border-t">
              <div className="flex justify-between items-center">
                <div className="flex gap-2 items-center">
                  <Label className="text-base font-medium">
                    Email Settings
                  </Label>
                  <InfoTooltip message="Select email templates from CRM to send automatically when schedule status changes. Templates can include variables like {name}, {email}, {date}, and {time}." />
                </div>
                {!isLoadingTemplates && missingTemplates.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRecreateMissingTemplates}
                    disabled={isRecreatingTemplates}
                  >
                    {isRecreatingTemplates
                      ? 'Recreating...'
                      : 'Recreate Missing Templates'}
                  </Button>
                )}
              </div>
              {!isLoadingTemplates && missingTemplates.length > 0 && (
                <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <p className="text-sm text-yellow-800">
                    <strong>Missing Templates:</strong> The following default
                    email templates are missing:{' '}
                    {missingTemplates
                      .map((status) => {
                        const labels: Record<string, string> = {
                          pending: 'Schedule Pending Confirmation',
                          confirmed: 'Schedule Confirmed',
                          cancelled: 'Schedule Cancelled',
                        };
                        return labels[status];
                      })
                      .join(', ')}
                    . Click "Recreate Missing Templates" to restore them.
                  </p>
                </div>
              )}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="email-template-pending">
                    Pending Status Email Template
                  </Label>
                  <Select
                    value={
                      currentSettings.emailTemplates?.pending?.toString() ||
                      'none'
                    }
                    onValueChange={(value) =>
                      handleEmailTemplateChange('pending', value)
                    }
                  >
                    <SelectTrigger id="email-template-pending">
                      <SelectValue placeholder="Select template" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {emailTemplates?.map((template) => (
                        <SelectItem
                          key={template.id}
                          value={template.id.toString()}
                        >
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email-template-confirmed">
                    Confirmed Status Email Template
                  </Label>
                  <Select
                    value={
                      currentSettings.emailTemplates?.confirmed?.toString() ||
                      'none'
                    }
                    onValueChange={(value) =>
                      handleEmailTemplateChange('confirmed', value)
                    }
                  >
                    <SelectTrigger id="email-template-confirmed">
                      <SelectValue placeholder="Select template" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {emailTemplates?.map((template) => (
                        <SelectItem
                          key={template.id}
                          value={template.id.toString()}
                        >
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email-template-cancelled">
                    Cancelled Status Email Template
                  </Label>
                  <Select
                    value={
                      currentSettings.emailTemplates?.cancelled?.toString() ||
                      'none'
                    }
                    onValueChange={(value) =>
                      handleEmailTemplateChange('cancelled', value)
                    }
                  >
                    <SelectTrigger id="email-template-cancelled">
                      <SelectValue placeholder="Select template" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {emailTemplates?.map((template) => (
                        <SelectItem
                          key={template.id}
                          value={template.id.toString()}
                        >
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {currentSettings.enabled && (
        <>
          <Card
            className={cn(
              !isPro && 'opacity-50 cursor-not-allowed pointer-events-none'
            )}
          >
            <CardHeader>
              <CardTitle className="flex gap-1 items-center text-xl font-bold">
                Availability Settings
                <InfoTooltip message="Set your availability for each day of the week. Time slots will be generated automatically based on the time slot duration." />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-wrap gap-x-8 gap-y-4 items-end">
                <div className="space-y-2">
                  <Label>Time Slot Duration (minutes)</Label>
                  <Select
                    value={currentSettings.timeSlotDuration.toString()}
                    onValueChange={handleTimeSlotDurationChange}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 minutes</SelectItem>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="60">60 minutes</SelectItem>
                      <SelectItem value="90">90 minutes</SelectItem>
                      <SelectItem value="120">120 minutes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Hold selected slot for (minutes)</Label>
                  <Select
                    value={(currentSettings.slotReserveMinutes ?? 5).toString()}
                    onValueChange={handleSlotReserveMinutesChange}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 minutes</SelectItem>
                      <SelectItem value="5">5 minutes</SelectItem>
                      <SelectItem value="10">10 minutes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-muted-foreground text-sm">
                When a visitor selects a time, the slot is reserved for this
                long so they can complete the form. Others cannot book it
                during this time.
              </p>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {DAYS_OF_WEEK.map((day) => (
                  <Card
                    key={day.key}
                    className="py-2 px-3 bg-transparent border border-gray-200 shadow-none"
                  >
                    <div className="flex gap-3 items-center min-w-0">
                      <div className="flex shrink-0 gap-2 items-center">
                        <Switch
                          checked={
                            currentSettings.availability[day.key]?.enabled ||
                            false
                          }
                          onCheckedChange={(checked) =>
                            handleDayAvailabilityChange(
                              day.key,
                              'enabled',
                              !!checked
                            )
                          }
                          className="scale-90"
                        />
                        <Label className="text-sm w-20 mb-0">
                          {day.label}
                        </Label>
                      </div>
                      <Input
                        type="time"
                        value={
                          currentSettings.availability[day.key]?.startTime ||
                          '09:00'
                        }
                        onChange={(e) =>
                          handleDayAvailabilityChange(
                            day.key,
                            'startTime',
                            e.target.value
                          )
                        }
                        disabled={
                          !currentSettings.availability[day.key]?.enabled
                        }
                        className="h-8 flex-1 min-w-[7.5rem] text-sm bg-white"
                      />
                      <span className="text-sm text-muted-foreground shrink-0">
                        –
                      </span>
                      <Input
                        type="time"
                        value={
                          currentSettings.availability[day.key]?.endTime ||
                          '17:00'
                        }
                        onChange={(e) =>
                          handleDayAvailabilityChange(
                            day.key,
                            'endTime',
                            e.target.value
                          )
                        }
                        disabled={
                          !currentSettings.availability[day.key]?.enabled
                        }
                        className="h-8 flex-1 min-w-[7.5rem] text-sm bg-white"
                      />
                    </div>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card
            className={cn(
              !isPro && 'opacity-50 cursor-not-allowed pointer-events-none'
            )}
          >
            <CardHeader>
              <CardTitle className="flex gap-1 items-center text-xl font-bold">
                Form Settings
                <InfoTooltip message="Configure which fields are visible and required in the scheduling form. Name, date, time, and at least one contact method (email or phone) must be required." />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {FORM_FIELDS.map((field) => {
                  const isRequiredField = ['email', 'date', 'time'].includes(
                    field.key
                  );
                  return (
                    <div
                      key={field.key}
                      className="flex justify-between items-center p-4 rounded-lg border"
                    >
                      <Label className="font-medium">{field.label}</Label>
                      <div className="flex gap-6 items-center">
                        {!isRequiredField && (
                          <div className="flex gap-2 items-center">
                            <Checkbox
                              checked={
                                currentSettings.formFields[
                                  field.key as keyof typeof currentSettings.formFields
                                ]?.visible || false
                              }
                              onCheckedChange={(checked) =>
                                handleFormFieldChange(
                                  field.key,
                                  'visible',
                                  !!checked
                                )
                              }
                            />
                            <Label className="text-sm">Visible</Label>
                          </div>
                        )}
                        {!isRequiredField && (
                          <div className="flex gap-2 items-center">
                            <Checkbox
                              checked={
                                currentSettings.formFields[
                                  field.key as keyof typeof currentSettings.formFields
                                ]?.required || false
                              }
                              onCheckedChange={(checked) =>
                                handleFormFieldChange(
                                  field.key,
                                  'required',
                                  !!checked
                                )
                              }
                              disabled={
                                !currentSettings.formFields[
                                  field.key as keyof typeof currentSettings.formFields
                                ]?.visible
                              }
                            />
                            <Label className="text-sm">Required</Label>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div
            className={cn(
              'flex justify-end',
              !isPro && 'opacity-50 cursor-not-allowed pointer-events-none'
            )}
          >
            <Button
              onClick={handleSave}
              disabled={isUpdating}
              loading={isUpdating}
            >
              {isUpdating ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
