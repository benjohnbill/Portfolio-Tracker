import { Suspense } from 'react';

import { IntelligenceOutcomesSection } from '@/components/intelligence/IntelligenceOutcomesSection';
import { Skeleton } from '@/components/ui/skeleton';
import { SkeletonList } from '@/components/ui/skeleton-patterns';

export default function OutcomesPage() {
  // Page-level hero intentionally omitted: OutcomesView owns the h1
  // internally (D8 convention, same as rules + attributions subroutes).
  return (
    <main className="mx-auto max-w-6xl px-6 py-10 space-y-8">
      <Suspense fallback={<OutcomesPageSkeleton />}>
        <IntelligenceOutcomesSection />
      </Suspense>
    </main>
  );
}

function OutcomesPageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-48" />
      <SkeletonList count={6} itemShape="row" />
    </div>
  );
}
