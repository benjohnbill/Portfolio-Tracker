"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { WeeklyScoreHistory } from '@/lib/api';

export function PerformanceTrendChart({ trends }: { trends: WeeklyScoreHistory[] }) {
  const data = trends.map((t) => ({ week: t.weekEnding, score: t.totalScore ?? 0 }));

  return (
    <div className="bg-card rounded-lg p-4 border border-border/40 h-48">
      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No frozen scores accumulated yet.</p>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#D4A574" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#D4A574" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="week" hide />
            <YAxis domain={[0, 100]} hide />
            <Tooltip
              contentStyle={{ background: '#11161d', border: '1px solid #2a3040', fontSize: '11px' }}
              labelStyle={{ color: '#8b95a5', fontFamily: 'monospace' }}
              formatter={(value) => [`${value} / 100`, 'Total']}
            />
            <Area type="monotone" dataKey="score" stroke="#D4A574" fill="url(#trendFill)" strokeWidth={1.5} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
