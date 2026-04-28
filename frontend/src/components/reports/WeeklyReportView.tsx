import Link from 'next/link';
import { Suspense } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { WeeklyReport } from '@/lib/api';
import type { LucideIcon } from 'lucide-react';
import { AlertOctagon, AlertTriangle, BrainCircuit, CalendarRange, ChevronLeft, ShieldCheck, TrendingUp, Zap, Info, Clock, LineChart } from 'lucide-react';
import { AssetSignalSection } from '@/components/features/portfolio/AssetSignalSection';
import { MSTRSignalSection } from '@/components/features/portfolio/MSTRSignalSection';

// Mapping rules/assets to chart types
const ASSET_TO_TICKER: Record<string, string> = {
  'NDX': 'QQQ',
  'NDX_1X': 'QQQ',
  'NDX_2X': 'QQQ',
  'QQQ': 'QQQ',
  'TIGER_2X': 'QQQ',
  'KODEX_1X': 'QQQ',
  'GLDM': 'GLDM',
  'TLT': 'TLT',
  'ACE_TLT': 'TLT',
  'DBMF': 'DBMF',
  'MSTR': 'MSTR',
};

function getUniqueTickers(actions: any[]) {
  const tickers = new Set<string>();
  actions.forEach(action => {
    const ticker = ASSET_TO_TICKER[action.asset];
    if (ticker) tickers.add(ticker);
  });
  return Array.from(tickers);
}

// Small helper for MSTR naming consistency in this view
async function MSTRSignalSectionWrapper({ period }: { period: string }) {
  return <MSTRSignalSection period={period} />;
}

const SEVERITY_CONFIG: Record<string, { icon: LucideIcon; color: string; border: string; bg: string; badge: string; label: string }> = {
  critical: { icon: AlertOctagon, color: 'text-red-500', border: 'border-red-500/40', bg: 'bg-red-500/10', badge: 'bg-red-500/20 text-red-400', label: 'CRITICAL' },
  high: { icon: AlertTriangle, color: 'text-orange-400', border: 'border-orange-400/40', bg: 'bg-orange-400/10', badge: 'bg-orange-400/20 text-orange-300', label: 'HIGH' },
  medium: { icon: AlertTriangle, color: 'text-yellow-400', border: 'border-yellow-400/40', bg: 'bg-yellow-400/10', badge: 'bg-yellow-400/20 text-yellow-300', label: 'MEDIUM' },
  low: { icon: Info, color: 'text-blue-400', border: 'border-blue-400/40', bg: 'bg-blue-400/10', badge: 'bg-blue-400/20 text-blue-300', label: 'LOW' },
};

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return 'Unknown';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return '1d ago';
  return `${diffDays}d ago`;
}

function getFreshnessColor(dateString: string | null): string {
  if (!dateString) return 'text-muted-foreground';
  const date = new Date(dateString);
  const now = new Date();
  const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
  
  if (diffHours < 24) return 'text-green-400';
  if (diffHours < 72) return 'text-yellow-400';
  return 'text-red-400';
}


interface WeeklyReportViewProps {
  report: WeeklyReport;
  eyebrow: string;
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
}


