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
  // Format the data for the chart tooltips and axes
  const chartData = data.map((point) => ({
    ...point,
    // Add a parsed date for formatting if needed
    parsedDate: new Date(point.date),
  }));

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

  return (
    <div className="h-[300px] w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
          <XAxis 
            dataKey="date" 
            tickFormatter={(value) => format(new Date(value), 'MMM d')} 
            stroke="var(--color-muted-foreground)" 
            fontSize={12} 
            tickLine={false} 
            axisLine={false} 
            minTickGap={30}
          />
          <YAxis 
            tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} 
            stroke="var(--color-muted-foreground)" 
            fontSize={12} 
            tickLine={false} 
            axisLine={false} 
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'var(--color-popover)', 
              borderColor: 'var(--color-border)', 
              borderRadius: 'var(--radius-md)' 
            }}
            itemStyle={{ color: 'var(--color-popover-foreground)' }}
            labelFormatter={(label) => format(new Date(label), 'MMM d, yyyy')}
            formatter={(value: number, name: string) => [formatCurrency(value), name === 'total_value' ? 'Total Value' : name]}
          />
          <Area 
            type="monotone" 
            dataKey="total_value" 
            stroke="var(--color-primary)" 
            fillOpacity={1} 
            fill="url(#colorTotal)" 
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
