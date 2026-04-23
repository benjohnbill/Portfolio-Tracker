'use client';

import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';
import { format } from 'date-fns';
import { AbsoluteHistoryPoint } from '@/lib/api';

interface HistoryChartProps {
  data: AbsoluteHistoryPoint[];
}

export function HistoryChart({ data }: HistoryChartProps) {
  const chartData = data.filter((point) => !Number.isNaN(new Date(point.date).getTime()));

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
      maximumFractionDigits: 0
    }).format(val);

  return (
    <div className="h-[320px] w-full mt-2">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#4fd1c5" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#4fd1c5" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="rgba(255,255,255,0.05)"
          />
          <XAxis
            dataKey="date"
            tickFormatter={(value) => {
              const date = new Date(value);
              return Number.isNaN(date.getTime()) ? '' : format(date, 'MMM d');
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
            tickFormatter={(value) => `₩${(value / 10000).toFixed(0)}만`}
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
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)'
            }}
            labelFormatter={(label) => {
              const date = new Date(label);
              return Number.isNaN(date.getTime()) ? 'Unknown date' : format(date, 'MMM d, yyyy');
            }}
            formatter={(value: number) => [formatCurrency(value), 'Archive Wealth']}
          />
          <Area
            type="monotone"
            dataKey="absolute_wealth"
            stroke="#4fd1c5"
            fillOpacity={1}
            fill="url(#colorValue)"
            strokeWidth={2}
            animationDuration={1500}
            name="absolute_wealth"
          />
        </AreaChart>
      </ResponsiveContainer>
      <div className="flex items-center justify-center gap-6 mt-2 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-[#4fd1c5] rounded" />
          <span>Archive Wealth</span>
        </div>
      </div>
    </div>
  );
}
