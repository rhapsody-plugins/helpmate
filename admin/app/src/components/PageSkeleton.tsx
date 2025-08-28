import { Skeleton } from '@/components/ui/skeleton';

export default function PageSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="w-full h-28 rounded-xl" />
      <Skeleton className="w-full rounded-xl h-42" />
      <Skeleton className="w-full rounded-xl h-62" />
    </div>
  );
}
