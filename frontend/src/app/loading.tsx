export default function Loading() {
  return (
    <div className="space-y-8 animate-pulse p-2">
      <div className="space-y-4">
        <div className="h-4 w-24 bg-accent/50 rounded"></div>
        <div className="h-10 w-1/3 bg-accent/50 rounded"></div>
        <div className="h-4 w-1/4 bg-accent/30 rounded"></div>
      </div>

      {/* Hero Section */}
      <div className="h-32 bg-accent/20 rounded-xl border border-border/30"></div>
      
      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="h-[400px] bg-accent/20 rounded-xl border border-border/30"></div>
        <div className="h-[400px] bg-accent/20 rounded-xl border border-border/30"></div>
      </div>
    </div>
  );
}
