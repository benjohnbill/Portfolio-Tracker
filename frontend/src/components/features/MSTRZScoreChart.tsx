'use client';

import {
  CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { format } from 'date-fns';
import type { MSTRHistoryPoint } from '@/lib/api';

interface MSTRZScoreChartProps {
  data: MSTRHistoryPoint[];
}

function getStatus(z: number): { label: string; color: string } {
  if (z >= 3.5) return { label: 'HARD EXIT', color: 'text-red-500' };
  if (z >= 2.0) return { label: 'PROFIT LOCK', color: 'text-orange-400' };
  if (z < 0) return { label: 'AGG. BUY', color: 'text-green-400' };
  return { label: 'HOLD', color: 'text-muted-foreground' };
}

export function MSTRZScoreChart({ data }: MSTRZScoreChartProps) {
  const chartData = data.filter(
    (p) => !Number.isNaN(new Date(p.date).getTime()) && p.z_score !== null
  );

  if (chartData.length === 0) {
    return <p className="text-sm text-muted-foreground">Insufficient MSTR data for Z-Score chart.</p>;
  }

  const latest = chartData[chartData.length - 1];
  const currentZ = latest.z_score ?? 0;
  const status = getStatus(currentZ);

  const yMin = Math.min(-1, ...chartData.map((d) => d.z_score ?? 0)) - 0.5;
  const yMax = Math.max(4.5, ...chartData.map((d) => d.z_score ?? 0)) + 0.5;

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
              domain={[yMin, yMax]}
              tickFormatter={(v) => v.toFixed(1)}
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
              formatter={(value: number) => [value.toFixed(4), 'Z-Score']}
            />
            <ReferenceArea y1={3.5} y2={yMax} fill="rgba(239,68,68,0.08)" fillOpacity={1} />
            <ReferenceArea y1={2.0} y2={3.5} fill="rgba(251,146,60,0.06)" fillOpacity={1} />
            <ReferenceArea y1={yMin} y2={0} fill="rgba(34,197,94,0.06)" fillOpacity={1} />
            <ReferenceLine y={3.5} stroke="#ef4444" strokeWidth={1} strokeDasharray="4 4" label={{ value: 'HARD EXIT', fill: '#ef4444', fontSize: 9, position: 'right' }} />
            <ReferenceLine y={2.0} stroke="#fb923c" strokeWidth={1} strokeDasharray="4 4" label={{ value: 'PROFIT LOCK', fill: '#fb923c', fontSize: 9, position: 'right' }} />
            <ReferenceLine y={0} stroke="#22c55e" strokeWidth={1} strokeDasharray="4 4" label={{ value: 'AGG. BUY', fill: '#22c55e', fontSize: 9, position: 'right' }} />
            <Line type="monotone" dataKey="z_score" stroke="#e2e8f0" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center justify-between mt-3 px-1">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>Z-Score: <span className="text-white font-medium">{currentZ.toFixed(2)}</span></span>
          <span>MNAV Ratio: <span className="text-white font-medium">{latest.mnav_ratio.toFixed(2)}</span></span>
        </div>
        <span className={`text-xs font-bold ${status.color}`}>
          {status.label}
        </span>
      </div>
    </div>
  );
}
