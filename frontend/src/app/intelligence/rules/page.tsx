import { getIntelligenceRuleAccuracy } from '@/lib/api';
import { RulesView } from '@/components/intelligence/RulesView';

export default async function RulesPage() {
  const ruleAccuracy = await getIntelligenceRuleAccuracy();
  return <RulesView ruleAccuracy={ruleAccuracy} />;
}
