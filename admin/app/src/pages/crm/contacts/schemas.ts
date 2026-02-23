import { z } from 'zod';

export const PREFIX_OPTIONS = ['none', 'Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Prof.'];

export const contactFormSchema = z.object({
  prefix: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  email: z.union([
    z.string().email('Invalid email address'),
    z.literal(''),
  ]).optional(),
  phone: z.string().optional(),
  date_of_birth: z.string().optional(),
  address_line_1: z.string().optional(),
  address_line_2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip_code: z.string().optional(),
  country: z.string().optional(),
  wp_user_id: z.number().optional().nullable(),
  status: z.string().min(1, 'Status is required'),
  custom_fields: z.record(z.string(), z.any()).optional(),
});

export type ContactFormData = z.infer<typeof contactFormSchema>;

export const sendEmailSchema = z.object({
  template_id: z.number().optional().nullable(),
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Email body is required'),
});

export type SendEmailFormData = z.infer<typeof sendEmailSchema>;

export const manualOrderFormSchema = z.object({
  product_name: z.string().min(1, 'Product name is required'),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
  price: z.number().min(0, 'Price must be 0 or greater'),
  order_date: z.string().min(1, 'Order date is required'),
  status: z.enum([
    'pending',
    'processing',
    'completed',
    'cancelled',
    'refunded',
  ]),
  notes: z.string().optional(),
});

export type ManualOrderFormData = z.infer<typeof manualOrderFormSchema>;

