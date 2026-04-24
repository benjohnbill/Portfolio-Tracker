import { Suspense } from 'react';

import { IntelligenceReviewsSection } from '@/components/intelligence/IntelligenceReviewsSection';
import { Skeleton } from '@/components/ui/skeleton';
import { SkeletonList } from '@/components/ui/skeleton-patterns';

export default function ReviewsPage() {
  // Page-level hero intentionally omitted: ReviewsView owns its h1
  // internally (D8 convention).
  return (
    <main className="mx-auto max-w-6xl px-6 py-10 space-y-8">
      <Suspense fallback={<ReviewsPageSkeleton />}>
        <IntelligenceReviewsSection />
      </Suspense>
    </main>
  );
}

function ReviewsPageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-40" />
      <SkeletonList count={4} itemShape="card" />
    </div>
  );
}
