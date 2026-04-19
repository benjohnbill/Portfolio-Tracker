"use client";

import { Activity } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { SleeveHistoryData, WeeklyReport } from '@/lib/api';


const SLEEVES: Array<keyof SleeveHistoryData> = ['NDX', 'DBMF', 'BRAZIL', 'MSTR', 'GLDM', 'BONDS-CASH'];

interface SleeveHealthPanelProps {
  report: WeeklyReport;
  sleeveHistory: SleeveHistoryData | null;
}

// Must stay in lockstep with backend `_normalize` in backend/app/services/briefing_service.py.
// Strips -, _, space, and / so labels like "BONDS/CASH" / "BONDS-CASH" / "bonds_cash" all
// collapse to BONDSCASH — prod targetDeviation emits "BONDS/CASH" while SLEEVES uses the hyphen form.
function normalize(label: string): string {
  return label.toUpperCase().replaceAll('-', '').replaceAll('_', '').replaceAll(' ', '').replaceAll('/', '');
}

function matchesSleeve(label: string | null | undefined, sleeve: string): boolean {
  if (!label) return false;
  return normalize(label) === normalize(sleeve);
}

function formatPercent(value: number | null | undefined): string {
  if (value == null) return '—';
  return `${(value * 100).toFixed(1)}%`;
}

export function SleeveHealthPanel({ report, sleeveHistory }: SleeveHealthPanelProps) {
  const targetDeviation = report.portfolioSnapshot.targetDeviation ?? [];
  const triggeredRules = report.triggeredRules ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" /> Sleeve Health
        </CardTitle>
        <CardDescription>Drift, active signals, and 4-week signal recency per sleeve.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {SLEEVES.map((sleeve) => {
          const match = targetDeviation.find((row) => matchesSleeve(row.category, sleeve));
          const activeRules = triggeredRules.filter((rule) =>
            (rule.affectedSleeves ?? []).some((sleeveName) => matchesSleeve(sleeveName, sleeve)),
          );
          const recency = sleeveHistory?.[sleeve] ?? [0, 0, 0, 0];
          const maxRecency = Math.max(1, ...recency);

          const driftPct = match ? match.deviation : null;
          const driftColor =
            driftPct == null ? 'bg-muted-foreground/40'
              : Math.abs(driftPct) > 0.05 ? 'bg-red-400'
              : Math.abs(driftPct) > 0.02 ? 'bg-amber-400'
              : 'bg-primary';

          return (
            <div key={sleeve} className="grid grid-cols-12 items-center gap-3 rounded-lg bg-background px-4 py-3 text-sm">
              <p className="col-span-2 font-semibold text-white">{sleeve}</p>

              <p className="col-span-2 text-xs text-muted-foreground">
                {formatPercent(match?.currentWeight)} / {formatPercent(match?.targetWeight)}
              </p>

              <div className="col-span-2">
                <div className={`h-1.5 rounded-full ${driftColor}`} style={{ width: match ? `${Math.min(100, Math.abs((driftPct ?? 0) * 400))}%` : '8%' }} />
              </div>

              <div className="col-span-2 text-xs">
                {activeRules.length > 0 ? (
                  <span className="text-amber-300">{activeRules.length} rule{activeRules.length === 1 ? '' : 's'}</span>
                ) : (
                  <span className="text-muted-foreground">quiet</span>
                )}
              </div>

              <div className="col-span-4 flex items-end gap-0.5 h-6">
                {recency.map((count, idx) => (
                  <div
                    key={idx}
                    className={`flex-1 rounded-sm ${count > 0 ? 'bg-primary/80' : 'bg-muted-foreground/20'}`}
                    style={{ height: `${Math.max(10, (count / maxRecency) * 100)}%` }}
                    title={`Week ${idx + 1}: ${count} rule firing${count === 1 ? '' : 's'}`}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
