"use client";

import { useState } from 'react';
import { DecisionOutcomeData, getIntelligenceOutcomes } from '@/lib/api';

const HORIZONS = ['1w', '1m', '3m', '6m', '1y'] as const;

function OutcomeBadge({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="text-[11px] font-mono uppercase px-2 py-0.5 rounded bg-[#11161d] text-[#8b95a5]">Pending</span>;
  }
  if (value >= 0) {
    return <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#0a2010] text-[#4ADE80]">+{value.toFixed(2)}%</span>;
  }
  return <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#200a0a] text-[#F87171]">{value.toFixed(2)}%</span>;
}

export function OutcomesView({ initialOutcomes }: { initialOutcomes: DecisionOutcomeData[] }) {
  const [horizon, setHorizon] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState(initialOutcomes);
  const [loading, setLoading] = useState(false);

  const handleHorizonChange = async (h: string | null) => {
    setHorizon(h);
    setLoading(true);
    const data = await getIntelligenceOutcomes(h ?? undefined);
    setOutcomes(data);
    setLoading(false);
  };

  const followed = outcomes.filter(o => o.outcomeDeltaPct !== null);
  const avgDelta = followed.length > 0
    ? Math.round(followed.reduce((s, o) => s + (o.outcomeDeltaPct ?? 0), 0) / followed.length * 100) / 100
    : null;

  if (initialOutcomes.length === 0 && outcomes.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-serif italic text-white">Decision Outcomes</h1>
        <div className="bg-card rounded-lg p-8 border border-border/40 text-center">
          <p className="text-muted-foreground">Decisions need time. Your first outcomes will appear as horizons mature.</p>
          <p className="text-xs text-muted-foreground mt-2">1-week outcomes appear 7 days after a decision.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="flex items-baseline justify-between">
        <h1 className="text-3xl font-serif italic text-white">Decision Outcomes</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleHorizonChange(null)}
            className={`px-3 py-1 text-xs font-mono rounded transition-colors ${
              horizon === null
                ? 'bg-primary/20 text-primary border border-primary/40'
                : 'text-muted-foreground hover:text-white border border-border/40'
            }`}
          >
            All
          </button>
          {HORIZONS.map(h => (
            <button
              key={h}
              onClick={() => handleHorizonChange(h)}
              className={`px-3 py-1 text-xs font-mono rounded transition-colors ${
                horizon === h
                  ? 'bg-primary/20 text-primary border border-primary/40'
                  : 'text-muted-foreground hover:text-white border border-border/40'
              }`}
            >
              {h.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-6">
        <div className="bg-card rounded-lg p-5 border border-border/40">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Total Decisions</p>
          <p className="text-2xl font-mono text-white">{outcomes.length}</p>
        </div>
        <div className="bg-card rounded-lg p-5 border border-border/40">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Evaluated</p>
          <p className="text-2xl font-mono text-white">{followed.length}</p>
        </div>
        <div className="bg-card rounded-lg p-5 border border-border/40">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Avg Outcome</p>
          <p className={`text-2xl font-mono ${avgDelta !== null && avgDelta >= 0 ? 'text-emerald-400' : avgDelta !== null ? 'text-red-400' : 'text-white'}`}>
            {avgDelta !== null ? `${avgDelta >= 0 ? '+' : ''}${avgDelta}%` : '—'}
          </p>
        </div>
      </div>

      {/* Decision cards */}
      <div className="bg-card rounded-lg border border-border/40 divide-y divide-border/20">
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 bg-accent/50 rounded animate-pulse" />
            ))}
          </div>
        ) : (
          outcomes.map((o, i) => (
            <div key={i} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-xs font-mono text-muted-foreground w-20">{o.snapshotDate}</span>
                <span className="text-sm text-white">{o.decision.type}</span>
                {o.decision.assetTicker && (
                  <span className="text-xs font-mono text-[#D4A574]">{o.decision.assetTicker}</span>
                )}
                <span className="text-xs text-muted-foreground">conf: {o.decision.confidenceVsSpyRiskadj}/10</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs font-mono text-muted-foreground">{o.horizon}</span>
                <OutcomeBadge value={o.outcomeDeltaPct} />
                {o.scoreDelta !== null && (
                  <span className={`text-xs font-mono ${o.scoreDelta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    score: {o.scoreDelta >= 0 ? '+' : ''}{o.scoreDelta}
                  </span>
                )}
                {o.regimeChanged === 'true' && (
                  <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-amber-900/30 text-[#D4A574]">regime shift</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
