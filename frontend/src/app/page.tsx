import { Suspense } from 'react';

import { WeeklyReportView } from '@/components/reports/WeeklyReportView';
import { SkeletonHero, SkeletonList } from '@/components/ui/skeleton-patterns';
import { getLatestWeeklyReport } from '@/lib/api';

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
  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <SkeletonHero />
      <SkeletonList count={4} itemShape="card" />
    </div>
  );
}

async function ThisWeekReport() {
  const envelope = await getLatestWeeklyReport();

  if (envelope.status === 'unavailable' || !envelope.report) {
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
