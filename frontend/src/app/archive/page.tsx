import { Suspense } from 'react';
import { Archive } from 'lucide-react';

import { ArchiveTimelineSection } from '@/components/archive/ArchiveTimelineSection';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function ArchivePage() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      <div>
        <div className="flex items-center gap-2 text-primary mb-1 text-xs font-bold uppercase tracking-wider">
          <Archive className="w-4 h-4" />
          <span>Archive</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white italic">Decision Memory</h1>
        <p className="text-sm text-muted-foreground mt-1">Browse historical weekly reports, scores, and context.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Suspense fallback={<ArchiveTimelineSkeleton />}>
          <ArchiveTimelineSection />
        </Suspense>
      </div>
    </div>
  );
}

function ArchiveTimelineSkeleton() {
  return (
    <>
      {Array.from({ length: 12 }).map((_, i) => (
        <Card key={i} className="bg-[#11161d] border-border/40 h-full">
          <CardHeader className="space-y-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-3 w-28" />
          </CardContent>
        </Card>
      ))}
    </>
  );
}
