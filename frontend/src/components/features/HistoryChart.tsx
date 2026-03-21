'use client';

import { 
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis 
} from 'recharts';
import { format } from 'date-fns';
import { PortfolioHistoryData } from '@/lib/api';

interface HistoryChartProps {
  data: PortfolioHistoryData[];
}

export function HistoryChart({ data }: HistoryChartProps) {
  const chartData = data.map((point) => ({
    ...point,
    parsedDate: new Date(point.date),
  }));

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
            tickFormatter={(value) => format(new Date(value), 'MMM d')} 
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
            itemStyle={{ color: '#4fd1c5' }}
            labelFormatter={(label) => format(new Date(label), 'MMM d, yyyy')}
            formatter={(value: number) => [formatCurrency(value), 'Portfolio Value']}
          />
          <Area 
            type="monotone" 
            dataKey="total_value" 
            stroke="#4fd1c5" 
            fillOpacity={1} 
            fill="url(#colorValue)" 
            strokeWidth={3}
            animationDuration={1500}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
