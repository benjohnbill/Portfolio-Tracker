import { getPortfolioAllocation } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { TargetDeviationChart } from '@/components/features/TargetDeviationChart';
import { Briefcase, ShieldCheck } from 'lucide-react';

export async function AssetAllocationSection() {
  const allocationData = await getPortfolioAllocation();

  const siloedAccounts = allocationData.reduce((acc, asset) => {
    const type = asset.account_silo || asset.account_type || 'OVERSEAS';
    if (!acc[type]) acc[type] = { assets: [], total: 0 };
    acc[type].assets.push(asset);
    acc[type].total += asset.value || 0;
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
    <div className="space-y-8">
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

      <div className="space-y-6">
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
                      <div className="text-[10px] text-primary">{(asset.weight * 100).toFixed(1)}% weight</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
