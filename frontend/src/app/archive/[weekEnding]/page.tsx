import { Suspense } from 'react';

import { ArchiveReportDetailSection } from '@/components/archive/ArchiveReportDetailSection';
import { Skeleton } from '@/components/ui/skeleton';

export default async function ArchiveReportDetailPage({
  params,
}: {
  params: Promise<{ weekEnding: string }>;
}) {
  const { weekEnding } = await params;

  return (
    <Suspense fallback={<ArchiveReportDetailSkeleton />}>
      <ArchiveReportDetailSection weekEnding={weekEnding} />
    </Suspense>
  );
}

function ArchiveReportDetailSkeleton() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-4 w-32" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-7 w-32 rounded-full" />
        <Skeleton className="h-7 w-32 rounded-full" />
        <Skeleton className="h-7 w-32 rounded-full" />
      </div>

      <Skeleton className="h-40 w-full rounded-lg" />

      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-64 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>

      <Skeleton className="h-80 w-full rounded-lg" />
    </div>
  );
}
