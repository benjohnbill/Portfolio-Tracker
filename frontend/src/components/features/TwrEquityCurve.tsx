'use client';

import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { format } from 'date-fns';
import { PerformanceHistoryPoint } from '@/lib/api';

interface TwrEquityCurveProps {
  data: PerformanceHistoryPoint[];
}

export function TwrEquityCurve({ data }: TwrEquityCurveProps) {
  const firstBv = data.find((p) => (p.benchmark_value ?? 0) > 0)?.benchmark_value ?? 0;

  const chartData = data
    .filter((p) => !Number.isNaN(new Date(p.date).getTime()))
    .map((p) => ({
      date: p.date,
      twr: Number(p.performance_value?.toFixed(4) ?? null),
      spy: firstBv > 0 ? Number(((p.benchmark_value / firstBv) * 100).toFixed(4)) : null,
    }));

  if (chartData.length === 0) return null;

  return (
    <div className="h-[220px] w-full mt-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="date"
            tickFormatter={(v) => {
              const d = new Date(v);
              return Number.isNaN(d.getTime()) ? '' : format(d, 'MMM yy');
            }}
            stroke="#64748b"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            minTickGap={60}
            dy={10}
          />
          <YAxis
            tickFormatter={(v) => `${v.toFixed(0)}`}
            stroke="#64748b"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            dx={-10}
            domain={['auto', 'auto']}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#11161d',
              borderColor: 'rgba(255,255,255,0.1)',
              borderRadius: '12px',
              fontSize: '12px',
              color: '#fff',
              boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)',
            }}
            labelFormatter={(label) => {
              const d = new Date(label);
              return Number.isNaN(d.getTime()) ? '' : format(d, 'MMM d, yyyy');
            }}
            formatter={(value: number, name: string) => {
              const pct = ((value - 100) >= 0 ? '+' : '') + (value - 100).toFixed(2) + '%';
              if (name === 'twr') return [`${value.toFixed(1)} (${pct})`, 'Portfolio TWR'];
              if (name === 'spy') return [`${value.toFixed(1)} (${pct})`, 'SPY (KRW)'];
              return null;
            }}
          />
          <Line
            type="monotone"
            dataKey="twr"
            stroke="#60A5FA"
            strokeWidth={2}
            dot={false}
            animationDuration={1200}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="spy"
            stroke="#64748b"
            strokeWidth={1.5}
            strokeDasharray="4 2"
            dot={false}
            animationDuration={1200}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
