"use client";

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { FridaySnapshot, FridaySnapshotSummary, WeeklyReport } from '@/lib/api';
import { createFridayDecision, createFridaySnapshot } from '@/lib/api';
import { CalendarDays, CheckCircle2, Clock3, GitCompareArrows, ShieldAlert, Sparkles } from 'lucide-react';


function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(value ?? 0);
}

function formatPercent(value: number | null | undefined) {
  return `${((value ?? 0) * 100).toFixed(1)}%`;
}

function humanizeLabel(value: string) {
  return value.replaceAll('_', ' ');
}

interface FridayDashboardProps {
  report: WeeklyReport;
  snapshots: FridaySnapshotSummary[];
  currentSnapshot: FridaySnapshot | null;
}

export function FridayDashboard({ report, snapshots, currentSnapshot }: FridayDashboardProps) {
  const router = useRouter();
  const [freezeState, setFreezeState] = useState<'idle' | 'working' | 'done'>('idle');
  const [freezeMessage, setFreezeMessage] = useState<string>('Ready to freeze this Friday.');
  const [freezeError, setFreezeError] = useState<string | null>(null);
  const [decisionState, setDecisionState] = useState<'idle' | 'saving'>('idle');
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [decisionDraft, setDecisionDraft] = useState({
    decision_type: 'hold',
    asset_ticker: '',
    note: '',
    confidence: 5,
    invalidation: '',
  });

  const latestSnapshot = snapshots[0] ?? null;
  const scoreDelta = latestSnapshot?.score != null ? report.score.total - latestSnapshot.score : null;
  const isFrozen = currentSnapshot?.snapshotDate === report.weekEnding;
  const freezeButtonLabel = isFrozen ? 'Already frozen' : freezeState === 'working' ? 'Freezing...' : freezeState === 'done' ? 'Frozen' : 'Freeze Friday';

  const signalCount = useMemo(() => (report.triggeredRules ?? []).length, [report.triggeredRules]);

  async function handleFreeze() {
    setFreezeError(null);
    setFreezeState('working');
    setFreezeMessage('Fetching portfolio...');

    try {
      await new Promise((resolve) => setTimeout(resolve, 150));
      setFreezeMessage('Building weekly snapshot...');
      await new Promise((resolve) => setTimeout(resolve, 150));
      setFreezeMessage('Saving snapshot...');
      await createFridaySnapshot(report.weekEnding);
      setFreezeState('done');
      setFreezeMessage('Frozen successfully.');
      setTimeout(() => {
        router.refresh();
      }, 250);
    } catch (error) {
      setFreezeState('idle');
      setFreezeError(error instanceof Error ? error.message : 'Failed to freeze Friday snapshot');
      setFreezeMessage('Ready to freeze this Friday.');
    }
  }

  async function handleDecisionSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentSnapshot) {
      setDecisionError('Freeze this Friday first to attach a decision.');
      return;
    }

    setDecisionState('saving');
    setDecisionError(null);

    try {
      await createFridayDecision({
        snapshot_id: currentSnapshot.id,
        decision_type: decisionDraft.decision_type,
        asset_ticker: decisionDraft.asset_ticker || undefined,
        note: decisionDraft.note,
        confidence: decisionDraft.confidence,
        invalidation: decisionDraft.invalidation || undefined,
      });
      setDecisionDraft({
        decision_type: 'hold',
        asset_ticker: '',
        note: '',
        confidence: 5,
        invalidation: '',
      });
      router.refresh();
    } catch (error) {
      setDecisionError(error instanceof Error ? error.message : 'Failed to save decision');
    } finally {
      setDecisionState('idle');
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-primary mb-1 text-xs font-bold uppercase tracking-wider">
            <CalendarDays className="w-4 h-4" />
            <span>Friday</span>
          </div>
          <h1 data-display="true" className="text-3xl font-bold tracking-tight text-white italic">Friday Time Machine</h1>
          <p className="text-sm text-muted-foreground mt-1">Freeze the week, compare to prior Fridays, and log what you think happens next.</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {isFrozen && (
            <span className="rounded-full bg-primary/15 px-3 py-1.5 font-bold uppercase text-primary">✓ Frozen</span>
          )}
          <span className="rounded-full bg-white/5 px-3 py-1.5">Week Ending {report.weekEnding}</span>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardDescription>Hero strip</CardDescription>
            <CardTitle data-mono="true" className="text-white text-5xl">{report.score.total}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3 text-xs">
            <span className="rounded-full bg-white/5 px-3 py-1.5 text-muted-foreground">Regime {report.macroSnapshot.overallState}</span>
            <span className="rounded-full bg-white/5 px-3 py-1.5 text-muted-foreground">Signals {signalCount}</span>
            <span className={`rounded-full px-3 py-1.5 font-semibold ${scoreDelta == null ? 'bg-white/5 text-muted-foreground' : scoreDelta >= 0 ? 'bg-primary/15 text-primary' : 'bg-red-500/15 text-red-300'}`}>
              Δ {scoreDelta == null ? '—' : `${scoreDelta >= 0 ? '+' : ''}${scoreDelta}`}
            </span>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2"><Clock3 className="w-4 h-4 text-primary" /> Freeze status</CardTitle>
            <CardDescription>{freezeMessage}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="grid gap-3 md:grid-cols-3">
              <div className={`rounded-lg px-3 py-3 ${freezeState === 'working' || freezeState === 'done' ? 'bg-primary/10 text-primary' : 'bg-background'}`}>Fetching portfolio</div>
              <div className={`rounded-lg px-3 py-3 ${freezeState === 'working' || freezeState === 'done' ? 'bg-primary/10 text-primary' : 'bg-background'}`}>Building snapshot</div>
              <div className={`rounded-lg px-3 py-3 ${freezeState === 'done' ? 'bg-primary/10 text-primary' : 'bg-background'}`}>Saving snapshot</div>
            </div>
            {freezeError && <p className="text-red-300">{freezeError}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-white text-lg">Freeze</CardTitle>
            <CardDescription>Terminal action after reviewing the week.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full" onClick={handleFreeze} disabled={freezeState === 'working' || isFrozen}>
              {freezeButtonLabel}
            </Button>
            {isFrozen && currentSnapshot && (
              <Link href={`/friday/${currentSnapshot.snapshotDate}`} className="block text-center text-xs text-primary hover:text-primary/80">
                Open frozen snapshot
              </Link>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-7 space-y-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Portfolio delta</CardTitle>
              <CardDescription>Current allocation, drift, and drill-down context.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(report.portfolioSnapshot.allocation ?? []).length === 0 ? (
                <div className="rounded-lg bg-background px-4 py-5 text-sm text-muted-foreground">
                  <p className="text-white font-semibold">Your first Friday ritual.</p>
                  <p className="mt-1">Freeze this week to capture the first snapshot and start building decision memory.</p>
                </div>
              ) : (report.portfolioSnapshot.allocation ?? []).map((holding) => {
                const drift = (report.portfolioSnapshot.targetDeviation ?? []).find((item) => item.category === holding.asset);
                const relatedRule = (report.triggeredRules ?? []).find((rule) => rule.affectedSleeves?.includes(holding.asset));
                return (
                  <details key={holding.asset} className="rounded-lg bg-background px-4 py-3">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{holding.asset}</p>
                        <p className="text-xs text-muted-foreground">{holding.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-white">{formatPercent(holding.weight)}</p>
                        <p className="text-xs text-muted-foreground">{formatCurrency(holding.value)}</p>
                      </div>
                    </summary>
                    <div className="mt-4 grid gap-3 md:grid-cols-3 text-sm">
                      <div className="rounded-lg bg-card p-3">
                        <p className="text-xs uppercase tracking-wider text-muted-foreground">Weight delta</p>
                        <p className="text-white font-semibold">{drift ? formatPercent(drift.deviation) : 'N/A'}</p>
                      </div>
                      <div className="rounded-lg bg-card p-3">
                        <p className="text-xs uppercase tracking-wider text-muted-foreground">Target</p>
                        <p className="text-white font-semibold">{drift ? formatPercent(drift.targetWeight) : 'N/A'}</p>
                      </div>
                      <div className="rounded-lg bg-card p-3">
                        <p className="text-xs uppercase tracking-wider text-muted-foreground">Related signal</p>
                        <p className="text-white font-semibold">{relatedRule?.ruleId ?? 'None'}</p>
                      </div>
                    </div>
                  </details>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2"><GitCompareArrows className="w-4 h-4 text-primary" /> Signals</CardTitle>
              <CardDescription>Expand to inspect why the rule fired.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(report.triggeredRules ?? []).length === 0 ? (
                <div className="rounded-lg bg-background px-4 py-5 text-sm text-muted-foreground">
                  <p className="text-white font-semibold">No triggered rules this week.</p>
                  <p className="mt-1">The model read is stable enough that nothing crossed a threshold.</p>
                </div>
              ) : (report.triggeredRules ?? []).map((rule) => (
                <details key={rule.ruleId} className="rounded-lg bg-background px-4 py-3">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{rule.ruleId}</p>
                      <p className="text-xs text-muted-foreground mt-1">{rule.message}</p>
                    </div>
                    <span className="rounded-full px-3 py-1 text-[10px] font-bold uppercase bg-primary/15 text-primary">{rule.severity}</span>
                  </summary>
                  <div className="mt-4 rounded-lg bg-card p-3 text-sm text-muted-foreground">
                    <p>Source: <span className="text-white">{rule.source}</span></p>
                    <p className="mt-2">Affected sleeves: <span className="text-white">{rule.affectedSleeves.join(', ') || 'None'}</span></p>
                  </div>
                </details>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-5 space-y-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2"><ShieldAlert className="w-4 h-4 text-primary" /> Macro regime</CardTitle>
              <CardDescription>How the week reads before you write anything down.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(report.macroSnapshot.buckets ?? []).length === 0 ? (
                <div className="rounded-lg bg-background px-4 py-5 text-sm text-muted-foreground">
                  <p className="text-white font-semibold">Macro data unavailable.</p>
                  <p className="mt-1">This section will populate when the weekly macro snapshot is available.</p>
                </div>
              ) : (report.macroSnapshot.buckets ?? []).map((bucket) => (
                <div key={bucket.bucket} className="rounded-lg bg-background px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">{bucket.bucket}</p>
                    <span className="rounded-full px-3 py-1 text-[10px] font-bold uppercase bg-white/5 text-muted-foreground">{bucket.state}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">{bucket.summary}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-white">Decision journal</CardTitle>
              <CardDescription>Freeze first, then record what you believe and why.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form className="space-y-4" onSubmit={handleDecisionSubmit}>
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wider text-muted-foreground">Decision type</label>
                  <select
                    className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-white"
                    value={decisionDraft.decision_type}
                    onChange={(event) => setDecisionDraft((current) => ({ ...current, decision_type: event.target.value }))}
                  >
                    {['hold', 'rebalance', 'buy', 'sell', 'reduce_risk', 'watch'].map((option) => (
                      <option key={option} value={option} className="bg-card">{humanizeLabel(option)}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wider text-muted-foreground">Ticker</label>
                  <Input value={decisionDraft.asset_ticker} onChange={(event) => setDecisionDraft((current) => ({ ...current, asset_ticker: event.target.value }))} placeholder="QQQ" />
                </div>

                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wider text-muted-foreground">Note</label>
                  <textarea
                    value={decisionDraft.note}
                    onChange={(event) => setDecisionDraft((current) => ({ ...current, note: event.target.value }))}
                    placeholder="What are you seeing this week?"
                    className="min-h-28 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-white outline-none focus-visible:border-ring"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wider text-muted-foreground">Confidence {decisionDraft.confidence}</label>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={decisionDraft.confidence}
                    onChange={(event) => setDecisionDraft((current) => ({ ...current, confidence: Number(event.target.value) }))}
                    className="w-full accent-[hsl(var(--primary))]"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wider text-muted-foreground">Invalidation</label>
                  <textarea
                    value={decisionDraft.invalidation}
                    onChange={(event) => setDecisionDraft((current) => ({ ...current, invalidation: event.target.value }))}
                    placeholder="What would change your mind?"
                    className="min-h-20 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-white outline-none focus-visible:border-ring"
                  />
                </div>

                {decisionError && <p className="text-sm text-red-300">{decisionError}</p>}

                <Button type="submit" className="w-full bg-[#D4A574] text-[#0a0e14] hover:bg-[#D4A574]/90" disabled={decisionState === 'saving'}>
                  {decisionState === 'saving' ? 'Saving...' : currentSnapshot ? 'Save decision' : 'Freeze first to save'}
                </Button>
              </form>

              <div className="space-y-3 pt-2">
                {(currentSnapshot?.decisions ?? []).length === 0 ? (
                  <div className="rounded-lg bg-background px-4 py-5 text-sm text-muted-foreground">
                    <p className="text-white font-semibold">No decisions recorded yet.</p>
                    <p className="mt-1">Freeze first, then write down what you think happens next and what would change your mind.</p>
                  </div>
                ) : (currentSnapshot?.decisions ?? []).map((decision) => (
                  <div key={decision.id} className="rounded-lg bg-background px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-white">{decision.decisionType || decision.decision_type}</p>
                      <span className="rounded-full bg-white/5 px-3 py-1 text-[10px] font-bold uppercase text-muted-foreground">Confidence {decision.confidence}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">{decision.note}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary" /> Archive access</CardTitle>
              <CardDescription>Jump into earlier Fridays or compare two frozen weeks.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Link href="/friday/archive" className="block rounded-lg bg-background px-4 py-3 text-white hover:bg-accent">Open Friday archive</Link>
              {latestSnapshot && latestSnapshot.snapshotDate !== report.weekEnding && (
                <Link href={`/friday/archive?a=${latestSnapshot.snapshotDate}&b=${report.weekEnding}`} className="block rounded-lg bg-background px-4 py-3 text-white hover:bg-accent">Compare live week against latest frozen Friday</Link>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
