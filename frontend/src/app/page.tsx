import { getPortfolioHistory, getPortfolioAllocation } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { HistoryChart } from '@/components/features/HistoryChart';
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
  BrainCircuit
} from 'lucide-react';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams;
  const period = typeof params.period === 'string' ? params.period : 'ytd';
  
  const [history, allocation] = await Promise.all([
    getPortfolioHistory(period),
    getPortfolioAllocation()
  ]);
  
  if (!history || history.length === 0) {
    return (
      <div className="flex justify-center items-center h-64 bg-card rounded-xl border border-dashed border-border p-12">
        <div className="text-center">
            <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <div className="text-xl font-medium text-foreground">No portfolio data available yet</div>
            <p className="text-sm text-muted-foreground mt-1 mb-6">Start by adding your first transaction.</p>
            <AddAssetModal />
        </div>
      </div>
    );
  }

  const latestData = history[history.length - 1];
  const firstData = history[0];
  const delta = latestData.total_value - firstData.total_value;
  const isPositive = delta >= 0;
  const deltaPercent = ((delta / firstData.total_value) * 100).toFixed(1);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-primary mb-1">
            <Zap className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Smart Portfolio</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Portfolio Overview</h1>
          <div className="flex items-center space-x-2 text-muted-foreground mt-1 text-sm">
             <Clock className="w-3 h-3" />
             <span>Last updated at 7:42 AM</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center bg-[#11161d] border border-border/40 p-1 rounded-lg">
             {['Today', 'Tomorrow', 'Pick date'].map((btn) => (
               <button key={btn} className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${btn === 'Today' ? 'bg-[#1a232e] text-white shadow-sm' : 'text-muted-foreground hover:text-white'}`}>
                  {btn}
               </button>
             ))}
          </div>
          <AddAssetModal />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-[#11161d] border-border/40 card-glow overflow-hidden relative">
           <div className="absolute top-0 right-0 p-3 opacity-10">
              <Wallet className="w-12 h-12" />
           </div>
           <CardContent className="p-6">
             <p className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">Total Value</p>
             <div className="flex items-baseline space-x-2">
                <h3 className="text-2xl font-bold text-white tracking-tight">
                  {new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(latestData.total_value)}
                </h3>
             </div>
             <div className={`flex items-center mt-2 text-xs font-bold ${isPositive ? 'text-primary' : 'text-destructive'}`}>
                {isPositive ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
                <span>{isPositive ? '+' : ''}{deltaPercent}% from start</span>
             </div>
           </CardContent>
        </Card>

        <Card className="bg-[#11161d] border-border/40 card-glow overflow-hidden relative">
           <div className="absolute top-0 right-0 p-3 opacity-10">
              <Zap className="w-12 h-12 text-primary" />
           </div>
           <CardContent className="p-6">
             <p className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">Invested Capital</p>
             <h3 className="text-2xl font-bold text-white tracking-tight">
                {new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(latestData.invested || latestData.total_value * 0.9)}
             </h3>
             <div className="flex items-center mt-2 text-xs text-muted-foreground font-medium">
                <span>94.2% allocation</span>
             </div>
           </CardContent>
        </Card>

        <Card className="bg-[#11161d] border-border/40 card-glow overflow-hidden relative">
           <div className="absolute top-0 right-0 p-3 opacity-10">
              <ShieldCheck className="w-12 h-12" />
           </div>
           <CardContent className="p-6">
             <p className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">Risk Level</p>
             <h3 className="text-2xl font-bold text-white tracking-tight">Moderate</h3>
             <div className="flex items-center mt-2 text-xs text-primary font-bold">
                <span>Optimized</span>
             </div>
           </CardContent>
        </Card>

        <Card className="bg-[#11161d] border-border/40 card-glow overflow-hidden relative">
           <div className="absolute top-0 right-0 p-3 opacity-10">
              <TrendingUp className="w-12 h-12" />
           </div>
           <CardContent className="p-6">
             <p className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">Daily Return</p>
             <h3 className="text-2xl font-bold text-primary neon-glow">
                +1.2%
             </h3>
             <div className="flex items-center mt-2 text-xs text-muted-foreground font-medium">
                <span>Above S&P 500</span>
             </div>
           </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main Content Area (Chart + List) */}
        <div className="lg:col-span-8 space-y-8">
          {/* Equity Curve Chart Card */}
          <Card className="bg-[#11161d] border-border/40 card-glow">
            <div className="p-6 pb-0 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">Equity Curve</h3>
                <p className="text-xs text-muted-foreground mt-1">AI-optimized performance tracking</p>
              </div>
              <div className="flex items-center space-x-2">
                 <div className="flex items-center space-x-1 px-2 py-1 bg-primary/10 rounded-full border border-primary/20">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    <span className="text-[10px] font-bold text-primary uppercase">Live</span>
                 </div>
              </div>
            </div>
            <CardContent className="pt-2">
              <HistoryChart data={history} />
            </CardContent>
          </Card>

          {/* Holdings List Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
               <h3 className="text-xl font-bold text-white px-1">Holdings & Assets</h3>
               <button className="text-xs font-bold text-primary hover:underline flex items-center">
                  View All <ChevronRight className="w-3 h-3 ml-1" />
               </button>
            </div>
            
            <div className="space-y-3">
               {allocation.map((asset) => (
                 <div key={asset.asset} className="bg-[#11161d] border border-border/40 rounded-xl p-4 flex items-center justify-between hover:border-primary/40 transition-all cursor-pointer group">
                   <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 rounded-lg bg-[#1a232e] border border-border/60 flex items-center justify-center text-sm font-bold text-white">
                        {asset.asset.substring(0, 1)}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white flex items-center">
                           {asset.name}
                           <div className="ml-2 px-1.5 py-0.5 bg-primary/10 text-[10px] font-bold text-primary rounded border border-primary/20 opacity-0 group-hover:opacity-100 transition-opacity">
                              {(asset.weight * 100).toFixed(1)}%
                           </div>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5 font-medium">{asset.quantity.toLocaleString()} Shares • {asset.asset}</div>
                      </div>
                   </div>
                   <div className="flex items-center space-x-6 text-right">
                      <div>
                        <div className="text-sm font-bold text-white">
                          {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(asset.price)}
                        </div>
                        <div className="text-[11px] font-bold text-primary">
                          {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(asset.value)}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-white transition-colors" />
                   </div>
                 </div>
               ))}
            </div>
          </div>
        </div>

        {/* AI Insight Side Panel */}
        <div className="lg:col-span-4 space-y-6">
           <div className="relative">
              <div className="absolute inset-0 bg-primary/5 blur-3xl rounded-full" />
              <Card className="bg-[#11161d]/80 border-border/40 backdrop-blur-xl relative card-glow">
                 <CardContent className="p-6">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-6">
                       <Sparkles className="w-6 h-6 text-primary neon-glow" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Why this portfolio works</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                       AI-optimized asset allocation based on your risk tolerance and current market liquidity.
                    </p>

                    <div className="mt-8 space-y-6">
                       {[
                         { icon: TrendingUp, title: 'Growth focused', desc: 'Your peak exposure is in Tech sector (Nasdaq 100), capturing current AI expansion.' },
                         { icon: ShieldCheck, title: 'Risk Hedged', desc: 'TLT and Gold mini-shares provide protection against yield fluctuations.' },
                         { icon: Wallet, title: 'Optimal Liquidity', desc: 'Cash reserves maintained at 5.8% to capture upcoming market dips.' },
                       ].map((item) => (
                         <div key={item.title} className="flex space-x-3">
                            <item.icon className="w-5 h-5 text-primary mt-0.5" />
                            <div>
                               <h4 className="text-sm font-bold text-white">{item.title}</h4>
                               <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{item.desc}</p>
                            </div>
                         </div>
                       ))}
                    </div>

                    <div className="mt-10 space-y-3">
                       <button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 rounded-lg flex items-center justify-center transition-all group">
                          <Zap className="w-4 h-4 mr-2" />
                          Rebalance Portfolio
                       </button>
                       <button className="w-full bg-[#1a232e] hover:bg-[#253040] text-white border border-border/60 font-bold py-3 rounded-lg flex items-center justify-center transition-all">
                          <BrainCircuit className="w-4 h-4 mr-2" />
                          Simulate Market Crash
                       </button>
                    </div>

                    <div className="mt-8 pt-6 border-t border-border/40">
                       <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">What if...</p>
                       <div className="space-y-2">
                          {[
                            'What if Bitcoin hits $100k?',
                            'What if interest rates drop by 1%?',
                          ].map((text) => (
                            <div key={text} className="bg-[#1a232e]/50 border border-border/40 p-3 rounded-lg text-[11px] text-muted-foreground hover:text-white cursor-pointer hover:border-border transition-all">
                               {text}
                            </div>
                          ))}
                       </div>
                    </div>
                 </CardContent>
              </Card>
           </div>
        </div>
      </div>
    </div>
  );
}
