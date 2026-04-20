"use client";

import Link from 'next/link';
import { AttributionData, RuleAccuracyData, DecisionOutcomeData } from '@/lib/api';
import { CalmarTrajectoryPlaceholder } from './CalmarTrajectoryPlaceholder';

function DataDensityBadge({ weeks }: { weeks: number }) {
  if (weeks < 4) {
    return (
      <div className="px-3 py-1 rounded-full bg-accent border border-border/40 text-xs text-muted-foreground">
        Getting started — {weeks} week{weeks !== 1 ? 's' : ''} of data
      </div>
    );
  }
  if (weeks < 12) {
    return (
      <div className="px-3 py-1 rounded-full bg-amber-900/20 border border-amber-800/30 text-xs text-[#D4A574]">
        Early data — {weeks} weeks analyzed
      </div>
    );
  }
  return (
    <div className="px-3 py-1 rounded-full bg-emerald-900/20 border border-emerald-800/30 text-xs text-emerald-400">
      {weeks} weeks analyzed
    </div>
  );
}

function ContributionHeatmap({ attributions }: { attributions: AttributionData[] }) {
  if (attributions.length === 0) {
    return (
      <div className="grid grid-cols-[repeat(52,12px)] gap-[2px]">
        {Array.from({ length: 52 }).map((_, i) => (
          <div key={i} className="w-3 h-3 rounded-sm border border-border/30" />
        ))}
      </div>
    );
  }

  const maxScore = 100;
  return (
    <div className="grid grid-cols-[repeat(52,12px)] gap-[2px]">
      {Array.from({ length: 52 }).map((_, i) => {
        const attr = attributions[attributions.length - 52 + i];
        if (!attr) {
          return <div key={i} className="w-3 h-3 rounded-sm border border-border/30" />;
        }
        const opacity = Math.max(0.2, attr.totalScore / maxScore);
        return (
          <div
            key={i}
            className="w-3 h-3 rounded-sm cursor-pointer transition-transform hover:scale-150"
            style={{ backgroundColor: `rgba(212, 165, 116, ${opacity})` }}
            title={`${attr.snapshotDate}: ${attr.totalScore}/100`}
          />
        );
      })}
    </div>
  );
}

export function IntelligenceDashboard({
  attributions,
  ruleAccuracy,
  outcomes,
}: {
  attributions: AttributionData[];
  ruleAccuracy: RuleAccuracyData[];
  outcomes: DecisionOutcomeData[];
}) {
  const weeks = attributions.length;
  const latestScore = attributions.length > 0 ? attributions[attributions.length - 1].totalScore : null;
  const prevScore = attributions.length > 1 ? attributions[attributions.length - 2].totalScore : null;
  const scoreDelta = latestScore !== null && prevScore !== null ? latestScore - prevScore : null;

  const totalFired = ruleAccuracy.reduce((s, r) => s + r.timesFired, 0);
  const totalFollowed = ruleAccuracy.reduce((s, r) => s + r.timesFollowed, 0);
  const followRate = totalFired > 0 ? Math.round((totalFollowed / totalFired) * 100) : null;

  const avgScoreTrend = attributions.length >= 4
    ? Math.round(attributions.slice(-4).reduce((s, a) => s + a.totalScore, 0) / 4)
    : null;

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="flex items-baseline justify-between">
        <h1 className="text-3xl font-serif italic text-white">Intelligence</h1>
        <DataDensityBadge weeks={weeks} />
      </div>

      {/* 3-stat row */}
      <div className="grid grid-cols-3 gap-6">
        <div className="bg-card rounded-lg p-5 border border-border/40">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Rule Follow Rate</p>
          <p className="text-2xl font-mono text-white">
            {followRate !== null ? `${followRate}%` : '—'}
          </p>
        </div>
        <div className="bg-card rounded-lg p-5 border border-border/40">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">4-Week Avg Score</p>
          <p className="text-2xl font-mono text-white">
            {avgScoreTrend !== null ? `${avgScoreTrend}/100` : '—'}
          </p>
        </div>
        <div className="bg-card rounded-lg p-5 border border-border/40">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Latest Score</p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-mono text-white">
              {latestScore !== null ? latestScore : '—'}
            </p>
            {scoreDelta !== null && (
              <span className={`text-sm font-mono ${scoreDelta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {scoreDelta >= 0 ? '+' : ''}{scoreDelta}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Contribution heatmap */}
      <div className="bg-card rounded-lg p-6 border border-border/40">
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-4">Score Heatmap (52 weeks)</p>
        <ContributionHeatmap attributions={attributions} />
      </div>

      {/* Calmar Trajectory */}
      <CalmarTrajectoryPlaceholder />

      {/* Recent decisions */}
      <div className="bg-card rounded-lg p-6 border border-border/40">
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-4">Recent Decisions</p>
        {outcomes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No decision outcomes yet. Outcomes will appear as horizons mature.</p>
        ) : (
          <div className="space-y-2">
            {outcomes.slice(0, 8).map((o, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-muted-foreground">{o.snapshotDate}</span>
                  <span className="text-sm text-white">{o.decision.type}</span>
                  {o.decision.assetTicker && (
                    <span className="text-xs font-mono text-[#D4A574]">{o.decision.assetTicker}</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-muted-foreground">{o.horizon}</span>
                  {o.outcomeDeltaPct !== null && (
                    <span className={`text-xs font-mono px-2 py-0.5 rounded ${
                      o.outcomeDeltaPct >= 0
                        ? 'bg-emerald-900/30 text-emerald-400'
                        : 'bg-red-900/30 text-red-400'
                    }`}>
                      {o.outcomeDeltaPct >= 0 ? '+' : ''}{o.outcomeDeltaPct.toFixed(2)}%
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Navigation links */}
      <div className="grid grid-cols-4 gap-4">
        <Link href="/intelligence/attributions" className="bg-card rounded-lg p-5 border border-border/40 hover:border-primary/40 transition-colors">
          <p className="text-sm font-medium text-white">Score Attribution</p>
          <p className="text-xs text-muted-foreground mt-1">Decompose scores over time</p>
        </Link>
        <Link href="/intelligence/outcomes" className="bg-card rounded-lg p-5 border border-border/40 hover:border-primary/40 transition-colors">
          <p className="text-sm font-medium text-white">Decision Outcomes</p>
          <p className="text-xs text-muted-foreground mt-1">Evaluate past decisions</p>
        </Link>
        <Link href="/intelligence/rules" className="bg-card rounded-lg p-5 border border-border/40 hover:border-primary/40 transition-colors">
          <p className="text-sm font-medium text-white">Rule Accuracy</p>
          <p className="text-xs text-muted-foreground mt-1">Track rule performance</p>
        </Link>
        <Link href="/intelligence/reviews" className="bg-card rounded-lg p-5 border border-border/40 hover:border-primary/40 transition-colors">
          <p className="text-sm font-medium text-white">Periodic Reviews</p>
          <p className="text-xs text-muted-foreground mt-1">Monthly, quarterly, annual</p>
        </Link>
      </div>
    </div>
  );
}
