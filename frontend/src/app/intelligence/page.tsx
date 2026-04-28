import Link from 'next/link';
import { Suspense } from 'react';

import { CalmarTrajectoryPlaceholder } from '@/components/intelligence/CalmarTrajectoryPlaceholder';
import { ContributionHeatmap, DataDensityBadge } from '@/components/intelligence/IntelligenceSharedUI';
import { Skeleton } from '@/components/ui/skeleton';
import { SkeletonList } from '@/components/ui/skeleton-patterns';
import { isReady } from '@/lib/envelope';
import {
  getIntelligenceAttributionsCached,
  getIntelligenceOutcomesCached,
  getIntelligenceRuleAccuracyCached,
} from '@/lib/intelligence-fetchers-rsc';

export default function IntelligencePage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10 space-y-8">
      <Suspense fallback={<HeroSkeleton />}>
        <Hero />
      </Suspense>

      <Suspense fallback={<StatsSkeleton />}>
        <StatsRow />
      </Suspense>

      <Suspense fallback={<HeatmapSkeleton />}>
        <Heatmap />
      </Suspense>

      {/* Calmar trajectory is self-fetching (client component). Mounted directly. */}
      <CalmarTrajectoryPlaceholder />

      <Suspense fallback={<RecentDecisionsSkeleton />}>
        <RecentDecisions />
      </Suspense>

      {/* Navigation grid — static, no data fetch */}
      <NavGrid />
    </main>
  );
}

// ---------------------------------------------------------------------------
// Hero — attribution-derived week count drives the DataDensityBadge
// ---------------------------------------------------------------------------

async function Hero() {
  const envelope = await getIntelligenceAttributionsCached();
  const weeks = isReady(envelope) ? envelope.attributions.length : 0;

  return (
    <div className="flex items-baseline justify-between">
      <h1 className="text-3xl font-serif italic text-white">Intelligence</h1>
      <DataDensityBadge weeks={weeks} />
    </div>
  );
}

function HeroSkeleton() {
  return (
    <div className="flex items-baseline justify-between">
      <Skeleton className="h-9 w-48" />
      <Skeleton className="h-6 w-40 rounded-full" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3-stat roll-up — aggregates data from all 3 endpoints
// ---------------------------------------------------------------------------

async function StatsRow() {
  const [attributionsEnv, rulesEnv] = await Promise.all([
    getIntelligenceAttributionsCached(),
    getIntelligenceRuleAccuracyCached(),
  ]);

  const attributions = isReady(attributionsEnv) ? attributionsEnv.attributions : [];
  const ruleAccuracy = isReady(rulesEnv) ? rulesEnv.rules : [];

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
  );
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-card rounded-lg p-5 border border-border/40 space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Contribution heatmap — 52-week attribution grid
// ---------------------------------------------------------------------------

async function Heatmap() {
  const envelope = await getIntelligenceAttributionsCached();
  const attributions = isReady(envelope) ? envelope.attributions : [];

  return (
    <div className="bg-card rounded-lg p-6 border border-border/40">
      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-4">Score Heatmap (52 weeks)</p>
      <ContributionHeatmap attributions={attributions} />
    </div>
  );
}

function HeatmapSkeleton() {
  return (
    <div className="bg-card rounded-lg p-6 border border-border/40 space-y-4">
      <Skeleton className="h-3 w-48" />
      <div className="grid grid-cols-[repeat(52,12px)] gap-[2px]">
        {Array.from({ length: 52 }).map((_, i) => (
          <div key={i} className="w-3 h-3 rounded-sm border border-border/30" />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recent decisions — last 8 outcomes with compact rows
// ---------------------------------------------------------------------------

async function RecentDecisions() {
  const envelope = await getIntelligenceOutcomesCached();
  const outcomes = isReady(envelope) ? envelope.outcomes : [];

  return (
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
  );
}

function RecentDecisionsSkeleton() {
  return (
    <div className="bg-card rounded-lg p-6 border border-border/40 space-y-3">
      <Skeleton className="h-3 w-40" />
      <SkeletonList count={6} itemShape="row" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Navigation grid — static
// ---------------------------------------------------------------------------

function NavGrid() {
  return (
    <div className="grid grid-cols-5 gap-4">
      <Link href="/intelligence/macro-context" className="bg-card rounded-lg p-5 border border-border/40 hover:border-primary/40 transition-colors">
        <p className="text-sm font-medium text-white">Macro Context</p>
        <p className="text-xs text-muted-foreground mt-1">Indicator meaning · score causation · positioning · performance</p>
      </Link>
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
  );
}
