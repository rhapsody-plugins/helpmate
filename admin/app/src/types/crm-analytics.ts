export type DateFilter =
  | 'today'
  | 'yesterday'
  | 'last_week'
  | 'last_month'
  | 'last_year';

export interface ComparisonData {
  created_change?: number;
  completed_change?: number;
  updated_change?: number;
  converted_change?: number;
  resolved_change?: number;
  sent_change?: number;
  conversion_rate_change?: number;
  completion_rate_change?: number;
  resolution_time_change?: number;
}

export interface TasksAnalytics {
  created: number;
  completed: number;
  overdue: number;
  completion_rate: number;
  comparison: {
    created_change: number;
    completed_change: number;
    completion_rate_change: number;
  };
}

export interface ContactsAnalytics {
  created: number;
  updated: number;
  total: number;
  emails_sent?: number;
  comparison: {
    created_change: number;
    updated_change: number;
  };
}

export interface LeadsAnalytics {
  created: number;
  converted: number;
  conversion_rate: number;
  by_source?: Record<string, number>;
  comparison: {
    created_change: number;
    converted_change: number;
    conversion_rate_change: number;
  };
}

export interface TicketsAnalytics {
  created: number;
  resolved: number;
  open: number;
  avg_resolution_time: number;
  by_source?: Record<string, number>;
  crm_linked?: number;
  crm_link_rate?: number;
  comparison: {
    created_change: number;
    resolved_change: number;
    resolution_time_change: number;
  };
}

export interface EmailsAnalytics {
  sent: number;
  comparison: {
    sent_change: number;
  };
}

export interface TeamMemberPerformance {
  user_id: number;
  display_name: string;
  email: string;
  tasks_created: number;
  tasks_completed: number;
  tickets_resolved: number;
  contacts_created: number;
}

export interface ActivityItem {
  type: 'task_created' | 'ticket_created' | 'contact_created' | 'lead_created';
  id: string | number;
  title: string;
  timestamp: number;
  user: string;
}

export interface CrmAnalyticsData {
  tasks: TasksAnalytics;
  contacts: ContactsAnalytics;
  leads: LeadsAnalytics;
  tickets: TicketsAnalytics;
  emails: EmailsAnalytics;
  activity_timeline: ActivityItem[];
  team_performance?: TeamMemberPerformance[];
}

export type ReportType =
  | 'tasks'
  | 'contacts'
  | 'leads'
  | 'tickets'
  | 'emails'
  | 'team_performance'
  | 'activity_timeline';

export interface AnalyticsPreferences {
  visible_reports: ReportType[];
}

export const DEFAULT_VISIBLE_REPORTS: ReportType[] = [
  'tasks',
  'contacts',
  'leads',
  'tickets',
  'emails',
  'team_performance',
  'activity_timeline',
];

