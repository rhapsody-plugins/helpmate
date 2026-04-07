import Loading from '@/components/Loading';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useCrm } from '@/hooks/useCrm';
import { formatDistanceToNow } from 'date-fns';
import { CircleHelp, ExternalLink } from 'lucide-react';

interface LmsTabProps {
  contactId: number | null;
}

interface ProviderData {
  active: boolean;
  last_synced_at: string | null;
  live: {
    enrolled_courses: Array<{ id: number; title: string }>;
    counts: {
      enrolled_courses: number;
      completed_courses: number;
      in_progress_courses: number;
      completed_lessons: number;
    };
  };
  snapshot: {
    counts: {
      enrolled_courses: number;
      completed_courses: number;
      completed_lessons: number;
    };
  };
}

function formatLastSynced(lastSyncedAt: string | null): string {
  if (!lastSyncedAt) return 'Never';
  const normalized = lastSyncedAt.includes('T') ? lastSyncedAt : lastSyncedAt.replace(' ', 'T');
  const date = new Date(normalized.endsWith('Z') ? normalized : `${normalized}Z`);
  if (Number.isNaN(date.getTime())) {
    return lastSyncedAt;
  }
  return `${formatDistanceToNow(date, { addSuffix: true })} (${date.toLocaleString()})`;
}

function LmsProviderSection({
  title,
  data,
  inactiveMessage,
}: {
  title: string;
  data: ProviderData | undefined;
  inactiveMessage: string;
}) {
  const siteOrigin = window.location.origin;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="!text-lg !my-0">{title}</CardTitle>
          <Badge variant={data?.active ? 'default' : 'outline'}>
            {data?.active ? 'Active' : 'Inactive'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!data?.active ? (
          <p className="text-sm text-muted-foreground">{inactiveMessage}</p>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2 p-3 rounded-md border">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Live Progress
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">Enrolled: {data.live.counts.enrolled_courses}</Badge>
                  <Badge variant="outline">Completed: {data.live.counts.completed_courses}</Badge>
                  <Badge variant="outline">In progress: {data.live.counts.in_progress_courses}</Badge>
                  <Badge variant="outline">Lessons done: {data.live.counts.completed_lessons}</Badge>
                </div>
              </div>

              <div className="flex flex-col gap-2 p-3 rounded-md border">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Saved Segment Data
                  </p>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          aria-label="What is saved segment data?"
                        >
                          <CircleHelp className="w-3.5 h-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        This is the last synced LMS data used for segment rules and automated
                        campaigns. Live progress can change before the next sync.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <p className="text-xs text-muted-foreground">
                  Last synced: {formatLastSynced(data.last_synced_at)}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">Enrolled: {data.snapshot.counts.enrolled_courses}</Badge>
                  <Badge variant="secondary">Completed: {data.snapshot.counts.completed_courses}</Badge>
                  <Badge variant="secondary">Lessons done: {data.snapshot.counts.completed_lessons}</Badge>
                </div>
              </div>
            </div>

            {data.live.enrolled_courses.length > 0 ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">Enrolled Courses</p>
                <ul className="text-sm list-disc pl-5 space-y-1">
                  {data.live.enrolled_courses.map((course) => (
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
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No enrolled courses found.</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function LmsTab({ contactId }: LmsTabProps) {
  const { useContactLearnPress, useContactTutor, useContactLifterLms } = useCrm();
  const { data: learnPressData, isLoading: isLearnPressLoading } = useContactLearnPress(
    contactId,
    contactId !== null
  );
  const { data: tutorData, isLoading: isTutorLoading } = useContactTutor(contactId, contactId !== null);
  const { data: lifterData, isLoading: isLifterLoading } = useContactLifterLms(
    contactId,
    contactId !== null
  );

  if (isLearnPressLoading || isTutorLoading || isLifterLoading) {
    return <Loading />;
  }

  if (!learnPressData && !tutorData && !lifterData) {
    return (
      <p className="text-sm text-muted-foreground">
        No LMS data available for this contact.
      </p>
    );
  }

  const learnPressActive = learnPressData?.active === true;
  const tutorActive = tutorData?.active === true;
  const lifterActive = lifterData?.active === true;

  if (!learnPressActive && !tutorActive && !lifterActive) {
    return (
      <p className="text-sm text-muted-foreground">
        No active LMS integration found on this site. Activate LearnPress, Tutor LMS, or
        LifterLMS to view live progress here.
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
      <LmsProviderSection
        title="LifterLMS"
        data={lifterData}
        inactiveMessage="LifterLMS is not active on this site."
      />
    </div>
  );
}

