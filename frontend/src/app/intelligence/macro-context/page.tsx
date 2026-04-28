import { Suspense } from 'react';

import { CausalMapSection } from '@/components/intelligence/macro-context/CausalMapSection';
import { IndicatorCard } from '@/components/intelligence/macro-context/IndicatorCard';
import { PerformanceTrendChart } from '@/components/intelligence/macro-context/PerformanceTrendChart';
import { Skeleton } from '@/components/ui/skeleton';
import { isReady } from '@/lib/envelope';
import { getMacroContextCached } from '@/lib/macro-context-fetchers-rsc';

export default function MacroContextPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10 space-y-12">
      <Suspense fallback={<HeroSkeleton />}><HeroSection /></Suspense>
      <Suspense fallback={<IndicatorsSkeleton />}><IndicatorsSection /></Suspense>
      <Suspense fallback={<CausalMapSkeleton />}><CausalMapAsync /></Suspense>
      <Suspense fallback={<PositioningSkeleton />}><PositioningSection /></Suspense>
      <Suspense fallback={<PerformanceSkeleton />}><PerformanceSection /></Suspense>
      <Footer />
    </main>
  );
}

async function HeroSection() {
  const env = await getMacroContextCached();
  const ctx = isReady(env) ? env.data : null;
  return (
    <div className="flex items-baseline justify-between">
      <h1 className="text-3xl font-serif italic text-white">Macro Context</h1>
      <div className="flex gap-2 text-[10px] font-mono uppercase">
        <span className="px-2 py-[2px] bg-[#11161d] text-[#5a6577] rounded">RULES v{ctx?.logicVersion.rules ?? '—'}</span>
        <span className="px-2 py-[2px] bg-[#11161d] text-[#5a6577] rounded">META v{ctx?.logicVersion.meta ?? '—'}</span>
        <span className="px-2 py-[2px] bg-[#11161d] text-[#5a6577] rounded">{ctx?.knownAsOf ?? '—'}</span>
      </div>
    </div>
  );
}
function HeroSkeleton() { return <div className="flex items-baseline justify-between"><Skeleton className="h-9 w-56" /><Skeleton className="h-5 w-64" /></div>; }

async function IndicatorsSection() {
  const env = await getMacroContextCached();
  const indicators = isReady(env) ? env.data?.indicators ?? [] : [];
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-serif italic text-white">§1 Indicators</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {indicators.map((ind) => <IndicatorCard key={ind.key} indicator={ind} />)}
      </div>
    </section>
  );
}
function IndicatorsSkeleton() {
  return (
    <section className="space-y-4">
      <Skeleton className="h-7 w-32" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {Array.from({ length: 13 }).map((_, i) => <Skeleton key={i} className="h-[120px] w-full rounded-lg" />)}
      </div>
    </section>
  );
}

async function CausalMapAsync() {
  const env = await getMacroContextCached();
  const ctx = isReady(env) ? env.data : null;
  if (!ctx) return <CausalMapSkeleton />;
  return <CausalMapSection causalMap={ctx.causalMap} performance={ctx.performance} />;
}
function CausalMapSkeleton() {
  return (
    <section className="space-y-4">
      <Skeleton className="h-7 w-32" />
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-64 w-full rounded-lg" />)}
      </div>
    </section>
  );
}

async function PositioningSection() {
  const env = await getMacroContextCached();
  const ctx = isReady(env) ? env.data : null;
  const sleeves = ctx?.positioning.sleeves ?? [];
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-serif italic text-white">§3 Positioning</h2>
      <table className="w-full text-sm">
        <thead className="text-xs uppercase tracking-wider text-muted-foreground">
          <tr><th className="text-left py-2">Sleeve</th><th className="text-right">Current</th><th className="text-right">Target</th><th className="text-left pl-4">Drift</th><th className="text-left pl-4">Band</th></tr>
        </thead>
        <tbody>
          {sleeves.map((s) => {
            const drift = s.targetWeight > 0 ? (s.currentWeight - s.targetWeight) / s.targetWeight : 0;
            const bandClass = s.compatibilityBand === 'below' ? 'bg-[#200a0a] text-[#F87171]' : s.compatibilityBand === 'above' ? 'bg-[#2a1a00] text-[#FBBF24]' : 'bg-[#0a2010] text-[#4ADE80]';
            return (
              <tr key={s.sleeve} className="border-t border-border/20">
                <td className="py-2 font-mono text-white">{s.sleeve}</td>
                <td className="text-right font-mono text-white">{(s.currentWeight * 100).toFixed(1)}%</td>
                <td className="text-right font-mono text-muted-foreground">{(s.targetWeight * 100).toFixed(0)}%</td>
                <td className="pl-4">
                  <div className="h-1 w-24 bg-[#11161d] rounded relative">
                    <div className="absolute h-full bg-[#D4A574] rounded" style={{ width: `${Math.min(Math.abs(drift) * 100, 100)}%` }} />
                  </div>
                </td>
                <td className="pl-4">
                  <span className={`text-[11px] font-mono uppercase px-2 py-[2px] rounded ${bandClass}`}>
                    {s.compatibilityBand}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
function PositioningSkeleton() { return <section className="space-y-4"><Skeleton className="h-7 w-32" /><Skeleton className="h-48 w-full rounded-lg" /></section>; }

async function PerformanceSection() {
  const env = await getMacroContextCached();
  const ctx = isReady(env) ? env.data : null;
  const perf = ctx?.performance;
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-serif italic text-white">§4 Performance</h2>
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Fit', score: perf?.fit, max: 30 },
          { label: 'Alignment', score: perf?.alignment, max: 30 },
          { label: 'Posture', score: perf?.posture, max: 40 },
        ].map((stat) => (
          <div key={stat.label} className="bg-card rounded-lg p-5 border border-border/40">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{stat.label}</p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-mono text-white">{stat.score?.score ?? '—'}<span className="text-sm text-muted-foreground"> / {stat.max}</span></p>
              {stat.score?.deltaVsPriorWeek !== undefined && stat.score?.deltaVsPriorWeek !== null && (
                <span className={`text-xs font-mono ${stat.score.deltaVsPriorWeek >= 0 ? 'text-[#4ADE80]' : 'text-[#F87171]'}`}>
                  {stat.score.deltaVsPriorWeek >= 0 ? '+' : ''}{stat.score.deltaVsPriorWeek}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      <PerformanceTrendChart trends={perf?.trends ?? []} />
    </section>
  );
}
function PerformanceSkeleton() { return <section className="space-y-4"><Skeleton className="h-7 w-32" /><div className="grid grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}</div><Skeleton className="h-48 w-full rounded-lg" /></section>; }

async function Footer() {
  const env = await getMacroContextCached();
  const ctx = isReady(env) ? env.data : null;
  return (
    <footer className="text-[10px] font-mono uppercase text-[#5a6577] pt-6 border-t border-border/20">
      rules v{ctx?.logicVersion.rules ?? '—'} · meta v{ctx?.logicVersion.meta ?? '—'} · known as of {ctx?.knownAsOf ?? '—'}
    </footer>
  );
}
