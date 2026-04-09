import { getReviewSummary } from '@/lib/api';
import { ReviewsView } from '@/components/intelligence/ReviewsView';

export default async function ReviewsPage() {
  const summary = await getReviewSummary();
  return <ReviewsView summary={summary} />;
}
