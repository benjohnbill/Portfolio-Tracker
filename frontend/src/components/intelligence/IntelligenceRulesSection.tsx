import { getIntelligenceRuleAccuracyCached } from '@/lib/intelligence-fetchers-rsc';
import { isReady } from '@/lib/envelope';
import { RulesView } from './RulesView';

export async function IntelligenceRulesSection() {
  const envelope = await getIntelligenceRuleAccuracyCached();

  if (!isReady(envelope)) {
    return (
      <div className="rounded-lg border border-border/40 p-6 text-sm text-muted-foreground">
        Rule-accuracy data unavailable.
      </div>
    );
  }

  return <RulesView ruleAccuracy={envelope.rules} />;
}
