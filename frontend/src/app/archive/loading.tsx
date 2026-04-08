export default function ArchiveLoading() {
  return (
    <div className="space-y-8 animate-pulse p-2">
      <div className="space-y-4 max-w-2xl mx-auto text-center pb-8">
        <div className="h-8 w-64 bg-accent/50 rounded mx-auto"></div>
        <div className="h-4 w-96 bg-accent/30 rounded mx-auto"></div>
      </div>

      {/* Timeline Skeleton */}
      <div className="max-w-2xl mx-auto space-y-6 relative">
        <div className="absolute left-8 top-0 bottom-0 w-px bg-border/40"></div>
        
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="pl-24 relative">
            {/* Timeline Dot */}
            <div className="absolute left-[29px] top-4 h-3 w-3 rounded-full bg-accent/40 border-2 border-background z-10"></div>
            
            {/* Snapshot Card */}
            <div className="h-48 bg-accent/20 rounded-xl border border-border/30 p-6 space-y-4">
              <div className="h-6 w-1/3 bg-accent/40 rounded"></div>
              <div className="flex gap-4">
                <div className="h-12 w-24 bg-accent/30 rounded"></div>
                <div className="h-12 w-24 bg-accent/30 rounded"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
