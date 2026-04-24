/**
 * RSC async child for reviews summary on /intelligence/reviews.
 * Phase UX-1b Task 5.
 */

import { getReviewSummary } from '@/lib/api';
import { isReady } from '@/lib/envelope';
import { ReviewsView } from './ReviewsView';

export async function IntelligenceReviewsSection() {
  const envelope = await getReviewSummary();

  if (!isReady(envelope)) {
    return (
      <div className="rounded-lg border border-border/40 p-6 text-sm text-muted-foreground">
        Reviews data unavailable.
      </div>
    );
  }

  return <ReviewsView summary={envelope.summary} />;
}
