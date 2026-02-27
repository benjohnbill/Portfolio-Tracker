import { getPortfolioHistory } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HistoryChart } from '@/components/features/HistoryChart';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams;
  const period = typeof params.period === 'string' ? params.period : 'ytd';
  const history = await getPortfolioHistory(period);
  
  if (!history || history.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-secondary-foreground">No portfolio data available yet...</div>
      </div>
    );
  }

  // Basic aggregate calculation for dashboard cards
  const latestData = history[history.length - 1];
  const firstData = history[0];
  const delta = latestData.total_value - firstData.total_value;
  const isPositive = delta >= 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Your AI-powered portfolio analytics and historic performance.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-sm">
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-sm font-medium">Total Value</CardTitle>
           </CardHeader>
           <CardContent>
             <div className="text-2xl font-bold">
               {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(latestData.total_value)}
             </div>
             <p className={`text-xs mt-1 font-semibold ${isPositive ? 'text-primary' : 'text-destructive'}`}>
               {isPositive ? '+' : ''}{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(delta)} from start
             </p>
           </CardContent>
        </Card>
        
        {latestData.invested && (
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Invested Capital</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(latestData.invested)}
              </div>
            </CardContent>
          </Card>
        )}

        {latestData.cash && (
           <Card className="shadow-sm">
             <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
               <CardTitle className="text-sm font-medium">Cash Reserve</CardTitle>
             </CardHeader>
             <CardContent>
               <div className="text-2xl font-bold">
                   {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(latestData.cash)}
               </div>
             </CardContent>
           </Card>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 shadow-sm">
          <CardHeader>
            <CardTitle>History</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
             <HistoryChart data={history} />
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
