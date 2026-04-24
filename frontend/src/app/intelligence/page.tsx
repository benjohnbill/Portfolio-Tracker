import { Suspense } from 'react';

import { CalmarTrajectoryPlaceholder } from '@/components/intelligence/CalmarTrajectoryPlaceholder';
import { IntelligenceAttributionsSection } from '@/components/intelligence/IntelligenceAttributionsSection';
import { IntelligenceOutcomesSection } from '@/components/intelligence/IntelligenceOutcomesSection';
import { IntelligenceRulesSection } from '@/components/intelligence/IntelligenceRulesSection';
import { Skeleton } from '@/components/ui/skeleton';
import { SkeletonCard, SkeletonList } from '@/components/ui/skeleton-patterns';

export default function IntelligencePage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10 space-y-10">
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-primary mb-1">
          Intelligence
        </div>
        <h1 className="text-3xl font-bold tracking-tight italic">Patterns across months</h1>
      </div>

      <Suspense fallback={<AttributionsSkeleton />}>
        <IntelligenceAttributionsSection />
      </Suspense>

      {/* Calmar trajectory is self-fetching (client component). Mounted directly. */}
      <CalmarTrajectoryPlaceholder />

      <Suspense fallback={<RulesSkeleton />}>
        <IntelligenceRulesSection />
      </Suspense>

      <Suspense fallback={<OutcomesSkeleton />}>
        <IntelligenceOutcomesSection />
      </Suspense>
    </main>
  );
}

function AttributionsSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-6 w-40 rounded-full" />
      <div className="grid grid-cols-[repeat(52,12px)] gap-[2px]">
        {Array.from({ length: 52 }).map((_, i) => (
          <div key={i} className="w-3 h-3 rounded-sm border border-border/30" />
        ))}
      </div>
      <SkeletonCard className="h-64" />
      <SkeletonList count={4} itemShape="row" />
    </div>
  );
}

function RulesSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-32" />
      <SkeletonList count={8} itemShape="row" />
    </div>
  );
}

function OutcomesSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-40" />
      <SkeletonList count={5} itemShape="card" />
    </div>
  );
}
