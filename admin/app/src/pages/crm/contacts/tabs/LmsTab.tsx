import Loading from '@/components/Loading';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCrm } from '@/hooks/useCrm';
import { ExternalLink } from 'lucide-react';

interface LmsTabProps {
  contactId: number | null;
}

function LmsProviderSection({
  title,
  data,
  inactiveMessage,
}: {
  title: string;
  data: any;
  inactiveMessage: string;
}) {
  const siteOrigin = window.location.origin;

  if (!data?.active) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="!text-lg !my-0">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{inactiveMessage}</p>
        </CardContent>
      </Card>
    );
  }

  const live = data.live;
  const snapshot = data.snapshot;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="!text-lg !my-0">{title} Progress (Live)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Enrolled courses: {live.counts.enrolled_courses}</Badge>
            <Badge variant="outline">Completed courses: {live.counts.completed_courses}</Badge>
            <Badge variant="outline">In progress courses: {live.counts.in_progress_courses}</Badge>
            <Badge variant="outline">Completed lessons: {live.counts.completed_lessons}</Badge>
          </div>
          {live.enrolled_courses.length > 0 ? (
            <ul className="text-sm list-disc pl-5 space-y-1">
              {live.enrolled_courses.map((course: { id: number; title: string }) => (
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
          <CardTitle className="!text-lg !my-0">{title} CRM Segment Snapshot</CardTitle>
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
    </>
  );
}

export function LmsTab({ contactId }: LmsTabProps) {
  const { useContactLearnPress, useContactTutor } = useCrm();
  const { data: learnPressData, isLoading: isLearnPressLoading } = useContactLearnPress(
    contactId,
    contactId !== null
  );
  const { data: tutorData, isLoading: isTutorLoading } = useContactTutor(contactId, contactId !== null);

  if (isLearnPressLoading || isTutorLoading) {
    return <Loading />;
  }

  if (!learnPressData && !tutorData) {
    return (
      <p className="text-sm text-muted-foreground">
        No LMS data available for this contact.
      </p>
    );
  }

  const learnPressActive = learnPressData?.active === true;
  const tutorActive = tutorData?.active === true;

  if (!learnPressActive && !tutorActive) {
    return (
      <p className="text-sm text-muted-foreground">
        No active LMS integration found on this site. Activate LearnPress or Tutor LMS to view
        live progress here.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <LmsProviderSection
        title="LearnPress"
        data={learnPressData}
        inactiveMessage="LearnPress is not active on this site."
      />
      <LmsProviderSection
        title="Tutor LMS"
        data={tutorData}
        inactiveMessage="Tutor LMS is not active on this site."
      />
    </div>
  );
}

