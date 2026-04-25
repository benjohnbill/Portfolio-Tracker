import Link from 'next/link';
import { Suspense } from 'react';

import { AddAssetModal } from '@/components/features/AddAssetModal';
import {
  Clock,
  Briefcase,
  ChevronLeft,
} from 'lucide-react';

import { EquityCurveSection } from '@/components/features/portfolio/EquityCurveSection';
import { PortfolioSummaryCard } from '@/components/features/portfolio/PortfolioSummaryCard';
import { AssetAllocationSection } from '@/components/features/portfolio/AssetAllocationSection';
import { AssetSignalSection } from '@/components/features/portfolio/AssetSignalSection';
import { MSTRSignalSection } from '@/components/features/portfolio/MSTRSignalSection';
import { Skeleton } from '@/components/ui/skeleton';

export default async function PortfolioPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams;
  const period = typeof params.period === 'string' ? params.period : '1y';

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
              Real-time live equity curve
              <span className="text-xs text-white/50">· calculated {new Date().toLocaleDateString()}</span>
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Charts and summary use the same live valuation basis
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
          <Suspense fallback={<Skeleton className="h-[600px] w-full rounded-xl" />}>
            <EquityCurveSection period={period} />
          </Suspense>

          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white">Signal Pulse Grid</h2>
            <div className="grid gap-6 md:grid-cols-2">
              <Suspense fallback={<Skeleton className="h-[300px] w-full rounded-xl" />}>
                <AssetSignalSection 
                  ticker="QQQ" 
                  title="NDX vs 250MA" 
                  description="Trend regime — drives TIGER_2X ↔ KODEX_1X rotation" 
                  period={period} 
                />
              </Suspense>
              <Suspense fallback={<Skeleton className="h-[300px] w-full rounded-xl" />}>
                <MSTRZScoreSectionWrapper period={period} />
              </Suspense>
              <Suspense fallback={<Skeleton className="h-[300px] w-full rounded-xl" />}>
                <AssetSignalSection 
                  ticker="GLDM" 
                  title="Gold vs 250MA" 
                  description="Defensive regime — monitors GLDM relative to trend" 
                  period={period} 
                />
              </Suspense>
              <Suspense fallback={<Skeleton className="h-[300px] w-full rounded-xl" />}>
                <AssetSignalSection 
                  ticker="TLT" 
                  title="Bonds vs 250MA" 
                  description="Duration regime — monitors TLT relative to trend" 
                  period={period} 
                />
              </Suspense>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <Suspense fallback={<Skeleton className="h-[400px] w-full rounded-xl" />}>
            <PortfolioSummaryCard />
          </Suspense>

          <Suspense fallback={<Skeleton className="h-[600px] w-full rounded-xl" />}>
            <AssetAllocationSection />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

// Small helper to maintain naming consistency with the file created
async function MSTRZScoreSectionWrapper({ period }: { period: string }) {
  return <MSTRSignalSection period={period} />;
}
