import { Suspense } from 'react';

import { IntelligenceAttributionsSection } from '@/components/intelligence/IntelligenceAttributionsSection';
import { IntelligenceRegimeHistorySection } from '@/components/intelligence/IntelligenceRegimeHistorySection';
import { Skeleton } from '@/components/ui/skeleton';
import { SkeletonCard, SkeletonList } from '@/components/ui/skeleton-patterns';

export default function AttributionsPage() {
  // Page-level hero intentionally omitted: AttributionsView owns its h1
  // internally (D8 convention). If AttributionsView does NOT have an internal
  // h1, re-introduce the page-level eyebrow + h1.
  return (
    <main className="mx-auto max-w-6xl px-6 py-10 space-y-8">
      <Suspense fallback={<AttributionsPageSkeleton />}>
        <IntelligenceAttributionsSection />
      </Suspense>

      <Suspense fallback={<RegimeHistorySkeleton />}>
        <IntelligenceRegimeHistorySection />
      </Suspense>
    </main>
  );
}

function AttributionsPageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-40" />
      <SkeletonCard className="h-72" />
      <SkeletonList count={4} itemShape="row" />
    </div>
  );
}

function RegimeHistorySkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-4 w-40" />
      <SkeletonList count={6} itemShape="row" />
    </div>
  );
}
