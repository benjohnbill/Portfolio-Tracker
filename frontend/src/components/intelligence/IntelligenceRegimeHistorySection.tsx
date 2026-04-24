/**
 * RSC async child for regime-history display on /intelligence/attributions.
 * Phase UX-1b Task 3.
 */

import { getIntelligenceRegimeHistoryCached } from '@/lib/intelligence-fetchers-rsc';
import { isReady } from '@/lib/envelope';

export async function IntelligenceRegimeHistorySection() {
  const envelope = await getIntelligenceRegimeHistoryCached();

  if (!isReady(envelope) || envelope.transitions.length === 0) {
    return (
      <div className="rounded-lg border border-border/40 p-6 text-sm text-muted-foreground">
        Regime transitions unavailable.
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-primary">
        Regime Transitions
      </h2>
      <ul className="space-y-1 text-sm">
        {envelope.transitions.map((t, i) => (
          <li key={i} className="flex items-center gap-3">
            <span className="text-muted-foreground">{t.date}</span>
            <span>{t.from} → {t.to}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
