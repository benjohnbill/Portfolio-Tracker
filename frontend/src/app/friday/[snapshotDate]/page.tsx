import { Suspense } from 'react';

import { FridaySnapshotSection } from '@/components/friday/FridaySnapshotSection';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface PageProps {
  params: Promise<{ snapshotDate: string }>;
}

export default async function FridaySnapshotDetailPage({ params }: PageProps) {
  const { snapshotDate } = await params;
  return (
    <Suspense fallback={<DetailSkeleton snapshotDate={snapshotDate} />}>
      <FridaySnapshotSection date={snapshotDate} />
    </Suspense>
  );
}

/**
 * Skeleton mirrors FridaySnapshotPanel's layout:
 * - Header row (eyebrow + title + description + back link)
 * - 3-up hero cards (Score, Portfolio State, Recommendation)
 * - 12-col grid: 7-col left (Allocation + Triggered Rules), 5-col right
 *   (Macro Regime + Decision Journal)
 */
function DetailSkeleton({ snapshotDate }: { snapshotDate: string }) {
  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-3 w-56" />
        </div>
        <Skeleton className="h-4 w-40" />
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-4">
          <CardHeader className="pb-3 space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-10 w-20" />
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </CardContent>
        </Card>
        <Card className="lg:col-span-4">
          <CardHeader className="pb-3 space-y-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-7 w-40" />
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </CardContent>
        </Card>
        <Card className="lg:col-span-4">
          <CardHeader className="pb-3 space-y-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-7 w-32" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-7 space-y-8">
          <Card>
            <CardHeader className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-3 w-64" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3 w-56" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-14 w-full rounded-lg" />
              <Skeleton className="h-14 w-full rounded-lg" />
            </CardContent>
          </Card>
        </div>
        <div className="lg:col-span-5 space-y-8">
          <Card>
            <CardHeader className="space-y-2">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-3 w-48" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-14 w-full rounded-lg" />
              <Skeleton className="h-14 w-full rounded-lg" />
              <Skeleton className="h-14 w-full rounded-lg" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3 w-56" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-20 w-full rounded-lg" />
              <Skeleton className="h-20 w-full rounded-lg" />
            </CardContent>
          </Card>
        </div>
      </div>
      {/* Anchor so the URL-derived date is still rendered during skeleton. */}
      <span className="sr-only">Loading snapshot for {snapshotDate}</span>
    </div>
  );
}
