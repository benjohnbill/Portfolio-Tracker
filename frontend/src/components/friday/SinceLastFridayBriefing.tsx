"use client";

import { AlertTriangle, CheckCircle2, Clock3, MessageSquare } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { FridayBriefingData } from '@/lib/api';


interface SinceLastFridayBriefingProps {
  data: FridayBriefingData | null;
}

function formatPercent(value: number | null | undefined) {
  if (value == null) return '—';
  return `${(value * 100).toFixed(1)}%`;
}

export function SinceLastFridayBriefing({ data }: SinceLastFridayBriefingProps) {
  if (!data || data.sinceDate === null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Clock3 className="w-4 h-4 text-primary" /> Since Last Friday
          </CardTitle>
          <CardDescription>No prior freeze yet — start your first ritual to begin the weekly memory trail.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const hasContent =
    data.regimeTransitions.length > 0 ||
    data.maturedOutcomes.length > 0 ||
    data.alertHistory.failed > 0 ||
    data.alertHistory.success > 0 ||
    data.lastSnapshotComment != null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Clock3 className="w-4 h-4 text-primary" /> Since Last Friday
        </CardTitle>
        <CardDescription>Events since {data.sinceDate}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!hasContent && (
          <p className="text-sm text-muted-foreground">Nothing new since the prior freeze.</p>
        )}

        {data.regimeTransitions.length > 0 && (
          <div className="rounded-lg bg-background px-4 py-3 space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="w-3 h-3 text-amber-400" /> Regime transitions
            </p>
            {data.regimeTransitions.map((transition) => (
              <p key={transition.bucket} className="text-sm text-white">
                <span className="font-semibold">{transition.bucket}</span>
                <span className="text-muted-foreground"> {transition.from} → </span>
                <span className="text-white/90">{transition.to}</span>
              </p>
            ))}
          </div>
        )}

        {data.maturedOutcomes.length > 0 && (
          <div className="rounded-lg bg-background px-4 py-3 space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="w-3 h-3 text-primary" /> Matured outcomes ({data.maturedOutcomes.length})
            </p>
            {data.maturedOutcomes.slice(0, 5).map((outcome) => {
              const deltaSign = (outcome.outcomeDeltaPct ?? 0) >= 0 ? '+' : '';
              const colorClass = (outcome.outcomeDeltaPct ?? 0) >= 0 ? 'text-primary' : 'text-red-300';
              return (
                <p key={`${outcome.decisionId}-${outcome.horizon}`} className="text-sm text-muted-foreground">
                  <span className="text-white font-semibold">
                    {outcome.decisionType ?? 'decision'} {outcome.assetTicker ?? ''}
                  </span>
                  <span> · {outcome.horizon} · </span>
                  <span className={colorClass}>{deltaSign}{formatPercent(outcome.outcomeDeltaPct)}</span>
                </p>
              );
            })}
            {data.maturedOutcomes.length > 5 && (
              <p className="text-[11px] text-muted-foreground/70">+ {data.maturedOutcomes.length - 5} more</p>
            )}
          </div>
        )}

        {(data.alertHistory.success > 0 || data.alertHistory.failed > 0) && (
          <div className="rounded-lg bg-background px-4 py-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Cron alerts</p>
            <p className="text-sm text-white mt-1">
              <span className="text-primary">{data.alertHistory.success} success</span>
              {data.alertHistory.failed > 0 && (
                <>
                  <span className="text-muted-foreground"> · </span>
                  <span className="text-red-300">{data.alertHistory.failed} failed</span>
                </>
              )}
            </p>
            {data.alertHistory.lastFailureMessage && (
              <p className="text-[11px] text-red-300/80 mt-1 truncate">
                Last failure: {data.alertHistory.lastFailureMessage}
              </p>
            )}
          </div>
        )}

        {data.lastSnapshotComment && (
          <div className="rounded-lg border-l-2 border-primary/60 bg-background/40 px-4 py-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <MessageSquare className="w-3 h-3 text-primary" /> Last weekly comment ({data.lastSnapshotComment.snapshotDate})
            </p>
            <p className="text-sm text-white/90 italic mt-1">&ldquo;{data.lastSnapshotComment.comment}&rdquo;</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
