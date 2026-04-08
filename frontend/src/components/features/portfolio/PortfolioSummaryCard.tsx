import { getPortfolioSummary } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export async function PortfolioSummaryCard() {
  const summary = await getPortfolioSummary();
  const metrics = summary.metrics || {
    total_return: 0,
    cagr: 0,
    mdd: 0,
    volatility: 0,
    sharpe_ratio: 0,
  };

  return (
    <Card className="bg-[#11161d] border-border/40">
      <CardHeader>
        <CardTitle className="text-white">Performance Summary</CardTitle>
        <CardDescription>Structural portfolio metrics, not just this week</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        <div className="rounded-lg border border-border/40 p-3">
          <p className="text-xs text-muted-foreground uppercase">Total Value</p>
          <p className="text-white font-semibold">{new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(summary.total_value)}</p>
        </div>
        <div className="rounded-lg border border-border/40 p-3">
          <p className="text-xs text-muted-foreground uppercase">Invested Capital</p>
          <p className="text-white font-semibold">{new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(summary.invested_capital)}</p>
        </div>
        <div className="rounded-lg border border-border/40 p-3">
          <p className="text-xs text-muted-foreground uppercase">CAGR</p>
          <p className="text-white font-semibold">{(metrics.cagr * 100).toFixed(1)}%</p>
        </div>
        <div className="rounded-lg border border-border/40 p-3">
          <p className="text-xs text-muted-foreground uppercase">MDD</p>
          <p className="text-white font-semibold">{(metrics.mdd * 100).toFixed(1)}%</p>
        </div>
        <div className="rounded-lg border border-border/40 p-3">
          <p className="text-xs text-muted-foreground uppercase">Volatility</p>
          <p className="text-white font-semibold">{(metrics.volatility * 100).toFixed(1)}%</p>
        </div>
        <div className="rounded-lg border border-border/40 p-3">
          <p className="text-xs text-muted-foreground uppercase">Sharpe Ratio</p>
          <p className="text-white font-semibold">{metrics.sharpe_ratio.toFixed(2)}</p>
        </div>
      </CardContent>
    </Card>
  );
}
