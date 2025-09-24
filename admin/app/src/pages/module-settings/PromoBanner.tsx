import PageHeader from '@/components/PageHeader';
import { ReusableTable } from '@/components/ReusableTable';
import RichTextEditor from '@/components/RichTextEditor';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { Input } from '@/components/ui/input';
import MultipleSelector, { Option } from '@/components/ui/multiselect';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { usePromoBanner } from '@/hooks/usePromoBanner';
import { useSettings } from '@/hooks/useSettings';
import { cn } from '@/lib/utils';
import type { PromoBanner, PromoBannerStatus } from '@/types';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnDef } from '@tanstack/react-table';
import {
  Edit,
  Plus,
  Trash,
  RotateCcw,
  ShoppingCart,
  ArrowRight,
  ExternalLink,
  Star,
  Heart,
  Gift,
  Tag,
  Zap,
  CheckCircle,
  Play,
  Download,
  Mail,
  Phone,
  MapPin,
  Clock,
  Calendar,
  ShoppingBag,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

// Import template images
import template1 from '@/assets/templates/promo-template-1.webp';
import template2 from '@/assets/templates/promo-template-2.webp';
import template3 from '@/assets/templates/promo-template-3.webp';
import { HelpmatePricingURL } from '@/lib/constants';

// Icon options for button
const ICON_OPTIONS = [
  { value: 'none', label: 'No Icon' },
  { value: 'shopping-cart', label: 'Shopping Cart', icon: ShoppingCart },
  { value: 'arrow-right', label: 'Arrow Right', icon: ArrowRight },
  { value: 'external-link', label: 'External Link', icon: ExternalLink },
  { value: 'star', label: 'Star', icon: Star },
  { value: 'heart', label: 'Heart', icon: Heart },
  { value: 'gift', label: 'Gift', icon: Gift },
  { value: 'tag', label: 'Tag', icon: Tag },
  { value: 'zap', label: 'Zap', icon: Zap },
  { value: 'check-circle', label: 'Check Circle', icon: CheckCircle },
  { value: 'play', label: 'Play', icon: Play },
  { value: 'download', label: 'Download', icon: Download },
  { value: 'mail', label: 'Mail', icon: Mail },
  { value: 'phone', label: 'Phone', icon: Phone },
  { value: 'map-pin', label: 'Map Pin', icon: MapPin },
  { value: 'clock', label: 'Clock', icon: Clock },
  { value: 'calendar', label: 'Calendar', icon: Calendar },
  { value: 'shopping-bag', label: 'Shopping Bag', icon: ShoppingBag },
];

const formSchema = z
  .object({
    status: z.string().optional(),
    title: z.string().min(1, { message: 'Title is required' }),
    shortcode: z.string().optional(),

    // Design
    layout: z.string().min(1, { message: 'Layout is required' }),
    background_color: z
      .string()
      .min(1, { message: 'Background color is required' }),
    text_color: z.string().min(1, { message: 'Text color is required' }),
    button_background_color: z
      .string()
      .min(1, { message: 'Button background color is required' }),
    button_text_color: z
      .string()
      .min(1, { message: 'Button text color is required' }),
    button_icon: z.string().optional(),
    button_icon_position: z.string().optional(),
    countdown_background_color: z
      .string()
      .min(1, { message: 'Countdown background color is required' }),
    countdown_text_color: z
      .string()
      .min(1, { message: 'Countdown text color is required' }),
    close_button_color: z
      .string()
      .min(1, { message: 'Close button color is required' }),
    close_button_position: z
      .string()
      .min(1, { message: 'Close button position is required' }),
    text_font_size: z
      .string()
      .min(1, { message: 'Text font size is required' }),
    button_text_font_size: z
      .string()
      .min(1, { message: 'Button text font size is required' }),
    countdown_text_font_size: z
      .string()
      .min(1, { message: 'Countdown text font size is required' }),

    // Content
    text: z.string().min(1, { message: 'Text is required' }),
    button_text: z.string().min(1, { message: 'Button text is required' }),
    button_url: z.string().min(1, { message: 'Button URL is required' }),
    open_in_new_tab: z.boolean(),
    countdown_enabled: z.boolean(),
    start_datetime: z.string().optional(),
    end_datetime: z.string().optional(),
    permanent_close: z.boolean(),

    // Display
    show_on: z.string().min(1, { message: 'Show on is required' }),
    selected_pages: z.array(z.number()).optional(),
    display_for: z.string().min(1, { message: 'Display for is required' }),

    // Customize
    position: z.string().min(1, { message: 'Position is required' }),
    sticky_bar: z.boolean(),
    display_close_button: z.boolean(),
    mobile_visibility: z.boolean(),
    initial_delay: z.string(),
    autohide: z.boolean(),
    hide_after: z.string(),
  })
  .refine(
    (data) => {
      if (data.show_on === 'selected' || data.show_on === 'hide_selected') {
        return data.selected_pages && data.selected_pages.length > 0;
      }
      return true;
    },
    {
      message: 'Please select at least one page',
      path: ['selected_pages'],
    }
  );

type FormData = z.infer<typeof formSchema>;

const DEFAULT_FORM_VALUES: FormData = {
  status: 'active',
  title: 'Summer Sale',
  shortcode: '',

  // Design
  layout: '1',
  background_color: '#2E3192',
  text_color: '#FFFFFF',
  button_background_color: '#3E40ED',
  button_text_color: '#ffffff',
  button_icon: 'shopping-bag',
  button_icon_position: 'right',
  countdown_background_color: '#DEE8FF',
  countdown_text_color: '#2E3192',
  close_button_color: '#9CB8FF',
  close_button_position: 'right',
  text_font_size: '16px',
  button_text_font_size: '14px',
  countdown_text_font_size: '14px',

  // Content
  text: 'Clean and modern design with light countdown boxes',
  button_text: 'Shop Now',
  button_url: '#',
  open_in_new_tab: false,
  countdown_enabled: true,
  start_datetime: new Date().toISOString().slice(0, 16),
  end_datetime: new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 16),
  permanent_close: false,

  // Display
  show_on: 'everywhere',
  selected_pages: [],
  display_for: 'everyone',

  // Customize
  position: 'top',
  sticky_bar: true,
  display_close_button: true,
  mobile_visibility: true,
  initial_delay: '0',
  autohide: false,
  hide_after: '10',
};

