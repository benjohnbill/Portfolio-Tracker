'use client';

import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  ReferenceLine
} from 'recharts';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

interface DeviationData {
  category: string;
  current: number;
  target: number;
  deviation: number;
  needsRebalance: boolean;
}

interface TargetDeviationChartProps {
  allocation: {
    asset: string;
    weight: number;
  }[];
}

const TARGETS: Record<string, number> = {
  'NDX': 0.30,
  'DBMF': 0.30,
  'BRAZIL': 0.10,
  'MSTR': 0.10,
  'GLDM': 0.10,
  'BONDS/CASH': 0.10,
};

const assetToCategory = (symbol: string): string => {
  const s = symbol.toUpperCase();
  if (['QQQ', 'TIGER', '379810', 'TIGER NASDAQ100'].some(t => s.includes(t))) return 'NDX';
  if (s.includes('DBMF')) return 'DBMF';
  if (s.includes('BRAZIL')) return 'BRAZIL';
  if (s.includes('MSTR')) return 'MSTR';
  if (s.includes('GLDM')) return 'GLDM';
  if (['TLT', 'BIL'].some(t => s.includes(t))) return 'BONDS/CASH';
  return 'OTHER';
};

export function TargetDeviationChart({ allocation }: TargetDeviationChartProps) {
  // Group current weights by category
  const currentWeights: Record<string, number> = {};
  allocation.forEach(a => {
    const cat = assetToCategory(a.asset);
    currentWeights[cat] = (currentWeights[cat] || 0) + a.weight;
  });

  const data: DeviationData[] = Object.keys(TARGETS).map(cat => {
    const current = (currentWeights[cat] || 0) * 100;
    const target = TARGETS[cat] * 100;
    const deviation = (current - target) / target;
    return {
      category: cat,
      current: parseFloat(current.toFixed(1)),
      target: target,
      deviation: deviation,
      needsRebalance: Math.abs(deviation) > 0.3
    };
  });

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as DeviationData;
      return (
        <div className="bg-[#11161d] border border-border/40 p-3 rounded-lg shadow-xl">
          <p className="text-xs font-bold text-white mb-2 uppercase tracking-wider">{data.category}</p>
          <div className="space-y-1">
            <div className="flex justify-between space-x-8">
              <span className="text-[10px] text-muted-foreground uppercase">Current</span>
              <span className="text-xs font-bold text-white">{data.current}%</span>
            </div>
            <div className="flex justify-between space-x-8">
              <span className="text-[10px] text-muted-foreground uppercase">Target</span>
              <span className="text-xs font-bold text-primary">{data.target}%</span>
            </div>
            <div className="pt-2 border-t border-border/20 flex justify-between space-x-8">
              <span className="text-[10px] text-muted-foreground uppercase">Deviation</span>
              <span className={`text-xs font-bold ${data.needsRebalance ? 'text-destructive' : 'text-primary'}`}>
                {(data.deviation * 100).toFixed(1)}%
              </span>
            </div>
          </div>
          {data.needsRebalance && (
            <div className="mt-2 flex items-center space-x-1 text-destructive font-bold text-[9px] uppercase">
              <AlertTriangle className="w-3 h-3" />
              <span>Needs Rebalancing</span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full space-y-4">
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
            barGap={0}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="rgba(255,255,255,0.05)" />
            <XAxis type="number" hide domain={[0, Math.max(...data.map(d => Math.max(d.current, d.target))) + 5]} />
            <YAxis 
              dataKey="category" 
              type="category" 
              stroke="#64748b" 
              fontSize={10} 
              tickLine={false} 
              axisLine={false}
              width={70}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
            
            {/* Target Bar (ghostly background) */}
            <Bar dataKey="target" fill="rgba(79, 209, 197, 0.1)" barSize={20} radius={[0, 4, 4, 0]} />
            
            {/* Current Bar */}
            <Bar dataKey="current" barSize={12} radius={[0, 4, 4, 0]}>
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.needsRebalance ? '#ef4444' : '#4fd1c5'} 
                  className={entry.needsRebalance ? 'animate-pulse' : ''}
                  style={{ filter: entry.needsRebalance ? 'drop-shadow(0 0 8px rgba(239, 68, 68, 0.5))' : 'none' }}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 px-2">
        {data.filter(d => d.needsRebalance).map(d => (
          <div key={d.category} className="bg-destructive/10 border border-destructive/20 p-2 rounded-lg flex items-center space-x-2">
            <AlertTriangle className="w-3 h-3 text-destructive" />
            <div className="text-[10px] font-bold text-destructive uppercase tracking-tight">
              {d.category}: {d.deviation > 0 ? '+' : ''}{(d.deviation * 100).toFixed(0)}% Drift
            </div>
          </div>
        ))}
        {data.filter(d => !d.needsRebalance && d.current > 0).map(d => (
          <div key={d.category} className="bg-primary/10 border border-primary/20 p-2 rounded-lg flex items-center space-x-2">
            <CheckCircle2 className="w-3 h-3 text-primary" />
            <div className="text-[10px] font-bold text-primary uppercase tracking-tight">
              {d.category}: Optimized
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
