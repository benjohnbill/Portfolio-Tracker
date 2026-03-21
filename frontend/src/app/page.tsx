import { getPortfolioHistory, getPortfolioAllocation, getPortfolioSummary, getActionReport } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { HistoryChart } from '@/components/features/HistoryChart';
import { TargetDeviationChart } from '@/components/features/TargetDeviationChart';
import { AddAssetModal } from '@/components/features/AddAssetModal';
import { 
  TrendingUp, 
  Wallet, 
  ArrowUpRight, 
  ArrowDownRight, 
  Zap, 
  ShieldCheck, 
  Sparkles,
  ChevronRight,
  Clock,
  Briefcase,
  BrainCircuit,
  AlertTriangle,
  CheckCircle2,
  Activity,
  ArrowRightLeft,
  LayoutDashboard
} from 'lucide-react';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams;
  const period = typeof params.period === 'string' ? params.period : 'ytd';
  
  const [history, allocation, summary, actionReport] = await Promise.all([
    getPortfolioHistory(period),
    getPortfolioAllocation(),
    getPortfolioSummary(),
    getActionReport()
  ]);
  
  if (!history || history.length === 0) {
    return <div className="p-8 text-white">Loading portfolio data...</div>;
  }

  const latestData = history[history.length - 1];
  const firstData = history[0];
  const delta = latestData.total_value - firstData.total_value;
  const isPositive = delta >= 0;
  const deltaPercent = ((delta / firstData.total_value) * 100).toFixed(1);

  // Calculate daily return from history
  const yesterdayData = history.length > 1 ? history[history.length - 2] : latestData;
  const dailyDelta = latestData.total_value - yesterdayData.total_value;
  const dailyPercent = yesterdayData.total_value > 0 ? ((dailyDelta / yesterdayData.total_value) * 100).toFixed(2) : "0.00";
  const isDailyPositive = dailyDelta >= 0;

  // Signal processing
  const vxn = actionReport.signals?.vxn;
  const mstr = actionReport.signals?.mstr;
  const ndx = actionReport.signals?.ndx;
  
  // Group allocation by account_type
  const siloedAccounts = allocation.reduce((acc, asset) => {
    const type = asset.account_type || 'OVERSEAS';
    if (!acc[type]) acc[type] = { assets: [], total: 0 };
    acc[type].assets.push(asset);
    acc[type].total += asset.value;
    return acc;
  }, {} as Record<string, { assets: any[], total: number }>);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-primary mb-1">
            <BrainCircuit className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Algorithm Status: Active</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white italic">Friday Routine</h1>
          <div className="flex items-center space-x-2 text-muted-foreground mt-1 text-sm">
             <Clock className="w-3 h-3" />
             <span>System Last Synced: {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center bg-[#11161d] border border-border/40 p-1 rounded-lg">
             {['Overview', 'Analysis', 'Settings'].map((btn) => (
               <button key={btn} className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${btn === 'Overview' ? 'bg-[#1a232e] text-white shadow-sm' : 'text-muted-foreground hover:text-white'}`}>
                  {btn}
               </button>
             ))}
          </div>
          <AddAssetModal />
        </div>
      </div>

      {/* Action Center - Urgent Directives */}
      {actionReport.actions && actionReport.actions.length > 0 && (
        <Card className="border-primary/50 bg-primary/5 card-glow-primary overflow-hidden">
          <CardContent className="p-0">
            <div className="flex items-stretch">
              <div className="bg-primary px-4 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-black" />
              </div>
              <div className="p-4 flex-1 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-primary flex items-center">
                    Trade Recommendation Needed
                    <span className="ml-2 px-2 py-0.5 bg-primary/20 text-primary text-[10px] rounded uppercase tracking-tighter">High Priority</span>
                  </h3>
                  <div className="mt-1 space-y-1">
                    {actionReport.actions.map((act, i) => (
                      <div key={i} className="text-sm text-white/90">
                        <span className="font-mono text-primary mr-2">[{act.asset}]</span>
                        <span className="font-bold underline decoration-primary/30">{act.action}</span>
                        <span className="mx-2 text-white/40">|</span>
                        <span className="italic text-white/60 text-xs">{act.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <button className="bg-primary hover:bg-primary/90 text-black px-6 py-2 rounded-md text-sm font-bold transition-all shadow-[0_0_15px_rgba(79,209,197,0.4)] flex items-center shrink-0">
                  Execute Trade <ArrowRightLeft className="w-4 h-4 ml-2" />
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Signal Hub - Market Context */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* VXN Volatility */}
        <Card className="bg-[#11161d] border-border/40 overflow-hidden relative group">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <Activity className="w-5 h-5 text-purple-400" />
              </div>
              <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${vxn?.is_vix_spike ? 'bg-destructive/20 text-destructive border border-destructive/30' : 'bg-green-500/20 text-green-400 border border-green-500/30'}`}>
                {vxn?.is_vix_spike ? 'Spike Detected' : 'Normal Vol'}
              </div>
            </div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">VXN Volatility Filter</p>
            <div className="flex items-baseline space-x-2 mt-1">
              <h3 className="text-2xl font-bold text-white tracking-tight">{vxn?.current_vxn.toFixed(2)}</h3>
              <span className="text-[10px] text-muted-foreground italic">vs Limit {vxn?.threshold_90.toFixed(2)}</span>
            </div>
            <div className="mt-4 h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-1000 ${vxn?.is_vix_spike ? 'bg-destructive' : 'bg-purple-500'}`}
                style={{ width: `${Math.min(100, (vxn?.current_vxn || 0) / (vxn?.threshold_90 || 1) * 90)}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* MSTR Z-Score */}
        <Card className="bg-[#11161d] border-border/40 overflow-hidden relative">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${Math.abs(mstr?.z_score || 0) > 2 ? 'bg-amber-500/20 text-amber-400' : 'bg-primary/20 text-primary'}`}>
                { (mstr?.z_score || 0) < 0 ? 'Value Zone' : (mstr?.z_score || 0) > 3.5 ? 'Overvalued' : 'Fair Range' }
              </div>
            </div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">MSTR MNAV Z-Score</p>
            <div className="flex items-baseline space-x-2 mt-1">
              <h3 className="text-2xl font-bold text-white tracking-tight">{mstr?.z_score.toFixed(2)}</h3>
              <span className="text-[10px] text-muted-foreground italic">252d Rolling</span>
            </div>
            <div className="mt-4 relative h-6">
              <div className="absolute top-2.5 w-full h-1 bg-white/10 rounded-full" />
              <div className="absolute top-2.5 left-1/2 w-0.5 h-2 bg-white/30 -translate-x-1/2" />
              <div 
                className="absolute top-1 w-3 h-4 bg-primary border border-black rounded shadow-[0_0_8px_rgba(79,209,197,0.6)] transition-all duration-1000"
                style={{ left: `${Math.max(0, Math.min(100, ((mstr?.z_score || 0) + 3) / 6 * 100))}%` }}
              />
              <div className="flex justify-between text-[8px] text-white/20 mt-4 px-1">
                <span>-3.0</span>
                <span>0.0</span>
                <span>+3.0</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* NDX 250MA Status */}
        <Card className="bg-[#11161d] border-border/40 overflow-hidden relative">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <TrendingUp className="w-5 h-5 text-blue-400" />
              </div>
              <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${ndx?.is_above_ma ? 'bg-blue-500/20 text-blue-400' : 'bg-destructive/20 text-destructive'}`}>
                {ndx?.is_above_ma ? 'NDX Bullish' : 'NDX Bearish'}
              </div>
            </div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Growth Engine (250MA)</p>
            <div className="flex items-baseline space-x-2 mt-1">
              <h3 className="text-2xl font-bold text-white tracking-tight">{ndx?.is_above_ma ? 'RE-LEVERAGE' : 'DE-LEVERAGE'}</h3>
            </div>
            <p className="mt-4 text-[10px] text-muted-foreground italic flex items-center">
              Current: {new Intl.NumberFormat('en-US').format(ndx?.current_price || 0)} 
              <ChevronRight className="w-2 h-2 mx-1" /> 
              250MA: {new Intl.NumberFormat('en-US').format(ndx?.ma_250 || 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        {/* Left Column: Performance & Deviation */}
        <div className="lg:col-span-8 space-y-8">
          <Card className="bg-[#11161d] border-border/40 card-glow">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-bold text-white flex items-center">
                    Equity Curve <Sparkles className="w-4 h-4 ml-2 text-primary opacity-50" />
                  </CardTitle>
                  <CardDescription className="text-xs">Real-time portfolio growth tracking</CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                   <div className={`px-2 py-1 rounded-md text-xs font-bold ${isDailyPositive ? 'text-primary' : 'text-destructive'} bg-white/5`}>
                      {isDailyPositive ? '+' : ''}{dailyPercent}% Today
                   </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <HistoryChart data={history} />
            </CardContent>
          </Card>

          {/* New Section: Core 6 Target Deviation */}
          <Card className="bg-[#11161d] border-border/40 overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-xl font-bold text-white flex items-center">
                Strategy Deviation <Briefcase className="w-4 h-4 ml-2 text-muted-foreground" />
              </CardTitle>
              <CardDescription className="text-xs">Current weights vs Core 6 targets (±30% Threshold)</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <TargetDeviationChart allocation={allocation} />
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Siloed Holdings */}
        <div className="lg:col-span-4 space-y-6">
          <h2 className="text-lg font-bold text-white flex items-center px-1">
            Account Silos <ShieldCheck className="w-4 h-4 ml-2 text-primary" />
          </h2>
          
          {Object.entries(siloedAccounts).map(([type, data]) => (
            <Card key={type} className="bg-[#11161d]/60 border-border/40 backdrop-blur-sm">
              <CardHeader className="p-4 pb-2 border-b border-border/20 flex flex-row items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${type === 'ISA' ? 'bg-blue-400' : type === 'PENSION' ? 'bg-amber-400' : 'bg-primary'}`} />
                  <CardTitle className="text-sm font-bold text-white">{type} ACCOUNT</CardTitle>
                </div>
                <span className="text-xs font-mono text-white/70">
                  {new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(data.total)}
                </span>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border/20">
                  {data.assets.map((asset, idx) => (
                    <div key={idx} className="p-4 flex items-center justify-between group hover:bg-white/5 transition-colors">
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
                        <div className="text-[10px] text-primary">{(asset.weight * 100).toFixed(1)}% weight</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Total Value Summary Footer Card */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4">
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">Total Portfolio Value</p>
                  <h3 className="text-xl font-bold text-white mt-1">
                    {new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(summary.total_value)}
                  </h3>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">Invested</p>
                  <p className="text-sm font-bold text-white">
                    {new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(summary.invested_capital)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
