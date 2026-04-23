import { getPortfolioHistory } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { HistoryChart } from '@/components/features/HistoryChart';
import { AlphaChart } from '@/components/features/AlphaChart';
import { AlertCircle, Sparkles, TrendingUp } from 'lucide-react';

export async function EquityCurveSection({ period }: { period: string }) {
  const historyData = await getPortfolioHistory(period);
  const archiveSeries = historyData.archive.series;
  const performanceSeries = historyData.performance.series;

  if (!archiveSeries || archiveSeries.length === 0) {
    return (
      <Card className="bg-[#11161d] border-border/40 h-64 flex items-center justify-center text-muted-foreground">
        No archive wealth data available for this period.
      </Card>
    );
  }

  const latestData = archiveSeries[archiveSeries.length - 1];
  const yesterdayData = archiveSeries.length > 1 ? archiveSeries[archiveSeries.length - 2] : latestData;
  const latestValue = latestData?.absolute_wealth || 0;
  const yesterdayValue = yesterdayData?.absolute_wealth || latestValue;
  const dailyDelta = latestValue - yesterdayValue;
  const dailyPercent = yesterdayValue > 0 ? ((dailyDelta / yesterdayValue) * 100).toFixed(2) : '0.00';
  const isDailyPositive = dailyDelta >= 0;
  const performanceUnavailable = historyData.performance.status === 'unavailable' || performanceSeries.length === 0;

  return (
    <div className="space-y-8">
      <Card className="bg-[#11161d] border-border/40 card-glow">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-bold text-white flex items-center">
                Archive Wealth Curve <Sparkles className="w-4 h-4 ml-2 text-primary opacity-50" />
              </CardTitle>
              <CardDescription className="text-xs">Actual lived portfolio wealth including deposits and withdrawals</CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <div className={`px-2 py-1 rounded-md text-xs font-bold ${isDailyPositive ? 'text-primary' : 'text-destructive'} bg-white/5`}>
                {isDailyPositive ? '+' : ''}{dailyPercent}% Today
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <HistoryChart data={archiveSeries} />
        </CardContent>
      </Card>

      <Card className="bg-[#11161d] border-border/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-bold text-white flex items-center">
            Performance Alpha vs SPY <TrendingUp className="w-4 h-4 ml-2 text-muted-foreground" />
          </CardTitle>
          <CardDescription className="text-xs">
            Cashflow-neutral performance view for benchmark and alpha comparisons
          </CardDescription>
        </CardHeader>
        <CardContent>
          {performanceUnavailable ? (
            <div className="flex min-h-[180px] items-center justify-center rounded-lg border border-dashed border-border/40 bg-white/5 px-4 text-center text-sm text-muted-foreground">
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2 text-white">
                  <AlertCircle className="h-4 w-4 text-amber-400" />
                  <span>Performance history unavailable</span>
                </div>
                <p>
                  Benchmark-relative history starts only after cashflow coverage is complete.
                  {historyData.performance.coverage_start ? ` Coverage starts ${historyData.performance.coverage_start}.` : ''}
                </p>
              </div>
            </div>
          ) : (
            <AlphaChart data={performanceSeries} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
