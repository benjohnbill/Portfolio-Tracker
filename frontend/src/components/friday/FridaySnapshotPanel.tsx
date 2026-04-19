import Link from 'next/link';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { FridaySnapshot, WeeklyReport } from '@/lib/api';
import { CalendarDays, ChevronLeft, GitCompareArrows, ShieldAlert, TrendingUp } from 'lucide-react';


function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(value ?? 0);
}

function formatPercent(value: number | null | undefined) {
  return `${((value ?? 0) * 100).toFixed(1)}%`;
}

interface FridaySnapshotPanelProps {
  report: WeeklyReport;
  eyebrow: string;
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  decisions?: FridaySnapshot['decisions'];
  // Phase D A7 — surfaced at the top of the panel as an italic quote when non-empty.
  comment?: string | null;
}

export function FridaySnapshotPanel({
  report,
  eyebrow,
  title,
  description,
  backHref,
  backLabel,
  decisions = [],
  comment = null,
}: FridaySnapshotPanelProps) {
  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary mb-1 text-xs font-bold uppercase tracking-wider">
            <CalendarDays className="w-4 h-4" />
            <span>{eyebrow}</span>
          </div>
          <h1 data-display="true" className="text-3xl font-bold tracking-tight text-white italic">{title}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {description || `Week Ending ${report.weekEnding} · Generated ${new Date(report.generatedAt).toLocaleString()}`}
          </p>
        </div>
        {backHref && backLabel && (
          <Link href={backHref} className="text-sm text-muted-foreground hover:text-white flex items-center gap-2">
            <ChevronLeft className="w-4 h-4" /> {backLabel}
          </Link>
        )}
      </div>

      {comment && (
        <div className="rounded-lg border-l-2 border-primary/60 bg-background/40 px-4 py-3">
          <p className="text-sm text-white/90 italic">&ldquo;{comment}&rdquo;</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Weekly comment</p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-4">
          <CardHeader className="pb-3">
            <CardDescription>Snapshot Score</CardDescription>
            <CardTitle data-mono="true" className="text-4xl text-white">{report.score?.total ?? '—'}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="rounded-full bg-white/5 px-3 py-1.5">Fit {report.score?.fit ?? '—'}</span>
            <span className="rounded-full bg-white/5 px-3 py-1.5">Alignment {report.score?.alignment ?? '—'}</span>
            <span className="rounded-full bg-white/5 px-3 py-1.5">Posture {report.score?.postureDiversification ?? '—'}</span>
          </CardContent>
        </Card>

        <Card className="lg:col-span-4">
          <CardHeader className="pb-3">
            <CardDescription>Portfolio State</CardDescription>
            <CardTitle className="text-white text-2xl">{formatCurrency(report.portfolioSnapshot?.totalValueKRW)}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm md:grid-cols-2">
            <div className="rounded-lg bg-background p-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Invested</p>
              <p className="text-white font-semibold">{formatCurrency(report.portfolioSnapshot?.investedCapitalKRW)}</p>
            </div>
            <div className="rounded-lg bg-background p-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Regime</p>
              <p className="text-white font-semibold">{report.macroSnapshot?.overallState ?? 'Unknown'}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-4">
          <CardHeader className="pb-3">
            <CardDescription>Recommendation</CardDescription>
            <CardTitle className="text-white text-2xl">{report.recommendation?.stance?.replaceAll('_', ' ') ?? '—'}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {(report.recommendation?.rationale ?? []).slice(0, 2).map((item) => (
              <p key={item}>{item}</p>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-7 space-y-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> Allocation</CardTitle>
              <CardDescription>Frozen allocation and target drift at snapshot time.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(report.portfolioSnapshot?.allocation ?? []).map((holding) => {
                const drift = (report.portfolioSnapshot?.targetDeviation ?? []).find((item) => item.category === holding.asset);
                const relatedRules = (report.triggeredRules ?? []).filter((rule) => rule.affectedSleeves?.includes(holding.asset));
                return (
                  <details key={holding.asset} className="rounded-lg bg-background px-4 py-3 group">
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
                        <p className="text-xs uppercase tracking-wider text-muted-foreground">Weight drift</p>
                        <p className="text-white font-semibold">{drift ? formatPercent(drift.deviation) : 'N/A'}</p>
                      </div>
                      <div className="rounded-lg bg-card p-3">
                        <p className="text-xs uppercase tracking-wider text-muted-foreground">Target weight</p>
                        <p className="text-white font-semibold">{drift ? formatPercent(drift.targetWeight) : 'N/A'}</p>
                      </div>
                      <div className="rounded-lg bg-card p-3">
                        <p className="text-xs uppercase tracking-wider text-muted-foreground">Related signal</p>
                        <p className="text-white font-semibold">{relatedRules[0]?.ruleId ?? 'None'}</p>
                      </div>
                    </div>
                  </details>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2"><GitCompareArrows className="w-4 h-4 text-primary" /> Triggered Rules</CardTitle>
              <CardDescription>Signals frozen into this ritual.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(report.triggeredRules ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No triggered rules in this snapshot.</p>
              ) : (report.triggeredRules ?? []).map((rule) => (
                <div key={rule.ruleId} className="rounded-lg bg-background px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{rule.ruleId}</p>
                      <p className="text-xs text-muted-foreground mt-1">{rule.message}</p>
                    </div>
                    <span className="rounded-full px-3 py-1 text-[10px] font-bold uppercase bg-primary/15 text-primary">
                      {rule.severity}
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-5 space-y-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2"><ShieldAlert className="w-4 h-4 text-primary" /> Macro Regime</CardTitle>
              <CardDescription>Frozen macro read for the week.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(report.macroSnapshot?.buckets ?? []).map((bucket) => (
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
              <CardTitle className="text-white">Decision Journal</CardTitle>
              <CardDescription>What you wrote down after freezing the week.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {decisions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No decisions recorded for this snapshot yet.</p>
              ) : decisions.map((decision) => (
                <div key={decision.id} className="rounded-lg bg-background px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">{decision.decisionType}</p>
                    <span className="rounded-full px-3 py-1 text-[10px] font-bold uppercase bg-white/5 text-muted-foreground">
                      Conf {decision.confidenceVsSpyRiskadj}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">{decision.note}</p>
                  {(decision.confidenceVsCash != null || decision.confidenceVsSpyPure != null) && (
                    <p className="text-[11px] text-muted-foreground/80 mt-1">
                      vs Cash {decision.confidenceVsCash ?? '—'} · vs SPY Pure {decision.confidenceVsSpyPure ?? '—'}
                    </p>
                  )}
                  {decision.invalidation && <p className="text-xs text-white/70 mt-2">Invalidation: {decision.invalidation}</p>}
                  {(decision.expectedFailureMode || decision.triggerThreshold != null) && (
                    <p className="text-[11px] text-muted-foreground/80 mt-1">
                      {decision.expectedFailureMode && <>Mode: <span className="text-white/80">{decision.expectedFailureMode}</span></>}
                      {decision.expectedFailureMode && decision.triggerThreshold != null && ' · '}
                      {decision.triggerThreshold != null && <>Threshold: <span className="text-white/80">{decision.triggerThreshold}</span></>}
                    </p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
