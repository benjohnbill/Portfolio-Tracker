import Link from 'next/link';

import { getPortfolioPageData } from '@/lib/api';
import { AlphaChart } from '@/components/features/AlphaChart';
import { NDXTrendChart } from '@/components/features/NDXTrendChart';
import { MSTRZScoreChart } from '@/components/features/MSTRZScoreChart';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { HistoryChart } from '@/components/features/HistoryChart';
import { TargetDeviationChart } from '@/components/features/TargetDeviationChart';
import { AddAssetModal } from '@/components/features/AddAssetModal';
import {
  TrendingUp,
  Sparkles,
  ChevronRight,
  Clock,
  Briefcase,
  ShieldCheck,
  ChevronLeft,
  AlertTriangle,
} from 'lucide-react';

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}


export default async function PortfolioPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams;
  const period = typeof params.period === 'string' ? params.period : '1y';

  const { history, allocation, summary, ndxHistory, mstrHistory } = await getPortfolioPageData(period);
  const historyData = history.data ?? [];
  const allocationData = allocation.data ?? [];

  if (history.error || allocation.error || summary.error) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500 pb-12">
        <div>
          <div className="flex items-center gap-2 text-primary mb-1 text-xs font-bold uppercase tracking-wider">
            <Briefcase className="w-4 h-4" />
            <span>Portfolio</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white italic">Long-Horizon Analytics</h1>
        </div>

        <Card className="bg-[#11161d] border-destructive/30">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              Portfolio data unavailable
            </CardTitle>
            <CardDescription>
              We could not load the current portfolio analytics. Check the backend/API connection and try again.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            {history.error && <p>History: {history.error}</p>}
            {allocation.error && <p>Allocation: {allocation.error}</p>}
            {summary.error && <p>Summary: {summary.error}</p>}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (historyData.length === 0) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500 pb-12">
        <div>
          <div className="flex items-center gap-2 text-primary mb-1 text-xs font-bold uppercase tracking-wider">
            <Briefcase className="w-4 h-4" />
            <span>Portfolio</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white italic">Long-Horizon Analytics</h1>
        </div>

        <Card className="bg-[#11161d] border-border/40">
          <CardHeader>
            <CardTitle className="text-white">No portfolio history available</CardTitle>
            <CardDescription>
              Portfolio analytics will appear after price snapshots and transaction history are available.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const safeSummary = summary.data ?? {
    total_value: 0,
    invested_capital: 0,
    metrics: {
      total_return: 0,
      cagr: 0,
      mdd: 0,
      volatility: 0,
      sharpe_ratio: 0,
    },
  };

  const valuationMeta = summary.data?.valuation;
  const asOfDate = valuationMeta?.as_of ? new Date(valuationMeta.as_of).toLocaleDateString() : null;
  const valuationTimestamp = valuationMeta?.calculated_at 
    ? new Date(valuationMeta.calculated_at).toLocaleString([], { 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    : null;
  const valuationLabel = valuationMeta 
    ? `${valuationMeta.source} ${valuationMeta.version} (${asOfDate || 'unknown date'}, ${valuationMeta.history_points} points, ${valuationMeta.period} period)`
    : 'Real-time live equity curve';

  const latestData = historyData[historyData.length - 1];
  const yesterdayData = historyData.length > 1 ? historyData[historyData.length - 2] : latestData;
  const latestValue = isFiniteNumber(latestData?.total_value) ? latestData.total_value : 0;
  const yesterdayValue = isFiniteNumber(yesterdayData?.total_value) ? yesterdayData.total_value : latestValue;
  const dailyDelta = latestValue - yesterdayValue;
  const dailyPercent = yesterdayValue > 0 ? ((dailyDelta / yesterdayValue) * 100).toFixed(2) : '0.00';
  const isDailyPositive = dailyDelta >= 0;

  const siloedAccounts = allocationData.reduce((acc, asset) => {
    const type = asset.account_silo || asset.account_type || 'OVERSEAS';
    if (!acc[type]) acc[type] = { assets: [], total: 0 };
    acc[type].assets.push(asset);
    acc[type].total += isFiniteNumber(asset.value) ? asset.value : 0;
    return acc;
  }, {} as Record<string, { assets: typeof allocationData; total: number }>);

  const siloLabelMap: Record<string, string> = {
    ISA_ETF: 'ISA',
    OVERSEAS_ETF: 'OVERSEAS',
    BRAZIL_BOND: 'BRAZIL BOND',
    ISA: 'ISA',
    OVERSEAS: 'OVERSEAS',
    PENSION: 'PENSION',
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary mb-1 text-xs font-bold uppercase tracking-wider">
            <Briefcase className="w-4 h-4" />
            <span>Portfolio</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white italic">Long-Horizon Analytics</h1>
          <div className="flex items-center gap-2 text-muted-foreground mt-1 text-sm">
            <Clock className="w-3 h-3" />
            <span className="flex items-center gap-1">
              {valuationLabel}
              {valuationTimestamp && (
                <span className="text-xs text-white/50">· calculated {valuationTimestamp}</span>
              )}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Chart and summary use the same live valuation basis
          </p>
        </div>

        <div className="flex items-center space-x-4">
          <Link href="/" className="text-sm text-muted-foreground hover:text-white flex items-center gap-2">
            <ChevronLeft className="w-4 h-4" /> Back to This Week
          </Link>
          <div className="flex items-center bg-[#11161d] border border-border/40 p-1 rounded-lg">
            {[
              { label: '1M', value: '1m' },
              { label: '3M', value: '3m' },
              { label: '6M', value: '6m' },
              { label: '1Y', value: '1y' },
              { label: 'All', value: 'all' },
            ].map((opt) => (
              <Link
                key={opt.value}
                href={`/portfolio?period=${opt.value}`}
                className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${period === opt.value ? 'bg-[#1a232e] text-white shadow-sm' : 'text-muted-foreground hover:text-white'}`}
              >
                {opt.label}
              </Link>
            ))}
          </div>
          <AddAssetModal />
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-8">
          <Card className="bg-[#11161d] border-border/40 card-glow">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-bold text-white flex items-center">
                    Equity Curve <Sparkles className="w-4 h-4 ml-2 text-primary opacity-50" />
                  </CardTitle>
                  <CardDescription className="text-xs">Long-horizon portfolio growth and benchmark-relative path</CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  <div className={`px-2 py-1 rounded-md text-xs font-bold ${isDailyPositive ? 'text-primary' : 'text-destructive'} bg-white/5`}>
                    {isDailyPositive ? '+' : ''}{dailyPercent}% Today
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <HistoryChart data={historyData} />
            </CardContent>
          </Card>

          <Card className="bg-[#11161d] border-border/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-bold text-white flex items-center">
                Alpha vs SPY <TrendingUp className="w-4 h-4 ml-2 text-muted-foreground" />
              </CardTitle>
              <CardDescription className="text-xs">Cumulative outperformance relative to S&P 500</CardDescription>
            </CardHeader>
            <CardContent>
              <AlphaChart data={historyData} />
            </CardContent>
          </Card>

          <Card className="bg-[#11161d] border-border/40 overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-xl font-bold text-white flex items-center">
                Strategy Deviation <Briefcase className="w-4 h-4 ml-2 text-muted-foreground" />
              </CardTitle>
              <CardDescription className="text-xs">Current weights vs Core 6 targets (±30% Threshold)</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <TargetDeviationChart allocation={allocationData} />
            </CardContent>
          </Card>

          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white">Signal Charts</h2>
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="bg-[#11161d] border-border/40">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-bold text-white">NDX vs 250MA</CardTitle>
                  <CardDescription className="text-xs">Trend regime — drives TIGER_2X ↔ KODEX_1X rotation</CardDescription>
                </CardHeader>
                <CardContent>
                  <NDXTrendChart data={ndxHistory} />
                </CardContent>
              </Card>

              <Card className="bg-[#11161d] border-border/40">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-bold text-white">MSTR Z-Score</CardTitle>
                  <CardDescription className="text-xs">Mean-reversion signal — drives MSTR ↔ DBMF rotation</CardDescription>
                </CardHeader>
                <CardContent>
                  <MSTRZScoreChart data={mstrHistory} />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <Card className="bg-[#11161d] border-border/40">
            <CardHeader>
              <CardTitle className="text-white">Performance Summary</CardTitle>
              <CardDescription>Structural portfolio metrics, not just this week</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <div className="rounded-lg border border-border/40 p-3">
                <p className="text-xs text-muted-foreground uppercase">Total Value</p>
                <p className="text-white font-semibold">{new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(safeSummary.total_value)}</p>
              </div>
              <div className="rounded-lg border border-border/40 p-3">
                <p className="text-xs text-muted-foreground uppercase">Invested Capital</p>
                <p className="text-white font-semibold">{new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(safeSummary.invested_capital)}</p>
              </div>
              <div className="rounded-lg border border-border/40 p-3">
                <p className="text-xs text-muted-foreground uppercase">CAGR</p>
                <p className="text-white font-semibold">{(safeSummary.metrics.cagr * 100).toFixed(1)}%</p>
              </div>
              <div className="rounded-lg border border-border/40 p-3">
                <p className="text-xs text-muted-foreground uppercase">MDD</p>
                <p className="text-white font-semibold">{(safeSummary.metrics.mdd * 100).toFixed(1)}%</p>
              </div>
              <div className="rounded-lg border border-border/40 p-3">
                <p className="text-xs text-muted-foreground uppercase">Volatility</p>
                <p className="text-white font-semibold">{(safeSummary.metrics.volatility * 100).toFixed(1)}%</p>
              </div>
              <div className="rounded-lg border border-border/40 p-3">
                <p className="text-xs text-muted-foreground uppercase">Sharpe Ratio</p>
                <p className="text-white font-semibold">{safeSummary.metrics.sharpe_ratio.toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>

          <h2 className="text-lg font-bold text-white flex items-center px-1">
            Account Silos <ShieldCheck className="w-4 h-4 ml-2 text-primary" />
          </h2>

          {Object.entries(siloedAccounts).map(([type, data]) => (
            <Card key={type} className="bg-[#11161d]/60 border-border/40 backdrop-blur-sm">
              <CardHeader className="p-4 pb-2 border-b border-border/20 flex flex-row items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${type === 'ISA_ETF' || type === 'ISA' ? 'bg-blue-400' : type === 'BRAZIL_BOND' ? 'bg-emerald-400' : type === 'PENSION' ? 'bg-amber-400' : 'bg-primary'}`} />
                  <CardTitle className="text-sm font-bold text-white">{(siloLabelMap[type] || type)} ACCOUNT</CardTitle>
                </div>
                <span className="text-xs font-mono text-white/70">
                  {new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(data.total)}
                </span>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border/20">
                  {data.assets.map((asset) => (
                    <div key={`${type}-${asset.asset}`} className="p-4 flex items-center justify-between group hover:bg-white/5 transition-colors">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-bold text-white">{asset.asset}</span>
                          <span className="text-[10px] text-muted-foreground">{asset.quantity} shares</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate max-w-[120px]">{asset.name}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold text-white">
                          {new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(asset.value)}
                        </div>
                          <div className="text-[10px] text-primary">{(isFiniteNumber(asset.weight) ? asset.weight * 100 : 0).toFixed(1)}% weight</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
