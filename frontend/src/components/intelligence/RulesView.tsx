"use client";

import { RuleAccuracyData } from '@/lib/api';

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-900/30 text-red-400',
  high: 'bg-amber-900/30 text-amber-400',
  medium: 'bg-blue-900/30 text-blue-400',
  low: 'bg-emerald-900/30 text-emerald-400',
};

function SeverityBadge({ severity }: { severity: string }) {
  const cls = SEVERITY_COLORS[severity] || SEVERITY_COLORS.medium;
  return (
    <span className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded ${cls}`}>
      {severity}
    </span>
  );
}

export function RulesView({ ruleAccuracy }: { ruleAccuracy: RuleAccuracyData[] }) {
  const totalFired = ruleAccuracy.reduce((s, r) => s + r.timesFired, 0);
  const totalFollowed = ruleAccuracy.reduce((s, r) => s + r.timesFollowed, 0);
  const overallRate = totalFired > 0 ? Math.round((totalFollowed / totalFired) * 100) : null;

  if (ruleAccuracy.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-serif italic text-white">Rule Accuracy</h1>
        <div className="bg-card rounded-lg p-8 border border-border/40 text-center">
          <p className="text-muted-foreground">No rules have fired yet. Rule data appears after your first weekly report with triggered signals.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="flex items-baseline justify-between">
        <h1 className="text-3xl font-serif italic text-white">Rule Accuracy</h1>
        <div className="flex items-center gap-4 text-sm font-mono text-muted-foreground">
          <span>{totalFired} total fires</span>
          <span>|</span>
          <span>Overall follow rate: <span className="text-white">{overallRate !== null ? `${overallRate}%` : '—'}</span></span>
        </div>
      </div>

      {/* Rule table */}
      <div className="bg-card rounded-lg border border-border/40 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/30 bg-accent/30">
              <th className="text-left text-xs text-muted-foreground font-normal py-3 px-4">Rule</th>
              <th className="text-left text-xs text-muted-foreground font-normal py-3 px-2">Severity</th>
              <th className="text-right text-xs text-muted-foreground font-normal py-3 px-4">Fired</th>
              <th className="text-right text-xs text-muted-foreground font-normal py-3 px-4">Followed</th>
              <th className="text-right text-xs text-muted-foreground font-normal py-3 px-4">Ignored</th>
              <th className="text-right text-xs text-muted-foreground font-normal py-3 px-4">Pending</th>
              <th className="text-right text-xs text-muted-foreground font-normal py-3 px-4">Follow Rate</th>
            </tr>
          </thead>
          <tbody>
            {ruleAccuracy.map(rule => (
              <tr key={rule.ruleId} className="border-b border-border/10 hover:bg-accent/20 transition-colors">
                <td className="py-3 px-4">
                  <span className="text-sm font-mono text-white">{rule.ruleId}</span>
                  {rule.timesFired < 3 && (
                    <span className="ml-2 text-[10px] text-muted-foreground">(limited data)</span>
                  )}
                </td>
                <td className="py-3 px-2">
                  <SeverityBadge severity={rule.severity} />
                </td>
                <td className="py-3 px-4 text-right text-sm font-mono text-white">{rule.timesFired}</td>
                <td className="py-3 px-4 text-right text-sm font-mono text-emerald-400">{rule.timesFollowed}</td>
                <td className="py-3 px-4 text-right text-sm font-mono text-red-400">{rule.timesIgnored}</td>
                <td className="py-3 px-4 text-right text-sm font-mono text-muted-foreground">{rule.timesPending}</td>
                <td className="py-3 px-4 text-right">
                  {rule.followRate !== null ? (
                    <span className="text-sm font-mono text-white">{Math.round(rule.followRate * 100)}%</span>
                  ) : (
                    <span className="text-sm font-mono text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
