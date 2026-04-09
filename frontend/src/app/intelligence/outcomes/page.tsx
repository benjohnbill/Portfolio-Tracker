import { getIntelligenceOutcomes } from '@/lib/api';
import { OutcomesView } from '@/components/intelligence/OutcomesView';

export default async function OutcomesPage() {
  const outcomes = await getIntelligenceOutcomes();
  return <OutcomesView initialOutcomes={outcomes} />;
}
