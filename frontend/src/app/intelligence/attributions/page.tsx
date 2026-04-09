import { getIntelligenceAttributions, getIntelligenceRegimeHistory } from '@/lib/api';
import { AttributionsView } from '@/components/intelligence/AttributionsView';

export default async function AttributionsPage() {
  const [attributions, regimeHistory] = await Promise.all([
    getIntelligenceAttributions(),
    getIntelligenceRegimeHistory(),
  ]);

  return <AttributionsView attributions={attributions} regimeHistory={regimeHistory} />;
}
