import { Suspense } from 'react';
import Link from 'next/link';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SkeletonCard, SkeletonList } from '@/components/ui/skeleton-patterns';
import { compareFridaySnapshots, getFridaySnapshots, type FridayComparison } from '@/lib/api';
import { isReady } from '@/lib/envelope';
import { CalendarDays, ChevronRight, GitCompareArrows } from 'lucide-react';


function formatCurrency(value: number) {
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(value);
}

function formatOptionalCurrency(value: number | null | undefined) {
  return typeof value === 'number' ? formatCurrency(value) : 'Unavailable in partial snapshot';
}

function formatOptionalScore(value: number | null | undefined) {
  return typeof value === 'number' ? String(value) : '—';
}

function formatOptionalText(value: string | null | undefined) {
  return value ?? 'Unavailable in partial snapshot';
}

function getRuleCount(value: unknown) {
  return Array.isArray(value) ? value.length : null;
}


export default async function FridayArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams;
  const snapshotA = typeof params.a === 'string' ? params.a : null;
  const snapshotB = typeof params.b === 'string' ? params.b : null;
  const showCompare = Boolean(snapshotA && snapshotB);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      <div>
        <div className="flex items-center gap-2 text-primary mb-1 text-xs font-bold uppercase tracking-wider">
          <CalendarDays className="w-4 h-4" />
          <span>Friday Archive</span>
        </div>
        <h1 data-display="true" className="text-3xl font-bold tracking-tight text-white italic">Frozen Fridays</h1>
        <p className="text-sm text-muted-foreground mt-1">A vertical timeline of frozen weeks, with optional side-by-side comparison.</p>
      </div>

      {showCompare && snapshotA && snapshotB && (
        <Suspense fallback={<CompareSkeleton />}>
          <CompareSection a={snapshotA} b={snapshotB} />
        </Suspense>
      )}

      <Suspense fallback={<TimelineSkeleton />}>
        <TimelineSection />
      </Suspense>
    </div>
  );
}

async function TimelineSection() {
  const envelope = await getFridaySnapshots();
  const snapshots = isReady(envelope) ? envelope.snapshots : [];

  if (snapshots.length === 0) {
    return (
      <div className="space-y-3">
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">No Fridays frozen yet. Start your first ritual.</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {snapshots.map((snapshot, index) => (
        <div key={snapshot.snapshotDate} className="grid gap-4 lg:grid-cols-[80px_1fr]">
          <div className="flex flex-col items-center pt-4">
            <span className="h-3 w-3 rounded-full bg-primary" />
            {index < snapshots.length - 1 && <span className="mt-2 h-full w-px bg-border" />}
          </div>
          <Link href={`/friday/${snapshot.snapshotDate}`}>
            <Card className="hover:ring-1 hover:ring-primary/30">
              <CardHeader>
                <CardDescription>{snapshot.snapshotDate}</CardDescription>
                <CardTitle className="text-white flex items-center justify-between gap-3">
                  <span>Score {snapshot.score ?? '—'}</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span>Status {snapshot.status ?? '—'}</span>
                <span>{snapshot.metadata.partial ? 'Partial' : 'Complete'}</span>
                <span>{snapshot.decisions.length} decision{snapshot.decisions.length === 1 ? '' : 's'}</span>
                <span>{snapshot.createdAt ? new Date(snapshot.createdAt).toLocaleString() : '—'}</span>
              </CardContent>
            </Card>
          </Link>
        </div>
      ))}
    </div>
  );
}

async function CompareSection({ a, b }: { a: string; b: string }) {
  const envelope = await compareFridaySnapshots(a, b);
  if (!isReady(envelope) || !envelope.comparison) {
    return (
      <div className="rounded-lg border border-border/40 p-4 text-sm text-muted-foreground">
        선택한 두 스냅샷 중 하나 이상이 없어서 비교할 수 없어요.
      </div>
    );
  }
  return <CompareCards comparison={envelope.comparison} />;
}

function CompareCards({ comparison }: { comparison: FridayComparison }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-white">{comparison.snapshotA.snapshotDate}</CardTitle>
          <CardDescription>
            Score {formatOptionalScore(comparison.snapshotA.frozenReport?.score?.total)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Value: {formatOptionalCurrency(comparison.snapshotA.frozenReport?.portfolioSnapshot?.totalValueKRW)}</p>
          <p>Regime: {formatOptionalText(comparison.snapshotA.frozenReport?.macroSnapshot?.overallState)}</p>
          <p>Rules: {getRuleCount(comparison.snapshotA.frozenReport?.triggeredRules) ?? 'Unavailable in partial snapshot'}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-white">{comparison.snapshotB.snapshotDate}</CardTitle>
          <CardDescription>
            Score {formatOptionalScore(comparison.snapshotB.frozenReport?.score?.total)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Value: {formatOptionalCurrency(comparison.snapshotB.frozenReport?.portfolioSnapshot?.totalValueKRW)}</p>
          <p>Regime: {formatOptionalText(comparison.snapshotB.frozenReport?.macroSnapshot?.overallState)}</p>
          <p>Rules: {getRuleCount(comparison.snapshotB.frozenReport?.triggeredRules) ?? 'Unavailable in partial snapshot'}</p>
        </CardContent>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2"><GitCompareArrows className="w-4 h-4 text-primary" /> Comparison</CardTitle>
          <CardDescription>What changed between the two frozen Fridays.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 text-sm">
          <div className="rounded-lg bg-background p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Score delta</p>
            <p className="text-white font-semibold">{comparison.deltas.score_total >= 0 ? '+' : ''}{comparison.deltas.score_total}</p>
          </div>
          <div className="rounded-lg bg-background p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Value delta</p>
            <p className="text-white font-semibold">{formatCurrency(comparison.deltas.total_value)}</p>
          </div>
          <div className="rounded-lg bg-background p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Regime change</p>
            <p className="text-white font-semibold">{comparison.deltas.regime_change.from ?? '—'} → {comparison.deltas.regime_change.to ?? '—'}</p>
          </div>
          <div className="rounded-lg bg-background p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Rules added</p>
            <p className="text-white font-semibold">{comparison.deltas.rules_added.join(', ') || 'None'}</p>
          </div>
          <div className="rounded-lg bg-background p-4 md:col-span-2 xl:col-span-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Holdings changed</p>
            {comparison.deltas.holdings_changed.length === 0 ? (
              <p className="text-white font-semibold mt-2">No weight changes</p>
            ) : (
              <div className="mt-2 space-y-1 text-white">
                {comparison.deltas.holdings_changed.map((item) => (
                  <p key={item.symbol}>
                    {item.symbol}: {(item.weight_a * 100).toFixed(1)}% → {(item.weight_b * 100).toFixed(1)}% ({item.delta >= 0 ? '+' : ''}{(item.delta * 100).toFixed(1)}%)
                  </p>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function TimelineSkeleton() {
  return <SkeletonList count={8} itemShape="card" />;
}

function CompareSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard className="lg:col-span-2 h-48" />
    </div>
  );
}
