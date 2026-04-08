export default function FridayLoading() {
  return (
    <div className="space-y-8 animate-pulse p-2">
      {/* Friday Hero Strip */}
      <div className="h-24 bg-accent/30 rounded-xl border border-border/40 flex items-center justify-between px-8">
        <div className="space-y-3">
          <div className="h-6 w-32 bg-accent/50 rounded"></div>
          <div className="h-4 w-48 bg-accent/30 rounded"></div>
        </div>
        <div className="h-12 w-32 bg-accent/40 rounded-lg"></div>
      </div>

      {/* Explore Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column - Portfolio */}
        <div className="space-y-4">
          <div className="h-6 w-40 bg-accent/50 rounded"></div>
          <div className="h-64 bg-accent/20 rounded-xl border border-border/30"></div>
        </div>

        {/* Right Column - Macro */}
        <div className="space-y-4">
          <div className="h-6 w-40 bg-accent/50 rounded"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-accent/20 rounded-xl border border-border/30"></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
