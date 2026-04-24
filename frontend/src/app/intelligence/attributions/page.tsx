import { getIntelligenceAttributions, getIntelligenceRegimeHistory } from '@/lib/api';
import { isReady } from '@/lib/envelope';
import { AttributionsView } from '@/components/intelligence/AttributionsView';

export default async function AttributionsPage() {
  // TODO(ux1-phase1b-task3): full Suspense restructure lands in Task 3 (with regime-history envelope).
  const [attributionsEnvelope, regimeHistory] = await Promise.all([
    getIntelligenceAttributions(),
    getIntelligenceRegimeHistory(),
  ]);
  const attributions = isReady(attributionsEnvelope) ? attributionsEnvelope.attributions : [];
  // NOTE: getIntelligenceRegimeHistory still returns raw array (pre-envelope).
  // Task 3 converts it to an envelope. Leave as-is here.
  return <AttributionsView attributions={attributions} regimeHistory={regimeHistory} />;
}