interface WordPressPage {
  id: number;
  title: string;
}

interface WordPressPageResponse {
  id: number;
  title: {
    rendered: string;
  };
}

export default function PromoBanner() {
  const { getProQuery } = useSettings();
  const {
    getPromoBanners,
    refetchPromoBanners,
    createPromoBanner,
    updatePromoBanner,
    deletePromoBanner,
    getTemplates,
  } = usePromoBanner();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedBanner, setSelectedBanner] = useState<PromoBanner | null>(
    null
  );
  const [searchFilter, setSearchFilter] = useState('');
  const [page, setPage] = useState(1);
  const [perPage] = useState(10);
  const [pages, setPages] = useState<WordPressPage[]>([]);
  const [isLoadingPages, setIsLoadingPages] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState('1');

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: DEFAULT_FORM_VALUES,
  });

  const { data: promoBanners, isPending: isFetching } = getPromoBanners;

  const { mutate: createPromoBannerMutation, isPending: isCreating } =
    createPromoBanner;

  const { mutate: updatePromoBannerMutation, isPending: isUpdating } =
    updatePromoBanner;

  const { mutate: deletePromoBannerMutation, isPending: isDeleting } =
    deletePromoBanner;

  const { data: templates } = getTemplates;

  // Function to apply template styles and content
  const applyTemplate = (layout: string) => {
    setCurrentTemplate(layout);
    if (templates && templates[layout]) {
      const template = templates[layout];

      // Apply template default styles
      form.setValue('background_color', template.background_color);
      form.setValue('text_color', template.text_color);
      form.setValue(
        'button_background_color',
        template.button_background_color
      );
      form.setValue('button_text_color', template.button_text_color);
      form.setValue(
        'countdown_background_color',
        template.countdown_background_color
      );
      form.setValue('countdown_text_color', template.countdown_text_color);
      form.setValue('close_button_color', template.close_button_color);
      form.setValue('text_font_size', template.text_font_size);
      form.setValue('button_text_font_size', template.button_text_font_size);
      form.setValue(
        'countdown_text_font_size',
        template.countdown_text_font_size
      );
      form.setValue('position', template.position);
      form.setValue('sticky_bar', template.sticky_bar);
      form.setValue('display_close_button', template.display_close_button);
      form.setValue('mobile_visibility', template.mobile_visibility);
      form.setValue('countdown_enabled', template.countdown_enabled);

      // Apply template default text content
      if (template.title) {
        form.setValue('title', template.title);
      }
      if (template.text) {
        form.setValue('text', template.text);
      }
      if (template.button_text) {
        form.setValue('button_text', template.button_text);
      }
      if (template.button_url) {
        form.setValue('button_url', template.button_url);
      }
      if (template.button_icon) {
        form.setValue('button_icon', template.button_icon);
      }
      if (template.button_icon_position) {
        form.setValue('button_icon_position', template.button_icon_position);
      }

      // Set default datetime values
      const now = new Date();
      const oneMonthLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      form.setValue('start_datetime', now.toISOString().slice(0, 16));
      form.setValue('end_datetime', oneMonthLater.toISOString().slice(0, 16));
    }
  };

  // Template reset function
  const handleTemplateReset = (layout: string) => {
    applyTemplate(layout);
  };

  const handleCopyShortcode = (shortcode: string) => {
    navigator.clipboard.writeText(`[helpmate_promo id="${shortcode}"]`);
    toast.success('Shortcode copied to clipboard');
  };

  const columns: ColumnDef<PromoBanner>[] = [
    {
      accessorKey: 'title',
      header: 'Title',
    },
    {
      accessorKey: 'id',
      header: 'Shortcode',
      cell: ({ row }) => {
        const id = row.getValue('id') as string;
        return (
          <code
            onClick={() => handleCopyShortcode(id)}
            className="cursor-pointer"
          >
            [helpmate_promo id="{id}"]
          </code>
        );
      },
    },
    {
      accessorKey: 'start_datetime',
      header: 'Start Date',
      cell: ({ row }) => {
        const start_datetime = row.getValue('start_datetime') as number;
        return <span>{new Date(Number(start_datetime)).toLocaleString()}</span>;
      },
    },
    {
      accessorKey: 'end_datetime',
      header: 'End Date',
      cell: ({ row }) => {
        const end_datetime = row.getValue('end_datetime') as number;
        return <span>{new Date(Number(end_datetime)).toLocaleString()}</span>;
      },
    },
    {
      accessorKey: 'created_at',
      header: 'Created At',
      cell: ({ row }) => {
        const created_at = row.getValue('created_at') as number;
        return <span>{new Date(created_at * 1000).toLocaleString()}</span>;
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.getValue('status') as string;
        return (
          <span
            className={cn(
              'px-2 py-1 rounded-full text-xs font-medium',
              status === 'active' && 'bg-green-100 text-green-800',
              status === 'inactive' && 'bg-gray-100 text-gray-800',
              status === 'expired' && 'bg-red-100 text-red-800'
            )}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
        );
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const banner = row.original;
        return (
          <div className="flex gap-2 items-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleEdit(banner)}
            >
              <Edit className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDelete(banner)}
            >
              <Trash className="w-4 h-4" />
            </Button>
          </div>
        );
      },
    },
  ];

  useEffect(() => {
    refetchPromoBanners({ page, per_page: perPage });
  }, [refetchPromoBanners, page, perPage]);

  useEffect(() => {
    const fetchPages = async () => {
      setIsLoadingPages(true);
      try {
        const response = await fetch('/wp-json/wp/v2/pages?per_page=100');
        const data = (await response.json()) as WordPressPageResponse[];
        setPages(
          data.map((page) => ({
            id: page.id,
            title: page.title.rendered,
          }))
        );
      } catch (error) {
        console.error('Error fetching pages:', error);
      } finally {
        setIsLoadingPages(false);
      }
    };

    fetchPages();
  }, []);

  const handleSubmit = async (data: FormData) => {
    try {
      if (selectedBanner) {
        const { title, status, start_datetime, end_datetime, ...filteredData } =
          data;
        await updatePromoBannerMutation({
          id: selectedBanner.id,
          title: title,
          status: status as PromoBannerStatus,
          metadata: {
            ...filteredData,
          },
          start_datetime: start_datetime ? Date.parse(start_datetime) : 0,
          end_datetime: end_datetime ? Date.parse(end_datetime) : 0,
        });
      } else {
        const { title, status, start_datetime, end_datetime, ...filteredData } =
          data;
        await createPromoBannerMutation({
          title: title,
          status: status as PromoBannerStatus,
          metadata: {
            ...filteredData,
          },
          start_datetime: start_datetime ? Date.parse(start_datetime) : 0,
          end_datetime: end_datetime ? Date.parse(end_datetime) : 0,
        });
      }

      // Refresh the data after successful save
      refetchPromoBanners({ page, per_page: perPage });
      setIsSheetOpen(false);
    } catch (error) {
      console.error('Error saving promo banner:', error);
      toast.error('Failed to save promo banner');
    }
  };

  const handleEdit = (banner: PromoBanner) => {
    setSelectedBanner(banner);
    const { title, status, metadata, start_datetime, end_datetime, shortcode } =
      banner;

    const formatDateTime = (timestamp: number) => {
      if (!timestamp || timestamp <= 0) return '';
      const date = new Date(Number(timestamp));
      // Validate the date is reasonable
      if (isNaN(date.getTime()) || date.getFullYear() > 2100) return '';

      // Convert to local time for datetime-local input
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');

      return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    form.reset({
      title: title,
      status: status,
      shortcode: shortcode,
      ...metadata,
      start_datetime: formatDateTime(Number(start_datetime)),
      end_datetime: formatDateTime(Number(end_datetime)),
    });
    setIsSheetOpen(true);
  };

  const handleDelete = async (banner: PromoBanner) => {
    deletePromoBannerMutation({ id: banner.id });
    refetchPromoBanners({ page, per_page: perPage });
  };

  const handleCreate = () => {
    setSelectedBanner(null);
    form.reset(DEFAULT_FORM_VALUES);
    setIsSheetOpen(true);
  };

  return (
    <div className="gap-0">
      <PageHeader title="Promo Bar" />
      <div className="relative p-6">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="flex gap-1 items-center text-xl font-bold">
                  Promo Bar{' '}
                  <InfoTooltip message="The promo bar allows you to display ongoing deals, free shipping offers, or announcements at the top or bottom of your site. You can drive more clicks and sales by highlighting limited-time offers or coupons." />
                </CardTitle>
              </div>
              <div className="flex gap-4 items-center">
                <Input
                  placeholder="Search promo bars..."
                  value={searchFilter}
                  onChange={(event) => setSearchFilter(event.target.value)}
                  className="max-w-sm"
                />
                <Button onClick={handleCreate}>
                  <Plus className="mr-2 w-4 h-4" />
                  Create New
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ReusableTable
              columns={columns}
              data={(promoBanners?.items as PromoBanner[]) || []}
              showPagination={true}
              pageSize={perPage}
              rightAlignedColumns={['actions']}
              loading={isFetching || isCreating || isUpdating || isDeleting}
              serverSidePagination={true}
              totalCount={promoBanners?.pagination?.total || 0}
              onPageChange={setPage}
              currentPage={page}
              globalFilter={searchFilter}
              onGlobalFilterChange={setSearchFilter}
            />
          </CardContent>
        </Card>
      </div>

      <Sheet
        open={isSheetOpen}
        onOpenChange={(open) => {
          setIsSheetOpen(open);
          if (!open) {
            form.reset(DEFAULT_FORM_VALUES);
            setSelectedBanner(null);
          }
        }}
      >
        <SheetContent className="w-[800px] sm:max-w-[800px] overflow-y-auto gap-0">
          <SheetHeader>
            <SheetTitle className="!mt-6 !mb-0 !text-xl !font-bold">
              {selectedBanner ? 'Edit Promo Bar' : 'Create New Promo Bar'}
            </SheetTitle>
          </SheetHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="px-4 pb-4 space-y-6"
            >
              {/* General Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-bold">General</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Title</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <FormControl>
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select a status" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="inactive">
                                  Inactive
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Design Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-bold">Layout</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="layout"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Template</FormLabel>
                        <FormDescription className="text-sm text-muted-foreground">
                          Select a template to automatically apply its default
                          styles. You can customize any settings after
                          selection.
                        </FormDescription>
                        <FormControl>
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 gap-4">
                              <div
                                className={cn(
                                  'relative cursor-pointer rounded-lg border-2 transition-all hover:border-primary',
                                  field.value === '1'
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-gray-200'
                                )}
                                onClick={() => {
                                  field.onChange('1');
                                  applyTemplate('1');
                                }}
                              >
                                <img
                                  src={template1}
                                  alt="Layout 1"
                                  className="w-full h-auto rounded-md"
                                />
                                <div className="flex absolute inset-0 justify-center items-center rounded-md opacity-0 transition-opacity bg-white/70 hover:opacity-100">
                                  <span className="text-lg font-semibold drop-shadow-lg">
                                    Layout 1
                                  </span>
                                </div>
                              </div>

                              <div
                                className={cn(
                                  'relative cursor-pointer rounded-lg border-2 transition-all',
                                  field.value === '2'
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-gray-200',
                                  !getProQuery.data
                                    ? 'opacity-50'
                                    : 'hover:border-primary'
                                )}
                                onClick={() => {
                                  if (getProQuery.data) {
                                    field.onChange('2');
                                    applyTemplate('2');
                                  } else {
                                    window.open(HelpmatePricingURL, '_blank');
                                  }
                                }}
                              >
                                <img
                                  src={template2}
                                  alt="Layout 2"
                                  className="w-full h-auto rounded-md"
                                />
                                <div className="flex absolute inset-0 justify-center items-center rounded-md opacity-0 transition-opacity bg-white/70 hover:opacity-100">
                                  <span className="text-lg font-semibold drop-shadow-lg">
                                    Layout 2 {!getProQuery.data && '(Pro Only)'}
                                  </span>
                                </div>
                                {!getProQuery.data && (
                                  <div className="absolute top-1 right-1 px-2 py-1 text-xs text-white bg-orange-500 rounded">
                                    Pro Only
                                  </div>
                                )}
                              </div>

                              <div
                                className={cn(
                                  'relative cursor-pointer rounded-lg border-2 transition-all',
                                  field.value === '3'
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-gray-200',
                                  !getProQuery.data
                                    ? 'opacity-50'
                                    : 'hover:border-primary'
                                )}
                                onClick={() => {
                                  if (getProQuery.data) {
                                    field.onChange('3');
                                    applyTemplate('3');
                                  } else {
                                    window.open(HelpmatePricingURL, '_blank');
                                  }
                                }}
                              >
                                <img
                                  src={template3}
                                  alt="Layout 3"
                                  className="w-full h-auto rounded-md"
                                />
                                <div className="flex absolute inset-0 justify-center items-center rounded-md opacity-0 transition-opacity bg-white/70 hover:opacity-100">
                                  <span className="text-lg font-semibold drop-shadow-lg">
                                    Layout 3 {!getProQuery.data && '(Pro Only)'}
                                  </span>
                                </div>
                                {!getProQuery.data && (
                                  <div className="absolute top-1 right-1 px-2 py-1 text-xs text-white bg-orange-500 rounded">
                                    Pro Only
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Template Reset Button */}
                            {field.value &&
                              templates &&
                              templates[field.value] && (
                                <div className="flex justify-center">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      handleTemplateReset(field.value)
                                    }
                                    className="flex gap-2 items-center"
                                  >
                                    <RotateCcw className="w-4 h-4" />
                                    Reset to {templates[field.value].name}{' '}
                                    Defaults
                                  </Button>
                                </div>
                              )}
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="background_color"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Background Color</FormLabel>
                          <FormControl>
                            <Input
                              type="color"
                              className="!border-input !rounded-md focus-visible:!border-ring focus-visible:!ring-ring/50 focus-visible:!ring-[3px]"
                              {...field}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="text_color"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Text Color</FormLabel>
                          <FormControl>
                            <Input
                              type="color"
                              className="!border-input !rounded-md focus-visible:!border-ring focus-visible:!ring-ring/50 focus-visible:!ring-[3px]"
                              {...field}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="button_background_color"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Button Background Color</FormLabel>
                          <FormControl>
                            <Input
                              type="color"
                              className="!border-input !rounded-md focus-visible:!border-ring focus-visible:!ring-ring/50 focus-visible:!ring-[3px]"
                              {...field}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="button_text_color"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Button Text Color</FormLabel>
                          <FormControl>
                            <Input
                              type="color"
                              className="!border-input !rounded-md focus-visible:!border-ring focus-visible:!ring-ring/50 focus-visible:!ring-[3px]"
                              {...field}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="countdown_background_color"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Countdown Background Color</FormLabel>
                          <FormControl>
                            <Input
                              type="color"
                              className="!border-input !rounded-md focus-visible:!border-ring focus-visible:!ring-ring/50 focus-visible:!ring-[3px]"
                              {...field}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="countdown_text_color"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Countdown Text Color</FormLabel>
                          <FormControl>
                            <Input
                              type="color"
                              className="!border-input !rounded-md focus-visible:!border-ring focus-visible:!ring-ring/50 focus-visible:!ring-[3px]"
                              {...field}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="close_button_color"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Close Button Color</FormLabel>
                          <FormControl>
                            <Input
                              type="color"
                              className="!border-input !rounded-md focus-visible:!border-ring focus-visible:!ring-ring/50 focus-visible:!ring-[3px]"
                              {...field}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="text_font_size"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Text Font Size</FormLabel>
                          <FormControl>
                            <div className="space-y-2">
                              <Slider
                                min={8}
                                max={32}
                                step={1}
                                value={[parseInt(field.value)]}
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
                      name="button_text_font_size"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Button Text Font Size</FormLabel>
                          <FormControl>
                            <div className="space-y-2">
                              <Slider
                                min={8}
                                max={32}
                                step={1}
                                value={[parseInt(field.value)]}
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
                      name="countdown_text_font_size"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Countdown Text Font Size</FormLabel>
                          <FormControl>
                            <div className="space-y-2">
                              <Slider
                                min={8}
                                max={32}
                                step={1}
                                value={[parseInt(field.value)]}
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
                  </div>
                </CardContent>
              </Card>

              {/* Content Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-bold">Content</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="text"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Text</FormLabel>
                        <FormControl>
                          <RichTextEditor
                            key={currentTemplate}
                            content={field.value}
                            onChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="button_text"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Button Text</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="button_url"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Button URL</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="button_icon"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Button Icon</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select an icon" />
                            </SelectTrigger>
                            <SelectContent>
                              {ICON_OPTIONS.map((option) => {
                                const IconComponent = option.icon;
                                return (
                                  <SelectItem
                                    key={option.value}
                                    value={option.value}
                                  >
                                    <div className="flex gap-2 items-center">
                                      {IconComponent && (
                                        <IconComponent className="w-4 h-4" />
                                      )}
                                      {option.label}
                                    </div>
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />

                    {form.watch('button_icon') &&
                      form.watch('button_icon') !== 'none' && (
                        <FormField
                          control={form.control}
                          name="button_icon_position"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Icon Position</FormLabel>
                              <Select
                                value={field.value}
                                onValueChange={field.onChange}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Select position" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="left">Left</SelectItem>
                                  <SelectItem value="right">Right</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )}
                        />
                      )}
                  </div>

                  <FormField
                    control={form.control}
                    name="open_in_new_tab"
                    render={({ field }) => (
                      <FormItem className="flex justify-between items-center p-2 rounded-md border border-input">
                        <FormLabel>Open Link in New Tab</FormLabel>
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
                    name="countdown_enabled"
                    render={({ field }) => (
                      <FormItem className="flex justify-between items-center p-2 rounded-md border border-input">
                        <FormLabel>Enable Countdown</FormLabel>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {form.watch('countdown_enabled') && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="start_datetime"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Start Date/Time</FormLabel>
                              <FormControl>
                                <Input
                                  type="datetime-local"
                                  className="!border-input !rounded-md focus-visible:!border-ring focus-visible:!ring-ring/50 focus-visible:!ring-[3px] block"
                                  {...field}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="end_datetime"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>End Date/Time</FormLabel>
                              <FormControl>
                                <Input
                                  type="datetime-local"
                                  className="!border-input !rounded-md focus-visible:!border-ring focus-visible:!ring-ring/50 focus-visible:!ring-[3px] block"
                                  {...field}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Display Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-bold">Display</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="show_on"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Show On</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select where to show" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="everywhere">
                              Show Everywhere
                            </SelectItem>
                            <SelectItem value="selected">
                              Show on Selected
                            </SelectItem>
                            <SelectItem value="hide_selected">
                              Hide on Selected
                            </SelectItem>
                            <SelectItem value="shortcode">
                              Use Only Shortcode
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />

                  {(form.watch('show_on') === 'selected' ||
                    form.watch('show_on') === 'hide_selected') && (
                    <FormField
                      control={form.control}
                      name="selected_pages"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Select Pages</FormLabel>
                          <FormControl>
                            {isLoadingPages ? (
                              <div>Loading pages...</div>
                            ) : (
                              <MultipleSelector
                                value={field.value?.map((id) => {
                                  const page = pages.find((p) => p.id === id);
                                  return {
                                    value: String(id),
                                    label: page?.title || `Page ${id}`,
                                  };
                                })}
                                onChange={(options: Option[]) => {
                                  field.onChange(
                                    options.map((opt) => Number(opt.value))
                                  );
                                }}
                                options={pages.map((page) => ({
                                  value: String(page.id),
                                  label: page.title,
                                }))}
                                placeholder="Select pages..."
                                emptyIndicator="No pages found"
                                loadingIndicator="Loading pages..."
                                onSearchSync={(value) => {
                                  return pages
                                    .filter((page) =>
                                      page.title
                                        .toLowerCase()
                                        .includes(value.toLowerCase())
                                    )
                                    .map((page) => ({
                                      value: String(page.id),
                                      label: page.title,
                                    }));
                                }}
                              />
                            )}
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  )}

                  {form.watch('show_on') === 'shortcode' && (
                    <FormField
                      control={form.control}
                      name="shortcode"
                      render={() => (
                        <FormItem>
                          <FormLabel>Shortcode</FormLabel>
                          <FormControl>
                            <div className="flex gap-2 items-center">
                              <Input
                                value={
                                  selectedBanner
                                    ? `[helpmate_promo id="${selectedBanner.id}"]`
                                    : 'Will be generated after saving'
                                }
                                readOnly
                                className="font-mono"
                              />
                              {selectedBanner && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => {
                                    navigator.clipboard.writeText(
                                      `[helpmate_promo id="${selectedBanner.id}"]`
                                    );
                                  }}
                                >
                                  Copy
                                </Button>
                              )}
                            </div>
                          </FormControl>
                          <FormDescription>
                            Use this shortcode to display the promo bar on any
                            page or post.
                          </FormDescription>
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={form.control}
                    name="display_for"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Display For</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select who to display for" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="everyone">Everyone</SelectItem>
                            <SelectItem value="loggedin">
                              Logged In Users
                            </SelectItem>
                            <SelectItem value="loggedout">
                              Logged Out Users
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Customize Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-bold">Customize</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="position"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Position</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select position" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="top">Top</SelectItem>
                              <SelectItem value="bottom">Bottom</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="close_button_position"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Close Button Position</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select position" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="left">Left</SelectItem>
                              <SelectItem value="right">Right</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="sticky_bar"
                      render={({ field }) => (
                        <FormItem className="flex justify-between items-center p-2 rounded-md border border-input">
                          <FormLabel>Sticky Bar</FormLabel>
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
                      name="display_close_button"
                      render={({ field }) => (
                        <FormItem className="flex justify-between items-center p-2 rounded-md border border-input">
                          <FormLabel>Display Close Button</FormLabel>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="permanent_close"
                      render={({ field }) => (
                        <FormItem className="flex justify-between items-center p-2 rounded-md border border-input">
                          <FormLabel>Permanent Close</FormLabel>
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
                      name="mobile_visibility"
                      render={({ field }) => (
                        <FormItem className="flex justify-between items-center p-2 rounded-md border border-input">
                          <FormLabel>Mobile Visibility</FormLabel>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="autohide"
                      render={({ field }) => (
                        <FormItem className="flex justify-between items-center p-2 rounded-md border border-input">
                          <FormLabel>Auto Hide</FormLabel>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="initial_delay"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Initial Delay (seconds)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              className="!border-input !rounded-md focus-visible:!border-ring focus-visible:!ring-ring/50 focus-visible:!ring-[3px]"
                              {...field}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    {form.watch('autohide') && (
                      <FormField
                        control={form.control}
                        name="hide_after"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Hide After (seconds)</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    )}
                  </div>
                </CardContent>
              </Card>

              <Button type="submit" disabled={isUpdating} loading={isUpdating}>
                {isUpdating ? 'Saving...' : 'Save'}
              </Button>
            </form>
          </Form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
