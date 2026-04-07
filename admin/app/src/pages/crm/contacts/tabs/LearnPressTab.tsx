import Loading from '@/components/Loading';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCrm } from '@/hooks/useCrm';
import { ExternalLink } from 'lucide-react';

interface LearnPressTabProps {
  contactId: number | null;
}

export function LearnPressTab({ contactId }: LearnPressTabProps) {
  const { useContactLearnPress } = useCrm();
  const { data, isLoading } = useContactLearnPress(contactId, contactId !== null);
  const siteOrigin = window.location.origin;

  if (isLoading) {
    return <Loading />;
  }

  if (!data) {
    return (
      <p className="text-sm text-muted-foreground">
        No LearnPress data available for this contact.
      </p>
    );
  }

  if (!data.active) {
    return (
      <p className="text-sm text-muted-foreground">
        LearnPress integration is not active on this site.
      </p>
    );
  }

  const live = data.live;
  const snapshot = data.snapshot;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="!text-lg !my-0">LearnPress Progress (Live)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            This tab reads live LearnPress data. You do not need to run sync to see latest course
            progress here.
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Enrolled courses: {live.counts.enrolled_courses}</Badge>
            <Badge variant="outline">Completed courses: {live.counts.completed_courses}</Badge>
            <Badge variant="outline">In progress courses: {live.counts.in_progress_courses}</Badge>
            <Badge variant="outline">Completed lessons: {live.counts.completed_lessons}</Badge>
          </div>
          {live.enrolled_courses.length > 0 ? (
            <ul className="text-sm list-disc pl-5 space-y-1">
              {live.enrolled_courses.map((course) => (
                <li key={course.id}>
                  <a
                    href={`${siteOrigin}/wp-admin/post.php?post=${course.id}&action=edit`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 underline underline-offset-4"
                  >
                    {course.title}
                    <ExternalLink className="w-3 h-3" />
                  </a>{' '}
                  <span className="text-muted-foreground">#{course.id}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No enrolled courses found.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="!text-lg !my-0">CRM Segment Snapshot</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Last synced: {data.last_synced_at || 'Never'}
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">
              Snapshot enrolled: {snapshot.counts.enrolled_courses}
            </Badge>
            <Badge variant="secondary">
              Snapshot completed courses: {snapshot.counts.completed_courses}
            </Badge>
            <Badge variant="secondary">
              Snapshot completed lessons: {snapshot.counts.completed_lessons}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

