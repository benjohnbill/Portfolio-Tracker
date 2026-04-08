import { getPortfolioHistory } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { HistoryChart } from '@/components/features/HistoryChart';
import { AlphaChart } from '@/components/features/AlphaChart';
import { Sparkles, TrendingUp } from 'lucide-react';

export async function EquityCurveSection({ period }: { period: string }) {
  const historyData = await getPortfolioHistory(period);

  if (!historyData || historyData.length === 0) {
    return (
      <Card className="bg-[#11161d] border-border/40 h-64 flex items-center justify-center text-muted-foreground">
        No equity curve data available for this period.
      </Card>
    );
  }

  const latestData = historyData[historyData.length - 1];
  const yesterdayData = historyData.length > 1 ? historyData[historyData.length - 2] : latestData;
  const latestValue = latestData?.total_value || 0;
  const yesterdayValue = yesterdayData?.total_value || latestValue;
  const dailyDelta = latestValue - yesterdayValue;
  const dailyPercent = yesterdayValue > 0 ? ((dailyDelta / yesterdayValue) * 100).toFixed(2) : '0.00';
  const isDailyPositive = dailyDelta >= 0;

  return (
    <div className="space-y-8">
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
    </div>
  );
}
