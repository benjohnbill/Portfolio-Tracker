"use client";

import { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { AttributionData, RegimeTransitionData } from '@/lib/api';

const PERIODS = [
  { key: '3m', label: '3M', weeks: 13 },
  { key: '6m', label: '6M', weeks: 26 },
  { key: '1y', label: '1Y', weeks: 52 },
  { key: 'all', label: 'All', weeks: 9999 },
];

export function AttributionsView({
  attributions,
  regimeHistory,
}: {
  attributions: AttributionData[];
  regimeHistory: RegimeTransitionData[];
}) {
  const [period, setPeriod] = useState('1y');
  const [showRegime, setShowRegime] = useState(false);

  const maxWeeks = PERIODS.find(p => p.key === period)?.weeks ?? 9999;
  const filtered = attributions.slice(-maxWeeks);

  const chartData = filtered.map(a => ({
    date: a.snapshotDate,
    fit: a.fit.score,
    alignment: a.alignment.score,
    posture: a.posture.score,
    total: a.totalScore,
  }));

  // Bucket breakdown table
  const bucketNames = ['liquidity', 'rates', 'inflation', 'growth', 'stress'] as const;
  const bucketStats = bucketNames.map(b => {
    const values = filtered.map(a => a.fit[b]).filter((v): v is number => v !== null);
    const latest = values.length > 0 ? values[values.length - 1] : null;
    const avg4 = values.length >= 4
      ? Math.round(values.slice(-4).reduce((s, v) => s + v, 0) / 4 * 10) / 10
      : null;
    const best = values.length > 0 ? Math.max(...values) : null;
    const worst = values.length > 0 ? Math.min(...values) : null;
    return { name: b.charAt(0).toUpperCase() + b.slice(1), latest, avg4, best, worst };
  });

  const transitionDates = regimeHistory.map(t => t.date);

  if (attributions.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-serif italic text-white">Score Attribution</h1>
        <div className="bg-card rounded-lg p-8 border border-border/40 text-center">
          <p className="text-muted-foreground">No attribution data yet. Data appears after the first Friday freeze.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="flex items-baseline justify-between">
        <h1 className="text-3xl font-serif italic text-white">Score Attribution</h1>
        <div className="flex items-center gap-2">
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-3 py-1 text-xs font-mono rounded transition-colors ${
                period === p.key
                  ? 'bg-primary/20 text-primary border border-primary/40'
                  : 'text-muted-foreground hover:text-white border border-border/40'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stacked area chart */}
      <div className="bg-card rounded-lg p-6 border border-border/40">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Score Decomposition</p>
          <button
            onClick={() => setShowRegime(!showRegime)}
            className={`text-xs px-2 py-1 rounded border transition-colors ${
              showRegime
                ? 'border-primary/40 text-primary bg-primary/10'
                : 'border-border/40 text-muted-foreground hover:text-white'
            }`}
          >
            Regime Overlay
          </button>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: '#5a6577' }}
              tickFormatter={v => v.slice(5)}
            />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#5a6577' }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#11161d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
              labelStyle={{ color: '#8b95a5', fontSize: 11 }}
              itemStyle={{ fontSize: 11 }}
            />
            <Area type="monotone" dataKey="posture" stackId="1" fill="#4ADE80" fillOpacity={0.3} stroke="#4ADE80" strokeWidth={1} name="Posture" />
            <Area type="monotone" dataKey="alignment" stackId="1" fill="#D4A574" fillOpacity={0.3} stroke="#D4A574" strokeWidth={1} name="Alignment" />
            <Area type="monotone" dataKey="fit" stackId="1" fill="#60A5FA" fillOpacity={0.3} stroke="#60A5FA" strokeWidth={1} name="Fit" />
            {showRegime && transitionDates.map((d, i) => (
              <ReferenceLine key={i} x={d} stroke="#D4A574" strokeDasharray="4 4" strokeOpacity={0.5} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Bucket breakdown table */}
      <div className="bg-card rounded-lg p-6 border border-border/40">
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-4">Fit Bucket Breakdown</p>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/30">
              <th className="text-left text-xs text-muted-foreground font-normal pb-2">Bucket</th>
              <th className="text-right text-xs text-muted-foreground font-normal pb-2">This Week</th>
              <th className="text-right text-xs text-muted-foreground font-normal pb-2">4-Week Avg</th>
              <th className="text-right text-xs text-muted-foreground font-normal pb-2">Best</th>
              <th className="text-right text-xs text-muted-foreground font-normal pb-2">Worst</th>
            </tr>
          </thead>
          <tbody>
            {bucketStats.map(b => (
              <tr key={b.name} className="border-b border-border/10">
                <td className="py-2 text-sm text-white">{b.name}</td>
                <td className="py-2 text-sm font-mono text-right text-white">{b.latest ?? '—'}</td>
                <td className="py-2 text-sm font-mono text-right text-muted-foreground">{b.avg4 ?? '—'}</td>
                <td className="py-2 text-sm font-mono text-right text-emerald-400">{b.best ?? '—'}</td>
                <td className="py-2 text-sm font-mono text-right text-red-400">{b.worst ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
