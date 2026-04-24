import { getIntelligenceOutcomesCached } from '@/lib/intelligence-fetchers-rsc';
import { isReady } from '@/lib/envelope';
import { OutcomesView } from './OutcomesView';

export async function IntelligenceOutcomesSection() {
  const envelope = await getIntelligenceOutcomesCached();

  if (!isReady(envelope)) {
    return (
      <div className="rounded-lg border border-border/40 p-6 text-sm text-muted-foreground">
        Decision outcomes unavailable.
      </div>
    );
  }

  return <OutcomesView initialOutcomes={envelope.outcomes} />;
}
