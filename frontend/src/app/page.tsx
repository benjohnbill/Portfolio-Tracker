import { Suspense } from 'react';

import { WeeklyReportView } from '@/components/reports/WeeklyReportView';
import { Skeleton } from '@/components/ui/skeleton';
import { SkeletonCard } from '@/components/ui/skeleton-patterns';
import { getLatestWeeklyReport } from '@/lib/api';
import { isReady } from '@/lib/envelope';

export default function ThisWeekPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10 space-y-8">
      <Suspense fallback={<ThisWeekSkeleton />}>
        <ThisWeekReport />
      </Suspense>
    </main>
  );
}

function ThisWeekSkeleton() {
  // Shape mirrors WeeklyReportView's hero: eyebrow (icon + small uppercase),
  // italic h1 title, description paragraph. Content below is approximated as
  // cards; the loaded view has more structure, but "roughly matches" is the
  // bar here — Phase 1c will refine if needed.
  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-96 max-w-full" />
        <Skeleton className="h-4 w-full max-w-2xl" />
        <Skeleton className="h-4 w-3/4 max-w-2xl" />
      </div>
      <div className="space-y-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}

async function ThisWeekReport() {
  const envelope = await getLatestWeeklyReport();

  if (!isReady(envelope) || !envelope.report) {
    return (
      <div className="p-8 text-muted-foreground text-sm">
        이번 주 리포트를 불러올 수 없어요. 나중에 다시 시도해주세요.
      </div>
    );
  }

  return (
    <WeeklyReportView
      report={envelope.report}
      eyebrow="This Week"
      title="Weekly Decision Surface"
      description={`Week Ending ${envelope.report.weekEnding} · Generated ${new Date(envelope.report.generatedAt).toLocaleString()}`}
    />
  );
}
