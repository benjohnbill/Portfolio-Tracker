import { Suspense } from 'react';

import { FridayBriefingSection } from '@/components/friday/FridayBriefingSection';
import { FridayReportSection } from '@/components/friday/FridayReportSection';
import { FridaySleeveSection } from '@/components/friday/FridaySleeveSection';
import { Skeleton } from '@/components/ui/skeleton';
import { SkeletonList } from '@/components/ui/skeleton-patterns';


export default function FridayPage() {
  return (
    <main className="space-y-8 animate-in fade-in duration-500 pb-12">
      <Suspense fallback={<BriefingSkeleton />}>
        <FridayBriefingSection />
      </Suspense>

      <Suspense fallback={<ReportSkeleton />}>
        <FridayReportSection />
      </Suspense>

      <Suspense fallback={<SleeveSkeleton />}>
        <FridaySleeveSection />
      </Suspense>
    </main>
  );
}

// Skeleton shapes mirror the loaded-state components to avoid layout shift
// when each panel streams in. See /frontend/src/components/friday/
// SinceLastFridayBriefing.tsx + FridayDashboard.tsx + SleeveHealthPanel.tsx.

function BriefingSkeleton() {
  // Mirrors SinceLastFridayBriefing: card with title row + description + 3-ish
  // rounded event rows.
  return (
    <div className="rounded-lg border border-border/40 p-6 space-y-3">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-3 w-56" />
      <div className="space-y-2 pt-2">
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
    </div>
  );
}

function ReportSkeleton() {
  // Mirrors FridayDashboard: title row, 5-column hero strip (score / freeze
  // status / freeze button), then portfolio + signals in a 12-col split.
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-3 w-96" />
        </div>
        <Skeleton className="h-6 w-32 rounded-full" />
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <div className="xl:col-span-2 rounded-lg border border-border/40 p-6 space-y-3">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-12 w-32" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        </div>
        <div className="xl:col-span-2 rounded-lg border border-border/40 p-6 space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-48" />
          <div className="grid gap-3 md:grid-cols-3">
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        </div>
        <div className="rounded-lg border border-border/40 p-6 space-y-3">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-3 w-36" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-7 space-y-4">
          <SkeletonList count={3} itemShape="card" />
        </div>
        <div className="lg:col-span-5 space-y-4">
          <SkeletonList count={3} itemShape="card" />
        </div>
      </div>
    </div>
  );
}

function SleeveSkeleton() {
  // Mirrors SleeveHealthPanel: card header + 6 sleeve rows
  // (NDX / DBMF / BRAZIL / MSTR / GLDM / BONDS-CASH).
  return (
    <div className="rounded-lg border border-border/40 p-6 space-y-3">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-3 w-64" />
      <div className="space-y-2 pt-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