export function WeeklyReportView({ report, eyebrow, title, description, backHref, backLabel }: WeeklyReportViewProps) {
  const hasActions = report.recommendation.actions.length > 0;
  const uniqueTickers = getUniqueTickers(report.recommendation.actions);
  
  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary mb-1 text-xs font-bold uppercase tracking-wider">
            <CalendarRange className="w-4 h-4" />
            <span>{eyebrow}</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white italic">{title}</h1>
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

      {/* Data Freshness Badge */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 bg-[#11161d] border border-border/40 rounded-full px-3 py-1.5">
            <Clock className="w-3 h-3 text-muted-foreground" />
            <span className="text-muted-foreground">Signals:</span>
            <span className={getFreshnessColor(report.dataFreshness.signalsAsOf)}>
              {formatRelativeTime(report.dataFreshness.signalsAsOf)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 bg-[#11161d] border border-border/40 rounded-full px-3 py-1.5">
            <Clock className="w-3 h-3 text-muted-foreground" />
            <span className="text-muted-foreground">Portfolio:</span>
            <span className={getFreshnessColor(report.dataFreshness.portfolioAsOf)}>
              {formatRelativeTime(report.dataFreshness.portfolioAsOf)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 bg-[#11161d] border border-border/40 rounded-full px-3 py-1.5">
            <Clock className="w-3 h-3 text-muted-foreground" />
            <span className="text-muted-foreground">Macro:</span>
            <span className={getFreshnessColor(report.dataFreshness.macroKnownAsOf)}>
              {formatRelativeTime(report.dataFreshness.macroKnownAsOf)}
            </span>
          </div>
          {report.dataFreshness.staleFlags.length > 0 && (
            <div className="flex items-center gap-1.5 bg-destructive/10 border border-destructive/30 rounded-full px-3 py-1.5 text-destructive">
              <AlertTriangle className="w-3 h-3" />
              <span>{report.dataFreshness.staleFlags.length} stale</span>
            </div>
          )}
        </div>
        {report.dataFreshness.portfolioValuation && (
          <p className="text-xs text-muted-foreground">
            Portfolio values from <span className="text-white/70 font-medium">{report.dataFreshness.portfolioValuation.source} {report.dataFreshness.portfolioValuation.version}</span> ({report.dataFreshness.portfolioValuation.period} period, as of {report.dataFreshness.portfolioValuation.asOf ? new Date(report.dataFreshness.portfolioValuation.asOf).toLocaleDateString() : 'unknown'})
          </p>
        )}
      </div>

      {/* Pinned Action Summary Card */}
      {hasActions && (
        <Card className="border-primary/50 bg-primary/5 shadow-lg shadow-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              This Week&apos;s Actions
            </CardTitle>
            <CardDescription>
              {report.recommendation.stance.replaceAll('_', ' ')} · {report.recommendation.actions.length} action{report.recommendation.actions.length > 1 ? 's' : ''} recommended
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              {report.recommendation.actions.map((action, index) => (
                <div key={`${action.asset}-${index}`} className="rounded-lg border border-border/40 bg-[#11161d]/50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-bold text-white flex items-center gap-2">
                        <span className="text-primary">⚡</span>
                        {action.asset}: {action.action}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{action.reason}</p>
                    </div>
                    {action.inputs && (
                      <div className="group relative">
                        <Info className="w-4 h-4 text-muted-foreground hover:text-primary cursor-help" />
                        <div className="absolute right-0 top-6 z-10 hidden group-hover:block w-64 p-3 rounded-lg border border-border/40 bg-[#0d1117] shadow-xl text-xs">
                          <p className="font-semibold text-white mb-2">Signal Inputs</p>
                          <div className="space-y-1 text-muted-foreground">
                            {action.inputs.z_score !== undefined && (
                              <p>Z-Score: <span className="text-white">{action.inputs.z_score.toFixed(2)}</span></p>
                            )}
                            {action.inputs.mnav_ratio !== undefined && (
                              <p>mNAV Ratio: <span className="text-white">{action.inputs.mnav_ratio.toFixed(2)}</span></p>
                            )}
                            {action.inputs.vxn_current !== undefined && (
                              <p>VXN: <span className="text-white">{action.inputs.vxn_current.toFixed(1)}</span></p>
                            )}
                            {action.inputs.thresholds && (
                              <div className="mt-1 pt-1 border-t border-border/20">
                                <p className="text-[10px] uppercase tracking-wider mb-1">Thresholds</p>
                                {Object.entries(action.inputs.thresholds).map(([key, value]) => (
                                  <p key={key}>{key}: <span className="text-white">{typeof value === 'number' ? value.toFixed(2) : value}</span></p>
                                ))}
                              </div>
                            )}
                            {action.inputs.triggered_by && (
                              <p className="mt-1 pt-1 border-t border-border/20">
                                Triggered by: <span className="text-primary">{action.inputs.triggered_by}</span>
                              </p>
                            )}
                          </div>
                          {action.rule_id && (
                            <p className="mt-2 pt-1 border-t border-border/20 text-[10px] text-muted-foreground">
                              Rule: {action.rule_id}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Contextual Evidence Charts */}
            {uniqueTickers.length > 0 && (
              <div className="space-y-4 pt-2 border-t border-border/20">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-primary/70 px-1">
                  <LineChart className="w-3 h-3" />
                  <span>Contextual Evidence</span>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {uniqueTickers.map(ticker => (
                    <div key={ticker} className="scale-[0.95] origin-top-left -mb-4">
                      <Suspense fallback={<div className="h-[200px] bg-accent/5 rounded-xl animate-pulse border border-border/20" />}>
                        {ticker === 'MSTR' ? (
                          <MSTRSignalSectionWrapper period="1y" />
                        ) : (
                          <AssetSignalSection 
                            ticker={ticker} 
                            title={`${ticker} Analysis`} 
                            description={`1Y Trend context for ${ticker}`} 
                            period="1y" 
                          />
                        )}
                      </Suspense>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-[#11161d] border-border/40">
          <CardHeader className="pb-2">
            <CardDescription>Total Score</CardDescription>
            <CardTitle className="text-3xl text-white">{report.score.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-[#11161d] border-border/40">
          <CardHeader className="pb-2">
            <CardDescription>Fit</CardDescription>
            <CardTitle className="text-3xl text-white">{report.score.fit}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-[#11161d] border-border/40">
          <CardHeader className="pb-2">
            <CardDescription>Alignment</CardDescription>
            <CardTitle className="text-3xl text-white">{report.score.alignment}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-[#11161d] border-border/40">
          <CardHeader className="pb-2">
            <CardDescription>Posture</CardDescription>
            <CardTitle className="text-3xl text-white">{report.score.postureDiversification}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {report.llmSummary && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2"><BrainCircuit className="w-4 h-4 text-primary" /> AI Summary</CardTitle>
            <CardDescription>{report.llmSummary.provider} · {report.llmSummary.model}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-white/85">
            <p className="font-semibold text-white">{report.llmSummary.headline}</p>
            <p>{report.llmSummary.whyScoreChanged}</p>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Key Changes</p>
              <ul className="space-y-1 list-disc pl-4">
                {report.llmSummary.keyChanges.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-7 space-y-8">
          <Card className="bg-[#11161d] border-border/40">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> Portfolio Snapshot</CardTitle>
              <CardDescription>Current weekly decision context</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Total Value</p>
                  <p className="text-2xl font-bold text-white">{new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(report.portfolioSnapshot.totalValueKRW)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Invested Capital</p>
                  <p className="text-2xl font-bold text-white">{new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(report.portfolioSnapshot.investedCapitalKRW)}</p>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2 text-sm">
                <div className="rounded-lg border border-border/40 p-3">
                  <p className="text-xs text-muted-foreground uppercase">CAGR</p>
                  <p className="text-white font-semibold">{formatPercent(report.portfolioSnapshot.metrics.cagr)}</p>
                </div>
                <div className="rounded-lg border border-border/40 p-3">
                  <p className="text-xs text-muted-foreground uppercase">MDD</p>
                  <p className="text-white font-semibold">{formatPercent(report.portfolioSnapshot.metrics.mdd)}</p>
                </div>
                <div className="rounded-lg border border-border/40 p-3">
                  <p className="text-xs text-muted-foreground uppercase">Volatility</p>
                  <p className="text-white font-semibold">{formatPercent(report.portfolioSnapshot.metrics.volatility)}</p>
                </div>
                <div className="rounded-lg border border-border/40 p-3">
                  <p className="text-xs text-muted-foreground uppercase">Sharpe Ratio</p>
                  <p className="text-white font-semibold">{report.portfolioSnapshot.metrics.sharpeRatio.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#11161d] border-border/40">
            <CardHeader>
              <CardTitle className="text-white">Macro Buckets</CardTitle>
              <CardDescription>Current regime interpretation for this week&apos;s decision</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {report.macroSnapshot.buckets.map((bucket) => (
                <div key={bucket.bucket} className="rounded-lg border border-border/40 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{bucket.bucket}</p>
                      <p className="text-xs text-muted-foreground">{bucket.summary}</p>
                    </div>
                    <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${bucket.state === 'supportive' ? 'bg-green-500/20 text-green-400' : bucket.state === 'adverse' ? 'bg-destructive/20 text-destructive' : 'bg-white/10 text-white/70'}`}>
                      {bucket.state}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-5 space-y-8">
          <Card className="bg-[#11161d] border-border/40">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-primary" /> Recommendation</CardTitle>
              <CardDescription>{report.recommendation.stance.replaceAll('_', ' ')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {report.recommendation.actions.map((action, index) => (
                <div key={`${action.asset}-${index}`} className="rounded-lg border border-border/40 p-3">
                  <p className="text-sm font-semibold text-white">{action.asset}: {action.action}</p>
                  <p className="text-xs text-muted-foreground mt-1">{action.reason}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-[#11161d] border-border/40">
            <CardHeader>
              <CardTitle className="text-white">Target Drift</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {report.portfolioSnapshot.targetDeviation.map((item) => (
                <div key={item.category} className="rounded-lg border border-border/40 p-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{item.category}</p>
                    <p className="text-xs text-muted-foreground">Current {(item.currentWeight * 100).toFixed(1)}% · Target {(item.targetWeight * 100).toFixed(1)}%</p>
                  </div>
                  <div className={`text-sm font-semibold ${item.needsRebalance ? 'text-destructive' : 'text-primary'}`}>
                    {(item.deviation * 100).toFixed(1)}%
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-[#11161d] border-border/40">
            <CardHeader>
              <CardTitle className="text-white">Triggered Rules</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {report.triggeredRules.length === 0 ? (
                <p className="text-sm text-muted-foreground">No triggered rules this week.</p>
              ) : report.triggeredRules.map((rule) => {
                const sev = SEVERITY_CONFIG[rule.severity] ?? SEVERITY_CONFIG.medium;
                const SevIcon = sev.icon;
                return (
                  <div key={rule.ruleId} className={`rounded-lg border ${sev.border} ${sev.bg} p-3`}>
                    <div className="flex items-center gap-2">
                      <SevIcon className={`w-4 h-4 ${sev.color}`} />
                      <span className="text-white font-semibold text-sm">{rule.ruleId}</span>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${sev.badge}`}>{sev.label}</span>
                      <span className="text-[10px] text-muted-foreground ml-auto">{rule.source}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{rule.message}</p>
                    {rule.affectedSleeves.length > 0 && (
                      <div className="flex gap-1 mt-1.5">
                        {rule.affectedSleeves.map((s) => (
                          <span key={s} className="text-[10px] bg-white/5 text-muted-foreground px-1.5 py-0.5 rounded">{s}</span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="bg-[#11161d] border-border/40">
            <CardHeader>
              <CardTitle className="text-white">Event Overlay</CardTitle>
              <CardDescription>{report.eventAnnotations.length === 0 ? 'No flagged event recorded this week.' : 'Only level 1/2 events are shown.'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {report.eventAnnotations.map((event) => (
                <div key={event.eventId} className="rounded-lg border border-border/40 p-3">
                  <p className="text-sm font-semibold text-white">{event.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{event.summary}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
