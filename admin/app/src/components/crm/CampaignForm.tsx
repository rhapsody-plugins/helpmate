import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useMain } from '@/contexts/MainContext';
import { useCrm } from '@/hooks/useCrm';
import { utcToDatetimeLocal } from '@/pages/crm/contacts/utils';
import { Campaign } from '@/types/crm';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const campaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required'),
  template_id: z.number().min(1, 'Template is required'),
  segment_id: z.number().min(1, 'Segment is required'),
  subject_override: z.string().optional(),
  body_override: z.string().optional(),
  type: z.enum(['one_time', 'recurring']),
  scheduled_at: z.string().optional(),
  interval_value: z.number().optional(),
  interval_unit: z.enum(['days', 'weeks', 'months']).optional(),
  send_time: z.string().optional(),
  is_active: z.number().optional(),
});

type CampaignFormValues = z.infer<typeof campaignSchema>;

interface CampaignFormProps {
  campaign?: Campaign | null;
  onClose: () => void;
  defaultType?: 'one_time' | 'recurring';
}

export default function CampaignForm({ campaign, onClose, defaultType = 'one_time' }: CampaignFormProps) {
  const { setPage } = useMain();
  const {
    createCampaignMutation,
    updateCampaignMutation,
    useEmailTemplates,
    useSegments,
  } = useCrm();

  const { data: templates, isLoading: templatesLoading } = useEmailTemplates();
  const { data: segments, isLoading: segmentsLoading } = useSegments();
  const [shouldResetForm, setShouldResetForm] = useState(false);
  const lastResetCampaignIdRef = useRef<number | null | -1>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingSubmitData, setPendingSubmitData] = useState<CampaignFormValues | null>(null);

  const form = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      name: '',
      template_id: 0,
      segment_id: 0,
      subject_override: '',
      body_override: '',
      type: defaultType,
      scheduled_at: '',
      interval_value: 1,
      interval_unit: 'days',
      send_time: '',
      is_active: 1,
    },
  });

  const campaignType = form.watch('type');

  // Determine when we should reset the form
  useEffect(() => {
    // For editing: wait for all data to be ready
    if (
      campaign &&
      templates !== undefined &&
      !templatesLoading &&
      segments !== undefined &&
      !segmentsLoading
    ) {
      if (campaign.id !== lastResetCampaignIdRef.current) {
        lastResetCampaignIdRef.current = campaign.id;
        setShouldResetForm(true);
      }
    }
    // For creating: wait for templates and segments
    else if (
      !campaign &&
      templates !== undefined &&
      !templatesLoading &&
      segments !== undefined &&
      !segmentsLoading
    ) {
      if (lastResetCampaignIdRef.current !== -1) {
        lastResetCampaignIdRef.current = -1;
        setShouldResetForm(true);
      }
    } else {
      setShouldResetForm(false);
    }
  }, [
    campaign,
    templates,
    templatesLoading,
    segments,
    segmentsLoading,
  ]);

  // Actually reset the form after render (ensures all fields are registered)
  useEffect(() => {
    if (!shouldResetForm) return;

    // Use requestAnimationFrame to ensure form fields are mounted
    const frameId = requestAnimationFrame(() => {
      setTimeout(() => {
        if (campaign) {
          // Editing mode
          form.reset(
            {
              name: campaign.name,
              template_id: campaign.template_id,
              segment_id: campaign.segment_id || 0,
              subject_override: campaign.subject_override || '',
              body_override: campaign.body_override || '',
              type: campaign.type || 'one_time',
              scheduled_at: utcToDatetimeLocal(campaign.scheduled_at) || '',
              interval_value: campaign.interval_value || 1,
              interval_unit: campaign.interval_unit || 'days',
              send_time: campaign.send_time || '',
              is_active: campaign.is_active ?? 1,
            },
            {
              keepDefaultValues: false,
            }
          );
        } else {
          // Creating mode
          form.reset(
            {
              name: '',
              template_id: 0,
              segment_id: 0,
              subject_override: '',
              body_override: '',
              type: defaultType,
              scheduled_at: '',
              interval_value: 1,
              interval_unit: 'days',
              send_time: '',
              is_active: 1,
            },
            {
              keepDefaultValues: false,
            }
          );
        }
        setShouldResetForm(false);
      }, 0);
    });

    return () => cancelAnimationFrame(frameId);
  }, [shouldResetForm, campaign, form, defaultType]);

  const onSubmit = (data: CampaignFormValues) => {
    // For one-time campaigns without schedule, show confirmation
    if (data.type === 'one_time') {
      const hasNoSchedule = !data.scheduled_at || data.scheduled_at.trim() === '';
      const isRemovingSchedule = campaign && campaign.scheduled_at && hasNoSchedule;

      if (hasNoSchedule || isRemovingSchedule) {
        setPendingSubmitData(data);
        setShowConfirmDialog(true);
        return;
      }
    }

    // Otherwise submit directly
    submitCampaign(data);
  };

  const submitCampaign = (data: CampaignFormValues) => {
    // Convert scheduled_at from browser local timezone to WordPress site timezone (UTC)
    // datetime-local input gives datetime in browser's local timezone (e.g., Asia/Dhaka UTC+6)
    // WordPress expects datetime in site timezone (UTC in this case)
    let processedData = { ...data };
    if (data.scheduled_at && data.scheduled_at.trim() !== '') {
      // Parse the datetime-local value as local time
      // e.g., "2026-01-17T18:51" is 18:51 in browser timezone (Asia/Dhaka UTC+6)
      const localDate = new Date(data.scheduled_at);

      // Convert to UTC (WordPress site timezone)
      // localDate is already in browser local time, getUTCFullYear etc. give UTC equivalents
      const year = localDate.getUTCFullYear();
      const month = String(localDate.getUTCMonth() + 1).padStart(2, '0');
      const day = String(localDate.getUTCDate()).padStart(2, '0');
      const hours = String(localDate.getUTCHours()).padStart(2, '0');
      const minutes = String(localDate.getUTCMinutes()).padStart(2, '0');
      const seconds = String(localDate.getUTCSeconds()).padStart(2, '0');

      // Format as YYYY-MM-DDTHH:mm:ss in UTC (WordPress site timezone)
      processedData.scheduled_at = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
    }

    if (campaign) {
      updateCampaignMutation.mutate(
        {
          campaignId: campaign.id,
          data: processedData,
        },
        {
          onSuccess: () => {
            onClose();
          },
        }
      );
    } else {
      createCampaignMutation.mutate(processedData, {
        onSuccess: () => {
          onClose();
        },
      });
    }
  };

  const handleConfirmSend = () => {
    if (pendingSubmitData) {
      submitCampaign(pendingSubmitData);
      setShowConfirmDialog(false);
      setPendingSubmitData(null);
    }
  };

  const handleCancelSend = () => {
    setShowConfirmDialog(false);
    setPendingSubmitData(null);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem className="space-y-3">
              <FormLabel>Campaign Type</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  value={field.value}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="one_time" id="one_time" />
                    <Label htmlFor="one_time" className="font-normal cursor-pointer">
                      One-Time Campaign
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="recurring" id="recurring" />
                    <Label htmlFor="recurring" className="font-normal cursor-pointer">
                      Recurring Campaign
                    </Label>
                  </div>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Campaign Name</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder={
                    campaignType === 'recurring'
                      ? 'e.g., Weekly Newsletter'
                      : 'e.g., Summer Sale Campaign'
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="template_id"
          render={({ field }) => (
            <FormItem>
              <div className="flex justify-between items-center">
                <FormLabel>Email Template</FormLabel>
                <Button
                  type="button"
                  variant="link"
                  size="xs"
                  onClick={() => {
                    setPage('crm-emails');
                    onClose();
                  }}
                >
                  <Plus className="w-4 h-4" />
                  Create Template
                </Button>
              </div>
              <FormControl>
                <Select
                  value={field.value && field.value > 0 ? field.value.toString() : undefined}
                  onValueChange={(value) => field.onChange(parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates?.map((template) => (
                      <SelectItem
                        key={template.id}
                        value={template.id.toString()}
                      >
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="segment_id"
          render={({ field }) => (
            <FormItem>
              <div className="flex justify-between items-center">
                <FormLabel>Segment</FormLabel>
                <Button
                  type="button"
                  variant="link"
                  size="xs"
                  onClick={() => {
                    setPage('crm-segments');
                    onClose();
                  }}
                >
                  <Plus className="w-4 h-4" />
                  Create Segment
                </Button>
              </div>
              <FormControl>
                <Select
                  value={field.value && field.value > 0 ? field.value.toString() : undefined}
                  onValueChange={(value) => field.onChange(parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select segment" />
                  </SelectTrigger>
                  <SelectContent>
                    {segments?.map((segment) => (
                      <SelectItem
                        key={segment.id}
                        value={segment.id.toString()}
                      >
                        {segment.name} ({segment.contact_count} contacts)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {campaignType === 'one_time' && (
          <FormField
            control={form.control}
            name="scheduled_at"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Schedule (Optional)</FormLabel>
                <FormControl>
                  <Input
                    type="datetime-local"
                    {...field}
                    value={field.value || ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {campaignType === 'recurring' && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="interval_value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Interval Value</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="interval_unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Interval Unit</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="days">Days</SelectItem>
                          <SelectItem value="weeks">Weeks</SelectItem>
                          <SelectItem value="months">Months</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="send_time"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Send Time (Optional)</FormLabel>
                  <FormControl>
                    <Input type="time" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex flex-row justify-between items-center p-3 rounded-lg border">
                  <div className="space-y-0.5">
                    <FormLabel>Active</FormLabel>
                    <div className="text-sm text-muted-foreground">
                      Enable or disable this recurring campaign
                    </div>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value === 1}
                      onCheckedChange={(checked) => field.onChange(checked ? 1 : 0)}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </>
        )}

        <div className="flex gap-2 justify-end pt-4 border-t">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={
              createCampaignMutation.isPending ||
              updateCampaignMutation.isPending
            }
          >
            {campaign ? 'Update' : 'Create'} Campaign
          </Button>
        </div>
      </form>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Campaign Immediately?</DialogTitle>
            <DialogDescription>
              No schedule date has been set. This campaign will be sent immediately to all contacts in the selected segment. Are you sure you want to proceed?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelSend}>
              Cancel
            </Button>
            <Button onClick={handleConfirmSend}>
              Yes, Send Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Form>
  );
}
