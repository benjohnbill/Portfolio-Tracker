import { getIntelligenceRuleAccuracy } from '@/lib/api';
import { isReady } from '@/lib/envelope';
import { RulesView } from '@/components/intelligence/RulesView';

export default async function RulesPage() {
  // TODO(ux1-phase1b-task2): full Suspense restructure lands in Task 2.
  const envelope = await getIntelligenceRuleAccuracy();
  const ruleAccuracy = isReady(envelope) ? envelope.rules : [];
  return <RulesView ruleAccuracy={ruleAccuracy} />;
}
