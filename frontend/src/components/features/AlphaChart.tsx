'use client';

import {
  Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { format } from 'date-fns';
import { PortfolioHistoryData } from '@/lib/api';

interface AlphaChartProps {
  data: PortfolioHistoryData[];
}

export function AlphaChart({ data }: AlphaChartProps) {
  const chartData = data
    .filter((point) => !Number.isNaN(new Date(point.date).getTime()) && point.alpha !== undefined)
    .map((point) => {
      const alphaPercent = Number(((point.alpha ?? 0) * 100).toFixed(2));

      return {
        date: point.date,
        alpha: alphaPercent,
        alphaPositive: alphaPercent > 0 ? alphaPercent : 0,
        alphaNegative: alphaPercent < 0 ? alphaPercent : 0,
      };
    });

  if (chartData.length === 0) return null;

  return (
    <div className="h-[200px] w-full mt-2">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="alphaPositive" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="alphaNegative" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0.3} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="date"
            tickFormatter={(value) => {
              const d = new Date(value);
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
            tickFormatter={(value) => `${value > 0 ? '+' : ''}${value.toFixed(1)}%`}
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
              if (name === 'alpha') {
                return [`${value > 0 ? '+' : ''}${value.toFixed(2)}%`, 'Alpha vs SPY'];
              }

              return null;
            }}
          />
          <ReferenceLine y={0} stroke="#64748b" strokeWidth={1} />
          <Area
            type="monotone"
            dataKey="alphaPositive"
            stroke="#22c55e"
            fill="url(#alphaPositive)"
            strokeWidth={2}
            animationDuration={1500}
            baseValue={0}
          />
          <Area
            type="monotone"
            dataKey="alphaNegative"
            stroke="#ef4444"
            fill="url(#alphaNegative)"
            strokeWidth={2}
            animationDuration={1500}
            baseValue={0}
          />
          <Area
            type="monotone"
            dataKey="alpha"
            stroke="transparent"
            fill="transparent"
            strokeWidth={0}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
