export default function PortfolioLoading() {
  return (
    <div className="space-y-8 animate-pulse p-2">
      <div className="flex justify-between items-end">
        <div className="space-y-4">
          <div className="h-8 w-48 bg-accent/50 rounded"></div>
          <div className="h-4 w-64 bg-accent/30 rounded"></div>
        </div>
        <div className="h-10 w-32 bg-accent/40 rounded-lg"></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-[400px] bg-accent/20 rounded-xl border border-border/30"></div>
        <div className="h-[400px] bg-accent/20 rounded-xl border border-border/30"></div>
      </div>

      <div className="space-y-4 pt-8">
        <div className="h-6 w-32 bg-accent/50 rounded"></div>
        <div className="h-96 bg-accent/20 rounded-xl border border-border/30"></div>
      </div>
    </div>
  );
}
