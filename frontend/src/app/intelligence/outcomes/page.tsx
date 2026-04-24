import { getIntelligenceOutcomes } from '@/lib/api';
import { isReady } from '@/lib/envelope';
import { OutcomesView } from '@/components/intelligence/OutcomesView';

export default async function OutcomesPage() {
  // TODO(ux1-phase1b-task4): full Suspense restructure lands in Task 4.
  const envelope = await getIntelligenceOutcomes();
  const outcomes = isReady(envelope) ? envelope.outcomes : [];
  return <OutcomesView initialOutcomes={outcomes} />;
}
