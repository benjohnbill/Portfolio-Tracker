import { getIntelligenceAttributionsCached } from '@/lib/intelligence-fetchers-rsc';
import { isReady } from '@/lib/envelope';
import { AttributionsView } from './AttributionsView';
import { ContributionHeatmap, DataDensityBadge } from './IntelligenceSharedUI';

export async function IntelligenceAttributionsSection() {
  const envelope = await getIntelligenceAttributionsCached();

  if (!isReady(envelope)) {
    return (
      <div className="rounded-lg border border-border/40 p-6 text-sm text-muted-foreground">
        Attribution data unavailable.
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-4">
        <DataDensityBadge weeks={envelope.attributions.length} />
      </div>
      <ContributionHeatmap attributions={envelope.attributions} />
      <AttributionsView attributions={envelope.attributions} regimeHistory={[]} />
    </section>
  );
}
