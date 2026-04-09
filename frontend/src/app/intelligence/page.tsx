import { getIntelligenceAttributions, getIntelligenceRuleAccuracy, getIntelligenceOutcomes } from '@/lib/api';
import { IntelligenceDashboard } from '@/components/intelligence/IntelligenceDashboard';

export default async function IntelligencePage() {
  const [attributions, ruleAccuracy, outcomes] = await Promise.all([
    getIntelligenceAttributions(),
    getIntelligenceRuleAccuracy(),
    getIntelligenceOutcomes(),
  ]);

  return (
    <IntelligenceDashboard
      attributions={attributions}
      ruleAccuracy={ruleAccuracy}
      outcomes={outcomes}
    />
  );
}
