"use client";

import { useState } from 'react';
import type { MacroContext } from '@/lib/api';

interface Props {
  causalMap: MacroContext['causalMap'];
  performance: MacroContext['performance'];
}

export function CausalMapSection({ causalMap, performance }: Props) {
  const [highlight, setHighlight] = useState<string | null>(null);

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-serif italic text-white">§2 Causal Map</h2>
      <p className="text-sm text-muted-foreground">Indicators → Buckets → Sleeve compatibility → Composite breakdown.</p>

      <div className="grid grid-cols-4 gap-4">
        {/* Column 1: bucket states */}
        <div className="bg-card rounded-lg p-4 border border-border/40">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Buckets</p>
          <ul className="space-y-2">
            {causalMap.currentBucketStates.map((b) => (
              <li
                key={b.bucket}
                className={`text-sm font-mono uppercase cursor-pointer ${highlight === b.bucket ? 'text-[#D4A574]' : 'text-white'}`}
                onMouseEnter={() => setHighlight(b.bucket)}
                onMouseLeave={() => setHighlight(null)}
              >
                {b.bucket} · {b.state.toUpperCase()}
              </li>
            ))}
          </ul>
        </div>

        {/* Column 2: matched rule per bucket */}
        <div className="bg-card rounded-lg p-4 border border-border/40">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Matched Rule</p>
          <ul className="space-y-2">
            {causalMap.bucketRules.map((b) => (
              <li
                key={b.bucket}
                className={`text-xs ${highlight === b.bucket ? 'text-white' : 'text-muted-foreground'}`}
                onMouseEnter={() => setHighlight(b.bucket)}
                onMouseLeave={() => setHighlight(null)}
              >
                <span className="font-mono">+{b.points} / {b.rule.pointsFullMatch}</span> — {b.narrative}
              </li>
            ))}
          </ul>
        </div>

        {/* Column 3: sleeve impacts */}
        <div className="bg-card rounded-lg p-4 border border-border/40">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Sleeve Impact</p>
          <ul className="space-y-2 text-xs">
            {causalMap.sleeveImpacts.map((bucket) => (
              <li
                key={bucket.bucket}
                className={highlight === bucket.bucket ? 'text-white' : 'text-muted-foreground'}
                onMouseEnter={() => setHighlight(bucket.bucket)}
                onMouseLeave={() => setHighlight(null)}
              >
                <span className="font-mono uppercase text-[10px] text-[#5a6577]">{bucket.bucket}</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {bucket.sleeves.slice(0, 4).map((s) => (
                    <span key={s.sleeve} className="font-mono text-[10px] px-1 py-[1px] rounded bg-[#11161d]">
                      {s.sleeve}:{s.compatibilityBand}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Column 4: composite breakdown */}
        <div className="bg-card rounded-lg p-4 border border-border/40">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Composite Breakdown</p>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Fit (30)</p>
              <p className="font-mono text-white">{performance.fit?.score ?? '—'} / 30</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Alignment (30)</p>
              <p className="font-mono text-white">{performance.alignment?.score ?? '—'} / 30</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Posture (40)</p>
              <p className="font-mono text-white">{performance.posture?.score ?? '—'} / 40</p>
            </div>
            <div className="pt-2 border-t border-border/40">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="font-mono text-2xl text-[#D4A574]">{performance.lastTotal ?? '—'} / 100</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
