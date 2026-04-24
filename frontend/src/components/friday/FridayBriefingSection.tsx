/**
 * RSC async child for the "Since Last Friday" briefing panel on /friday.
 *
 * Fetches its own endpoint so a slow briefing does not block the hero /
 * signals / decisions panels from hydrating. Phase UX-1a D3.
 */

import { SinceLastFridayBriefing } from '@/components/friday/SinceLastFridayBriefing';
import { getFridayBriefing } from '@/lib/api';
import { isReady } from '@/lib/envelope';


export async function FridayBriefingSection() {
  const envelope = await getFridayBriefing();

  if (!isReady(envelope)) {
    return (
      <div className="rounded-lg border border-border/40 p-4 text-sm text-muted-foreground">
        지난 금요일 이후 이벤트를 불러올 수 없어요.
      </div>
    );
  }

  // SinceLastFridayBriefing reads `FridayBriefingData`. The envelope spreads
  // those same keys at its root plus `status`, so passing it directly is safe.
  return <SinceLastFridayBriefing data={envelope} />;
}
