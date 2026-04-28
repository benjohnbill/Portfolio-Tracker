import Link from 'next/link';

import { isReady } from '@/lib/envelope';
import { getMacroContextCached } from '@/lib/macro-context-fetchers-rsc';

export async function MacroContextSection() {
  const env = await getMacroContextCached();
  const ctx = isReady(env) ? env.data : null;

  const buckets = ctx?.causalMap.currentBucketStates ?? [];
  const supCount = buckets.filter((b) => b.state === 'supportive').length;
  const advCount = buckets.filter((b) => b.state === 'adverse').length;
  const overall = supCount >= 3 ? 'supportive' : advCount >= 3 ? 'adverse' : 'neutral';

  const fitScore = ctx?.performance.fit?.score ?? null;
  const fitDelta = ctx?.performance.fit?.deltaVsPriorWeek ?? null;
  const knownAsOf = ctx?.knownAsOf ?? '—';
  const logicVersion = ctx?.logicVersion ? `rules v${ctx.logicVersion.rules} · meta v${ctx.logicVersion.meta}` : '—';

  return (
    <section className="bg-card rounded-lg p-5 border border-border/40">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Macro Context</p>
        <Link href="/intelligence/macro-context" className="text-xs text-[#D4A574] hover:underline">
          Open in Intelligence →
        </Link>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Macro state</p>
          <p className="text-lg font-mono text-white">
            {ctx ? `${supCount} SUP / ${advCount} ADV` : '—'}
          </p>
          <p className="text-[10px] font-mono uppercase text-[#5a6577]">{overall}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Fit Score</p>
          <div className="flex items-baseline gap-2">
            <p className="text-lg font-mono text-white">{fitScore ?? '—'}<span className="text-xs text-muted-foreground"> / 30</span></p>
            {fitDelta !== null && (
              <span className={`text-[10px] font-mono ${fitDelta >= 0 ? 'text-[#4ADE80]' : 'text-[#F87171]'}`}>
                {fitDelta >= 0 ? '+' : ''}{fitDelta}
              </span>
            )}
          </div>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Updated</p>
          <p className="text-sm font-mono text-white">{knownAsOf}</p>
          <p className="text-[10px] font-mono uppercase text-[#5a6577]">{logicVersion}</p>
        </div>
      </div>
    </section>
  );
}
