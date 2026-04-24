import { Suspense } from 'react';

import { IntelligenceRulesSection } from '@/components/intelligence/IntelligenceRulesSection';
import { Skeleton } from '@/components/ui/skeleton';
import { SkeletonList } from '@/components/ui/skeleton-patterns';

export default function RulesPage() {
  // Page-level hero intentionally omitted: RulesView owns the "Rule Accuracy"
  // h1 internally (same applies to other intelligence subroute pages —
  // Tasks 3/4/5 follow the same convention to avoid duplicate h1s).
  return (
    <main className="mx-auto max-w-6xl px-6 py-10 space-y-8">
      <Suspense fallback={<RulesPageSkeleton />}>
        <IntelligenceRulesSection />
      </Suspense>
    </main>
  );
}

function RulesPageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-40" />
      <SkeletonList count={10} itemShape="row" />
    </div>
  );
}
