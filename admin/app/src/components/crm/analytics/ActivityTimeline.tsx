import { Card } from '@/components/ui/card';
import { ActivityItem } from '@/types/crm-analytics';
import {
  CheckCircle2,
  MessageSquare,
  UserPlus,
  TrendingUp,
  Clock,
} from 'lucide-react';

interface ActivityTimelineProps {
  data: ActivityItem[];
}

const getActivityIcon = (type: ActivityItem['type']) => {
  switch (type) {
    case 'task_created':
      return <CheckCircle2 size={16} className="text-blue-500" />;
    case 'ticket_created':
      return <MessageSquare size={16} className="text-purple-500" />;
    case 'contact_created':
      return <UserPlus size={16} className="text-green-500" />;
    case 'lead_created':
      return <TrendingUp size={16} className="text-orange-500" />;
    default:
      return <Clock size={16} className="text-gray-500" />;
  }
};

const getActivityLabel = (type: ActivityItem['type']) => {
  switch (type) {
    case 'task_created':
      return 'Task created';
    case 'ticket_created':
      return 'Ticket created';
    case 'contact_created':
      return 'Contact created';
    case 'lead_created':
      return 'Lead created';
    default:
      return 'Activity';
  }
};

const formatTimestamp = (timestamp: number) => {
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

export default function ActivityTimeline({ data }: ActivityTimelineProps) {
  if (!data || data.length === 0) {
    return (
      <Card className="p-0 h-full">
        <div className="p-6 h-full flex flex-col justify-center items-center text-muted-foreground">
          <Clock className="mb-2 w-8 h-8" />
          <p className="text-sm">No activity data available</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-0 h-full">
      <div className="p-6 h-full flex flex-col">
        <h5 className="!text-sm !font-normal !my-0 !py-0 !mb-4">
          Recent Activity
        </h5>
        <div className="flex-1 overflow-auto">
          <div className="flex flex-col gap-3">
            {data.map((activity, index) => (
              <div key={`${activity.type}-${activity.id}-${index}`} className="flex gap-3">
                <div className="flex-shrink-0 mt-1">
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex gap-2 items-center">
                    <span className="text-sm font-medium truncate">
                      {activity.title}
                    </span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatTimestamp(activity.timestamp)}
                    </span>
                  </div>
                  <div className="flex gap-2 items-center mt-1">
                    <span className="text-xs text-muted-foreground">
                      {getActivityLabel(activity.type)}
                    </span>
                    <span className="text-xs text-muted-foreground">•</span>
                    <span className="text-xs text-muted-foreground">
                      {activity.user}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

