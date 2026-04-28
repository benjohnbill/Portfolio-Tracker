"use client";

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { ExecutionSlippage, FridaySnapshot, FridaySnapshotSummary, WeeklyReport } from '@/lib/api';
import { revalidateMacroContext } from '@/app/friday/actions';
import { createFridayDecision, createFridaySlippage, createFridaySnapshot } from '@/lib/api';
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

function orderingDeviationNote(
  riskadj: number,
  cash: number,
  pure: number,
): string | null {
  // Expected portfolio design intent: #1 >= #2 >= #3.
  // Deviation is an observation (logged for calibration), not a warning.
  if (riskadj < cash || cash < pure) {
    return 'Expected #1 ≥ #2 ≥ #3 — your ordering deviates. Logged for calibration.';
  }
  return null;
}

interface SlippageDraft {
  executed_at: string;
  executed_price: string;
  executed_qty: string;
  notes: string;
}
const EMPTY_SLIPPAGE: SlippageDraft = { executed_at: '', executed_price: '', executed_qty: '', notes: '' };

interface FridayDashboardProps {
  report: WeeklyReport;
  snapshots: FridaySnapshotSummary[];
  currentSnapshot: FridaySnapshot | null;
}

// Phase UX-1a D3: Briefing (SinceLastFridayBriefing) and Sleeve Health
// (SleeveHealthPanel) used to be rendered inside this component. They were
// moved out so each panel can be its own RSC async child with an independent
// Suspense boundary — see app/friday/page.tsx.
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
    // Phase D A3 — primary required; siblings optional.
    confidence_vs_spy_riskadj: 5,
    confidence_vs_cash: 5,
    confidence_vs_spy_pure: 5,
    invalidation: '',
    // Phase D A4 — structured invalidation.
    expected_failure_mode: '',
    trigger_threshold: '',
  });

  // Phase D A7 — optional per-freeze observation. Separate from decision draft
  // because it is tied to the freeze action, not per-decision state.
  const [snapshotComment, setSnapshotComment] = useState('');

  const [slippageDrafts, setSlippageDrafts] = useState<Record<number, SlippageDraft>>({});
  const [slippageState, setSlippageState] = useState<Record<number, 'idle' | 'saving' | 'error'>>({});
  const [slippageError, setSlippageError] = useState<Record<number, string>>({});

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
      await createFridaySnapshot(report.weekEnding, snapshotComment.trim() || undefined);
      await revalidateMacroContext();
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
      const parsedThreshold = decisionDraft.trigger_threshold.trim();
      await createFridayDecision({
        snapshot_id: currentSnapshot.id,
        decision_type: decisionDraft.decision_type,
        asset_ticker: decisionDraft.asset_ticker || undefined,
        note: decisionDraft.note,
        confidence_vs_spy_riskadj: decisionDraft.confidence_vs_spy_riskadj,
        confidence_vs_cash: decisionDraft.confidence_vs_cash,
        confidence_vs_spy_pure: decisionDraft.confidence_vs_spy_pure,
        invalidation: decisionDraft.invalidation || undefined,
        expected_failure_mode: decisionDraft.expected_failure_mode || undefined,
        trigger_threshold: parsedThreshold ? Number(parsedThreshold) : undefined,
      });
      setDecisionDraft({
        decision_type: 'hold',
        asset_ticker: '',
        note: '',
        confidence_vs_spy_riskadj: 5,
        confidence_vs_cash: 5,
        confidence_vs_spy_pure: 5,
        invalidation: '',
        expected_failure_mode: '',
        trigger_threshold: '',
      });
      router.refresh();
    } catch (error) {
      setDecisionError(error instanceof Error ? error.message : 'Failed to save decision');
    } finally {
      setDecisionState('idle');
    }
  }

  async function handleSlippageSubmit(decisionId: number, e: React.FormEvent) {
    e.preventDefault();
    const draft = slippageDrafts[decisionId] ?? EMPTY_SLIPPAGE;
    if (!draft.executed_at && !draft.executed_price && !draft.executed_qty && !draft.notes) {
      return;
    }
    setSlippageState(prev => ({ ...prev, [decisionId]: 'saving' }));
    try {
      await createFridaySlippage({
        decision_id: decisionId,
        executed_at: draft.executed_at || undefined,
        executed_price: draft.executed_price ? Number(draft.executed_price) : undefined,
        executed_qty: draft.executed_qty ? Number(draft.executed_qty) : undefined,
        notes: draft.notes || undefined,
      });
      setSlippageDrafts(prev => ({ ...prev, [decisionId]: EMPTY_SLIPPAGE }));
      setSlippageError(prev => ({ ...prev, [decisionId]: '' }));
      setSlippageState(prev => ({ ...prev, [decisionId]: 'idle' }));
      router.refresh();
    } catch (err) {
      setSlippageState(prev => ({ ...prev, [decisionId]: 'error' }));
      setSlippageError(prev => ({ ...prev, [decisionId]: err instanceof Error ? err.message : 'Failed to save. Try again.' }));
    }
  }

  return (
    <div className="space-y-8 pb-12">
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
            <details className="rounded-md border border-border/50 bg-background/40 px-3 py-2 text-xs text-muted-foreground">
              <summary className="cursor-pointer select-none text-white/80">💬 이번 주 코멘트 (선택)</summary>
              <textarea
                value={snapshotComment}
                onChange={(event) => setSnapshotComment(event.target.value)}
                placeholder="1–2 줄 관찰 (비워두면 저장되지 않음)."
                className="mt-2 min-h-16 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-white outline-none focus-visible:border-ring"
                disabled={freezeState === 'working' || isFrozen}
              />
            </details>
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

                <div className="space-y-3 rounded-lg border border-border/50 bg-background/50 px-3 py-3">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Confidence (1–10)</p>

                  <div className="space-y-1">
                    <label className="text-[11px] text-muted-foreground">
                      vs SPY Risk-adj <span className="text-primary">{decisionDraft.confidence_vs_spy_riskadj}</span>
                      <span className="ml-2 text-[10px] text-muted-foreground/70">primary</span>
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={decisionDraft.confidence_vs_spy_riskadj}
                      onChange={(event) => setDecisionDraft((current) => ({ ...current, confidence_vs_spy_riskadj: Number(event.target.value) }))}
                      className="w-full accent-[hsl(var(--primary))]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-muted-foreground">
                      vs Cash <span className="text-primary">{decisionDraft.confidence_vs_cash}</span>
                      <span className="ml-2 text-[10px] text-muted-foreground/70">baseline</span>
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={decisionDraft.confidence_vs_cash}
                      onChange={(event) => setDecisionDraft((current) => ({ ...current, confidence_vs_cash: Number(event.target.value) }))}
                      className="w-full accent-[hsl(var(--primary))]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-muted-foreground">
                      vs SPY Pure <span className="text-primary">{decisionDraft.confidence_vs_spy_pure}</span>
                      <span className="ml-2 text-[10px] text-muted-foreground/70">stretch</span>
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={decisionDraft.confidence_vs_spy_pure}
                      onChange={(event) => setDecisionDraft((current) => ({ ...current, confidence_vs_spy_pure: Number(event.target.value) }))}
                      className="w-full accent-[hsl(var(--primary))]"
                    />
                  </div>

                  {(() => {
                    const note = orderingDeviationNote(
                      decisionDraft.confidence_vs_spy_riskadj,
                      decisionDraft.confidence_vs_cash,
                      decisionDraft.confidence_vs_spy_pure,
                    );
                    return note ? (
                      <p className="text-[11px] text-muted-foreground italic">{note}</p>
                    ) : null;
                  })()}
                </div>

                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wider text-muted-foreground">Invalidation (what would change your mind?)</label>
                  <textarea
                    value={decisionDraft.invalidation}
                    onChange={(event) => setDecisionDraft((current) => ({ ...current, invalidation: event.target.value }))}
                    placeholder="Free-text: conditions that would invalidate this thesis."
                    className="min-h-20 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-white outline-none focus-visible:border-ring"
                  />
                  <div className="grid gap-2 md:grid-cols-2">
                    <select
                      className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-white"
                      value={decisionDraft.expected_failure_mode}
                      onChange={(event) => setDecisionDraft((current) => ({ ...current, expected_failure_mode: event.target.value }))}
                    >
                      <option value="" className="bg-card">Failure mode (optional)</option>
                      <option value="price_drop" className="bg-card">price drop</option>
                      <option value="regime_shift" className="bg-card">regime shift</option>
                      <option value="correlation_breakdown" className="bg-card">correlation breakdown</option>
                      <option value="liquidity_crunch" className="bg-card">liquidity crunch</option>
                      <option value="other" className="bg-card">other</option>
                    </select>
                    <Input
                      type="number"
                      step="any"
                      value={decisionDraft.trigger_threshold}
                      onChange={(event) => setDecisionDraft((current) => ({ ...current, trigger_threshold: event.target.value }))}
                      placeholder="Trigger threshold (numeric, optional)"
                    />
                  </div>
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
                      <span className="rounded-full bg-white/5 px-3 py-1 text-[10px] font-bold uppercase text-muted-foreground">
                        Conf {decision.confidenceVsSpyRiskadj}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">{decision.note}</p>
                    {(decision.confidenceVsCash != null || decision.confidenceVsSpyPure != null) && (
                      <p className="text-[11px] text-muted-foreground/80 mt-1">
                        vs Cash {decision.confidenceVsCash ?? '—'} · vs SPY Pure {decision.confidenceVsSpyPure ?? '—'}
                      </p>
                    )}
                    {decision.invalidation && (
                      <p className="text-[11px] text-white/70 mt-2">Invalidation: {decision.invalidation}</p>
                    )}
                    {(decision.expectedFailureMode || decision.triggerThreshold != null) && (
                      <p className="text-[11px] text-muted-foreground/80 mt-1">
                        {decision.expectedFailureMode && <>Mode: <span className="text-white/80">{decision.expectedFailureMode}</span></>}
                        {decision.expectedFailureMode && decision.triggerThreshold != null && ' · '}
                        {decision.triggerThreshold != null && <>Threshold: <span className="text-white/80">{decision.triggerThreshold}</span></>}
                      </p>
                    )}
                    {(decision.slippageEntries ?? []).length > 0 && (
                      <div className="mt-2 space-y-1">
                        {(decision.slippageEntries ?? []).map((s: ExecutionSlippage) => (
                          <p key={s.id} className="text-[11px] text-muted-foreground/70">
                            Executed{s.executedAt ? ` ${s.executedAt}` : ''}{s.executedPrice != null ? ` @ ${s.executedPrice}` : ''}{s.executedQty != null ? ` × ${s.executedQty}` : ''}{s.notes ? ` — ${s.notes}` : ''}
                          </p>
                        ))}
                      </div>
                    )}
                    <details className="mt-2">
                      <summary className="cursor-pointer text-[11px] text-muted-foreground/60 hover:text-muted-foreground select-none">Log execution</summary>
                      <form
                        className="mt-2 space-y-2"
                        onSubmit={(e) => handleSlippageSubmit(decision.id, e)}
                      >
                        <div className="flex gap-2">
                          <input
                            type="date"
                            className="flex-1 rounded bg-background border border-border/50 px-2 py-1 text-[11px] text-white focus-visible:border-ring focus-visible:outline-none"
                            value={slippageDrafts[decision.id]?.executed_at ?? ''}
                            onChange={e => setSlippageDrafts(prev => ({ ...prev, [decision.id]: { ...(prev[decision.id] ?? EMPTY_SLIPPAGE), executed_at: e.target.value } }))}
                          />
                          <input
                            type="number"
                            step="any"
                            placeholder="Price"
                            className="w-24 rounded bg-background border border-border/50 px-2 py-1 text-[11px] text-white focus-visible:border-ring focus-visible:outline-none"
                            value={slippageDrafts[decision.id]?.executed_price ?? ''}
                            onChange={e => setSlippageDrafts(prev => ({ ...prev, [decision.id]: { ...(prev[decision.id] ?? EMPTY_SLIPPAGE), executed_price: e.target.value } }))}
                          />
                          <input
                            type="number"
                            step="any"
                            placeholder="Qty"
                            className="w-20 rounded bg-background border border-border/50 px-2 py-1 text-[11px] text-white focus-visible:border-ring focus-visible:outline-none"
                            value={slippageDrafts[decision.id]?.executed_qty ?? ''}
                            onChange={e => setSlippageDrafts(prev => ({ ...prev, [decision.id]: { ...(prev[decision.id] ?? EMPTY_SLIPPAGE), executed_qty: e.target.value } }))}
                          />
                        </div>
                        <input
                          type="text"
                          placeholder="Notes (optional)"
                          className="w-full rounded bg-background border border-border/50 px-2 py-1 text-[11px] text-white focus-visible:border-ring focus-visible:outline-none"
                          value={slippageDrafts[decision.id]?.notes ?? ''}
                          onChange={e => setSlippageDrafts(prev => ({ ...prev, [decision.id]: { ...(prev[decision.id] ?? EMPTY_SLIPPAGE), notes: e.target.value } }))}
                        />
                        <button
                          type="submit"
                          disabled={slippageState[decision.id] === 'saving'}
                          className="rounded bg-white/10 px-3 py-1 text-[11px] text-white hover:bg-white/20 disabled:opacity-50"
                        >
                          {slippageState[decision.id] === 'saving' ? 'Saving...' : 'Save'}
                        </button>
                        {slippageState[decision.id] === 'error' && (
                          <p className="text-[11px] text-red-300">{slippageError[decision.id] ?? 'Failed to save. Try again.'}</p>
                        )}
                      </form>
                    </details>
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
