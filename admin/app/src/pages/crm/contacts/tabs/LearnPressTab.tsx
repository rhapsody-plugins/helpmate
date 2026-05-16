import Loading from '@/components/Loading';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCrm } from '@/hooks/useCrm';
import { __, sprintf } from '@/lib/utils';
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
        {__('No LearnPress data available for this contact.')}
      </p>
    );
  }

  if (!data.active) {
    return (
      <p className="text-sm text-muted-foreground">
        {__('LearnPress integration is not active on this site.')}
      </p>
    );
  }

  const live = data.live;
  const snapshot = data.snapshot;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="!text-lg !my-0">
            {__('LearnPress Progress (Live)')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {__(
              'This tab reads live LearnPress data. You do not need to run sync to see latest course progress here.'
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">
              {sprintf(
                /* translators: %d: Enrolled course count */
                __('Enrolled courses: %d'),
                live.counts.enrolled_courses
              )}
            </Badge>
            <Badge variant="outline">
              {sprintf(
                /* translators: %d: Completed course count */
                __('Completed courses: %d'),
                live.counts.completed_courses
              )}
            </Badge>
            <Badge variant="outline">
              {sprintf(
                /* translators: %d: In-progress course count */
                __('In progress courses: %d'),
                live.counts.in_progress_courses
              )}
            </Badge>
            <Badge variant="outline">
              {sprintf(
                /* translators: %d: Completed lesson count */
                __('Completed lessons: %d'),
                live.counts.completed_lessons
              )}
            </Badge>
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
            <p className="text-sm text-muted-foreground">
              {__('No enrolled courses found.')}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="!text-lg !my-0">
            {__('CRM Segment Snapshot')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {sprintf(
              /* translators: %s: Last sync datetime */
              __('Last synced: %s'),
              data.last_synced_at || __('Never')
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">
              {sprintf(
                /* translators: %d: Snapshot enrolled course count */
                __('Snapshot enrolled: %d'),
                snapshot.counts.enrolled_courses
              )}
            </Badge>
            <Badge variant="secondary">
              {sprintf(
                /* translators: %d: Snapshot completed course count */
                __('Snapshot completed courses: %d'),
                snapshot.counts.completed_courses
              )}
            </Badge>
            <Badge variant="secondary">
              {sprintf(
                /* translators: %d: Snapshot completed lesson count */
                __('Snapshot completed lessons: %d'),
                snapshot.counts.completed_lessons
              )}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
