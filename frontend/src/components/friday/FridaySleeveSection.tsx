/**
 * RSC async child for the Sleeve Health panel on /friday.
 *
 * Needs both the sleeve-recency history AND the current weekly report (for
 * drift + active rules). Fetches them in parallel so a slow endpoint does
 * not serialize the other. Phase UX-1a D3.
 */

import { SleeveHealthPanel } from '@/components/friday/SleeveHealthPanel';
import { type SleeveHistoryData } from '@/lib/api';
import { getFridayCurrentCached, getFridaySleeveHistoryCached } from '@/lib/friday-fetchers-rsc';
import { isReady } from '@/lib/envelope';


const EMPTY_SLEEVE_HISTORY: SleeveHistoryData = {
  NDX: [],
  DBMF: [],
  BRAZIL: [],
  MSTR: [],
  GLDM: [],
  'BONDS-CASH': [],
};

export async function FridaySleeveSection() {
  const [sleeveEnvelope, reportEnvelope] = await Promise.all([
    getFridaySleeveHistoryCached(4),
    getFridayCurrentCached(),
  ]);

  if (!isReady(reportEnvelope) || !reportEnvelope.report) {
    return (
      <div className="rounded-lg border border-border/40 p-4 text-sm text-muted-foreground">
        Sleeve 데이터를 불러올 수 없어요.
      </div>
    );
  }

  // When sleeve-history is unavailable we still render the panel using drift /
  // active-rules from the report — recency strip just shows zeros.
  const sleeveHistory = isReady(sleeveEnvelope)
    ? sleeveEnvelope.sleeves
    : EMPTY_SLEEVE_HISTORY;

  return <SleeveHealthPanel report={reportEnvelope.report} sleeveHistory={sleeveHistory} />;
}
