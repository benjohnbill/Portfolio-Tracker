'use client';

import { useMemo } from 'react';
import {
  CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { format } from 'date-fns';
import type { NDXHistoryPoint } from '@/lib/api';

interface NDXTrendChartProps {
  data: NDXHistoryPoint[];
}

interface ZoneSegment {
  x1: string;
  x2: string;
  color: string;
}

export function NDXTrendChart({ data }: NDXTrendChartProps) {
  const chartData = data.filter(
    (p) => !Number.isNaN(new Date(p.date).getTime()) && p.ma_250 !== null
  );

  const zones = useMemo(() => {
    const segments: ZoneSegment[] = [];
    if (chartData.length === 0) return segments;

    let segStart = chartData[0].date;
    let isAbove = chartData[0].price > (chartData[0].ma_250 ?? 0);

    for (let i = 1; i < chartData.length; i++) {
      const currentAbove = chartData[i].price > (chartData[i].ma_250 ?? 0);
      if (currentAbove !== isAbove) {
        segments.push({
          x1: segStart,
          x2: chartData[i].date,
          color: isAbove ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
        });
        segStart = chartData[i].date;
        isAbove = currentAbove;
      }
    }
    segments.push({
      x1: segStart,
      x2: chartData[chartData.length - 1].date,
      color: isAbove ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
    });

    return segments;
  }, [chartData]);

  if (chartData.length === 0) {
    return <p className="text-sm text-muted-foreground">Insufficient NDX data for 250MA chart.</p>;
  }

  const latest = chartData[chartData.length - 1];
  const isAboveMA = latest.price > (latest.ma_250 ?? 0);
  const distPct = latest.ma_250 ? (((latest.price - latest.ma_250) / latest.ma_250) * 100).toFixed(1) : '—';

  return (
    <div>
      <div className="h-[260px] w-full mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey="date"
              tickFormatter={(v) => {
                const d = new Date(v);
                return Number.isNaN(d.getTime()) ? '' : format(d, 'MMM d');
              }}
              stroke="#64748b"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              minTickGap={40}
              dy={10}
            />
            <YAxis
              domain={['auto', 'auto']}
              tickFormatter={(v) => `$${v.toFixed(0)}`}
              stroke="#64748b"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              dx={-10}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#11161d',
                borderColor: 'rgba(255,255,255,0.1)',
                borderRadius: '12px',
                fontSize: '12px',
                color: '#fff',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
              }}
              labelFormatter={(label) => {
                const d = new Date(label);
                return Number.isNaN(d.getTime()) ? '' : format(d, 'MMM d, yyyy');
              }}
              formatter={(value: number, name: string) => {
                const label = name === 'ma_250' ? '250MA' : 'NDX (QQQ)';
                return [`$${value.toFixed(2)}`, label];
              }}
            />
            {zones.map((z, i) => (
              <ReferenceArea key={i} x1={z.x1} x2={z.x2} fill={z.color} fillOpacity={1} />
            ))}
            <Line type="monotone" dataKey="price" stroke="#e2e8f0" strokeWidth={2} dot={false} name="price" />
            <Line type="monotone" dataKey="ma_250" stroke="#64748b" strokeWidth={1.5} strokeDasharray="4 4" dot={false} name="ma_250" />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center justify-between mt-3 px-1">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>NDX: <span className="text-white font-medium">${latest.price.toFixed(2)}</span></span>
          <span>250MA: <span className="text-white font-medium">${(latest.ma_250 ?? 0).toFixed(2)}</span></span>
          <span>Distance: <span className={`font-medium ${isAboveMA ? 'text-green-400' : 'text-red-400'}`}>{isAboveMA ? '+' : ''}{distPct}%</span></span>
        </div>
        <span className={`text-xs font-bold px-2 py-1 rounded ${isAboveMA ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
          {isAboveMA ? 'GROWTH MODE' : 'SAFETY MODE'}
        </span>
      </div>
    </div>
  );
}
