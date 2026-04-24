import { Suspense } from 'react';

import { IntelligenceRulesSection } from '@/components/intelligence/IntelligenceRulesSection';
import { Skeleton } from '@/components/ui/skeleton';
import { SkeletonList } from '@/components/ui/skeleton-patterns';

export default function RulesPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10 space-y-8">
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-primary mb-1">
          Intelligence · Rules
        </div>
        <h1 className="text-3xl font-bold tracking-tight italic">Rule Accuracy</h1>
      </div>

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
