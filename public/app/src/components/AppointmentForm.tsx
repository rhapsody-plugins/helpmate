'use client';

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import api from '@/lib/axios';
import { CheckCircle2, XCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

type FormFieldConfig = { visible: boolean; required: boolean };
type SmartSchedulesSettings = {
  formFields?: Record<string, FormFieldConfig>;
};

type AppointmentFormValues = {
  name: string;
  email: string;
  phone: string;
  message: string;
  date: string;
  time: string;
};

const defaultFormFields: Record<string, FormFieldConfig> = {
  name: { visible: true, required: true },
  email: { visible: true, required: true },
  phone: { visible: true, required: false },
  message: { visible: true, required: false },
  date: { visible: true, required: true },
  time: { visible: true, required: true },
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function formatTimeSlot(slot: string): string {
  if (!slot) return '';
  const parts = slot.split(':');
  return `${parts[0]}:${parts[1] ?? '00'}`;
}

const RESERVE_EXPIRED_MSG = 'Your hold expired. Please select a time again.';
const SLOT_TAKEN_MSG = 'This slot is no longer available. Please choose another time.';

export function AppointmentForm() {
  const [settings, setSettings] = useState<SmartSchedulesSettings | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [timeSlotsLoading, setTimeSlotsLoading] = useState(false);
  const [slotListKey, setSlotListKey] = useState(0);
  const [reservationToken, setReservationToken] = useState<string | null>(null);
  const [reservationExpiresAt, setReservationExpiresAt] = useState<number | null>(null);
  const [submitMessage, setSubmitMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const formFields = settings?.formFields ?? defaultFormFields;

  const form = useForm<AppointmentFormValues>({
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      message: '',
      date: '',
      time: '',
    },
  });

  const selectedDate = form.watch('date');

  const clearReservation = useCallback(() => {
    setReservationToken(null);
    setReservationExpiresAt(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    api
      .get<SmartSchedulesSettings>('settings/smart_schedules')
      .then((res) => {
        if (!cancelled) setSettings(res.data ?? null);
      })
      .catch(() => {
        if (!cancelled) setSettingsError('Failed to load form settings. Please refresh.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    clearReservation();
    form.setValue('time', '');
  }, [selectedDate, clearReservation, form]);

  useEffect(() => {
    if (!selectedDate) {
      setTimeSlots([]);
      form.setValue('time', '');
      return;
    }
    let cancelled = false;
    setTimeSlotsLoading(true);
    api
      .get<{ data?: string[] }>('schedules/available-slots', {
        params: { date: selectedDate },
      })
      .then((res) => {
        if (!cancelled) {
          const data = res.data?.data ?? [];
          setTimeSlots(Array.isArray(data) ? data : []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTimeSlots([]);
          setSubmitMessage({ type: 'error', text: 'Failed to load available time slots.' });
        }
      })
      .finally(() => {
        if (!cancelled) setTimeSlotsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDate, slotListKey, form]);

  const refetchSlots = useCallback(() => {
    setSlotListKey((k) => k + 1);
  }, []);

  const handleTimeSelect = useCallback(
    async (value: string) => {
      const date = form.getValues('date');
      if (!date || !value) return;

      const prevToken = reservationToken;
      if (prevToken) {
        api.post('schedules/release-slot', { reservation_token: prevToken }).catch(() => {});
      }
      setReservationToken(null);
      setReservationExpiresAt(null);

      try {
        const res = await api.post<{
          error?: boolean;
          message?: string;
          reservation_token?: string;
          expires_at?: number;
        }>('schedules/reserve-slot', { date, time: value });
        if (res.data?.error) {
          form.setValue('time', '');
          setSubmitMessage({ type: 'error', text: res.data?.message ?? SLOT_TAKEN_MSG });
          refetchSlots();
          return;
        }
        const token = res.data?.reservation_token ?? null;
        const expiresAt = res.data?.expires_at ?? null;
        if (token != null && expiresAt != null) {
          setReservationToken(token);
          setReservationExpiresAt(expiresAt);
        }
      } catch {
        form.setValue('time', '');
        setSubmitMessage({ type: 'error', text: SLOT_TAKEN_MSG });
        refetchSlots();
      }
    },
    [form, reservationToken, refetchSlots]
  );

  useEffect(() => {
    if (reservationExpiresAt == null) return;
    const interval = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      if (now >= reservationExpiresAt) {
        clearReservation();
        form.setValue('time', '');
        setSubmitMessage({ type: 'error', text: RESERVE_EXPIRED_MSG });
        refetchSlots();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [reservationExpiresAt, clearReservation, form, refetchSlots]);

  const nowSec = Math.floor(Date.now() / 1000);
  const remainingSeconds =
    reservationExpiresAt != null ? Math.max(0, reservationExpiresAt - nowSec) : null;
  const countdownMins = remainingSeconds != null ? Math.floor(remainingSeconds / 60) : 0;
  const countdownSecs = remainingSeconds != null ? remainingSeconds % 60 : 0;
  const countdownLabel =
    remainingSeconds != null ? `${countdownMins}:${String(countdownSecs).padStart(2, '0')}` : '';

  const isFieldVisible = (key: string) => formFields[key]?.visible !== false;
  const isFieldRequired = (key: string) => formFields[key]?.required === true;

  const emailConfig = formFields.email;
  const phoneConfig = formFields.phone;
  const requireAtLeastOneContact =
    emailConfig &&
    phoneConfig &&
    emailConfig.visible &&
    phoneConfig.visible &&
    !emailConfig.required &&
    !phoneConfig.required;

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitMessage(null);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (values.date) {
      const d = new Date(values.date);
      if (d < today) {
        form.setError('date', { message: 'Please select a future date' });
        return;
      }
    }

    if (requireAtLeastOneContact) {
      const hasEmail = (values.email ?? '').trim();
      const hasPhone = (values.phone ?? '').trim();
      if (!hasEmail && !hasPhone) {
        form.setError('email', { message: 'Email or phone is required' });
        form.setError('phone', { message: 'Email or phone is required' });
        return;
      }
    }

    if (values.email && !EMAIL_REGEX.test(values.email)) {
      form.setError('email', { message: 'Please enter a valid email address' });
      return;
    }

    try {
      const body: Record<string, unknown> = {
        name: values.name,
        email: values.email,
        phone: values.phone || undefined,
        message: values.message || undefined,
        scheduled_date: values.date,
        scheduled_time: values.time,
      };
      if (reservationToken && reservationExpiresAt != null && reservationExpiresAt > Math.floor(Date.now() / 1000)) {
        body.reservation_token = reservationToken;
      }

      const res = await api.post<{ error?: boolean; message?: string }>('schedules', body);

      if (res.data?.error) {
        const msg = res.data.message ?? 'Failed to schedule appointment.';
        if (msg.includes('expired') || msg.includes('reservation')) {
          clearReservation();
          form.setValue('time', '');
          refetchSlots();
        }
        setSubmitMessage({ type: 'error', text: msg });
        return;
      }

      clearReservation();
      setSubmitMessage({
        type: 'success',
        text: 'Appointment scheduled successfully! We will contact you soon.',
      });
      form.reset({ name: '', email: '', phone: '', message: '', date: '', time: '' });
      setTimeSlots([]);
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string }; status?: number } }).response?.data?.message
          : null;
      const status = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { status?: number } }).response?.status
        : 0;
      if (status === 400 && message && (message.includes('expired') || message.includes('reservation'))) {
        clearReservation();
        form.setValue('time', '');
        refetchSlots();
      }
      setSubmitMessage({
        type: 'error',
        text: message ?? 'Failed to schedule appointment. Please try again.',
      });
    }
  });

  if (settingsError) {
    return (
      <div className="py-2 text-sm text-destructive" role="alert">
        {settingsError}
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="py-4 text-sm text-center text-muted-foreground">
        Loading form...
      </div>
    );
  }

  const minDate = new Date().toISOString().split('T')[0];

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-4">
        {isFieldVisible('name') && (
          <FormField
            control={form.control}
            name="name"
            rules={{ required: isFieldRequired('name') ? 'This field is required' : false }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Name {isFieldRequired('name') && <span className="text-destructive">*</span>}
                </FormLabel>
                <FormControl>
                  <Input placeholder="Name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {isFieldVisible('email') && (
          <FormField
            control={form.control}
            name="email"
            rules={{
              required: isFieldRequired('email') || requireAtLeastOneContact
                ? 'This field is required'
                : false,
            }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Email{' '}
                  {(isFieldRequired('email') || requireAtLeastOneContact) && (
                    <span className="text-destructive">*</span>
                  )}
                </FormLabel>
                <FormControl>
                  <Input type="email" placeholder="Email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {isFieldVisible('phone') && (
          <FormField
            control={form.control}
            name="phone"
            rules={{
              required: isFieldRequired('phone') ? 'This field is required' : false,
            }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Phone {isFieldRequired('phone') && <span className="text-destructive">*</span>}
                </FormLabel>
                <FormControl>
                  <Input type="tel" placeholder="Phone" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {isFieldVisible('message') && (
          <FormField
            control={form.control}
            name="message"
            rules={{ required: isFieldRequired('message') ? 'This field is required' : false }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Message {isFieldRequired('message') && <span className="text-destructive">*</span>}
                </FormLabel>
                <FormControl>
                  <Textarea placeholder="Message" rows={4} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {isFieldVisible('date') && (
          <FormField
            control={form.control}
            name="date"
            rules={{ required: isFieldRequired('date') ? 'This field is required' : false }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Date {isFieldRequired('date') && <span className="text-destructive">*</span>}
                </FormLabel>
                <FormControl>
                  <Input type="date" min={minDate} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {isFieldVisible('time') && (
          <FormField
            control={form.control}
            name="time"
            rules={{ required: isFieldRequired('time') ? 'This field is required' : false }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Time {isFieldRequired('time') && <span className="text-destructive">*</span>}
                </FormLabel>
                <Select
                  disabled={!selectedDate || timeSlotsLoading}
                  onValueChange={(value) => {
                    field.onChange(value);
                    handleTimeSelect(value);
                  }}
                  value={field.value}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue
                        placeholder={
                          timeSlotsLoading
                            ? 'Loading...'
                            : !selectedDate
                              ? 'Select a time'
                              : timeSlots.length === 0
                                ? 'No available slots'
                                : 'Select a time'
                        }
                      />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {timeSlots.map((slot) => (
                      <SelectItem key={slot} value={slot}>
                        {formatTimeSlot(slot)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {reservationExpiresAt != null && countdownLabel && (
                  <p
                    className={`text-sm ${remainingSeconds !== null && remainingSeconds <= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}
                  >
                    You have {countdownLabel} to complete your booking.
                  </p>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Scheduling...' : 'Schedule Appointment'}
        </Button>

        {submitMessage && (
          <div
            role="alert"
            className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm ${
              submitMessage.type === 'success'
                ? 'border-green-200 bg-green-50 !text-green-800 dark:border-green-800 dark:bg-green-950/40 dark:!text-green-800'
                : 'border-red-200 bg-red-50 !text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:!text-red-800'
            }`}
          >
            {submitMessage.type === 'success' ? (
              <CheckCircle2 className="text-green-600 size-5 shrink-0 dark:text-green-400" />
            ) : (
              <XCircle className="text-red-600 size-5 shrink-0 dark:text-red-400" />
            )}
            <span>{submitMessage.text}</span>
          </div>
        )}
      </form>
    </Form>
  );
}
