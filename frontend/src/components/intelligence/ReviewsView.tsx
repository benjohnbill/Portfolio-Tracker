"use client";

import { useState } from 'react';
import { ReviewSummaryData, ReviewAggregation, getMonthlyReview, getQuarterlyReview, getAnnualReview } from '@/lib/api';

type PeriodType = 'monthly' | 'quarterly' | 'annual';

function AggregationCard({ data }: { data: ReviewAggregation }) {
  return (
    <div className="bg-card rounded-lg p-5 border border-border/40 space-y-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-mono text-white">{data.period}</h3>
        <span className="text-xs text-muted-foreground">{data.count} week{data.count !== 1 ? 's' : ''}</span>
      </div>

      {data.scores && (
        <div className="grid grid-cols-4 gap-3">
          <div>
            <p className="text-[10px] uppercase text-muted-foreground">Avg</p>
            <p className="text-lg font-mono text-white">{data.scores.avg}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-muted-foreground">Min</p>
            <p className="text-lg font-mono text-red-400">{data.scores.min}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-muted-foreground">Max</p>
            <p className="text-lg font-mono text-emerald-400">{data.scores.max}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-muted-foreground">Trend</p>
            <p className={`text-lg font-mono ${data.scores.trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {data.scores.trend >= 0 ? '+' : ''}{data.scores.trend}
            </p>
          </div>
        </div>
      )}

      {data.fit && data.alignment && data.posture && (
        <div className="flex gap-4 text-xs">
          <span className="text-blue-400">Fit: {data.fit.avg}</span>
          <span className="text-[#D4A574]">Align: {data.alignment.avg}</span>
          <span className="text-emerald-400">Posture: {data.posture.avg}</span>
        </div>
      )}

      {data.ruleStats && data.ruleStats.length > 0 && (
        <div className="text-xs text-muted-foreground">
          {data.ruleStats.length} rule{data.ruleStats.length !== 1 ? 's' : ''} fired
        </div>
      )}
    </div>
  );
}

export function ReviewsView({ summary }: { summary: ReviewSummaryData }) {
  const [periodType, setPeriodType] = useState<PeriodType>('monthly');
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);
  const [reviewData, setReviewData] = useState<ReviewAggregation | null>(null);
  const [loading, setLoading] = useState(false);

  const periods = periodType === 'monthly' ? summary.months
    : periodType === 'quarterly' ? summary.quarters
    : summary.years;

  const handleSelect = async (period: string) => {
    setSelectedPeriod(period);
    setLoading(true);
    const fetcher = periodType === 'monthly' ? getMonthlyReview
      : periodType === 'quarterly' ? getQuarterlyReview
      : getAnnualReview;
    const data = await fetcher(period);
    setReviewData(data);
    setLoading(false);
  };

  if (summary.totalWeeks === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-serif italic text-white">Periodic Reviews</h1>
        <div className="bg-card rounded-lg p-8 border border-border/40 text-center">
          <p className="text-muted-foreground">No attribution data yet. Reviews will appear after your first Friday freeze.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-3xl font-serif italic text-white">Periodic Reviews</h1>
        <span className="text-xs text-muted-foreground">{summary.totalWeeks} weeks of data</span>
      </div>

      {/* Period type selector */}
      <div className="flex gap-2">
        {(['monthly', 'quarterly', 'annual'] as const).map(pt => (
          <button
            key={pt}
            onClick={() => { setPeriodType(pt); setSelectedPeriod(null); setReviewData(null); }}
            className={`px-4 py-1.5 text-xs font-mono rounded transition-colors ${
              periodType === pt
                ? 'bg-primary/20 text-primary border border-primary/40'
                : 'text-muted-foreground hover:text-white border border-border/40'
            }`}
          >
            {pt.charAt(0).toUpperCase() + pt.slice(1)}
          </button>
        ))}
      </div>

      {/* Period chips */}
      <div className="flex flex-wrap gap-2">
        {periods.map(p => (
          <button
            key={p}
            onClick={() => handleSelect(p)}
            className={`px-3 py-1 text-xs font-mono rounded transition-colors ${
              selectedPeriod === p
                ? 'bg-white/10 text-white border border-white/20'
                : 'text-muted-foreground hover:text-white border border-border/40'
            }`}
          >
            {p}
          </button>
        ))}
        {periods.length === 0 && (
          <p className="text-xs text-muted-foreground">No {periodType} data available yet.</p>
        )}
      </div>

      {/* Review detail */}
      {loading && (
        <div className="bg-card rounded-lg p-6 border border-border/40 animate-pulse">
          <div className="h-32 bg-accent/30 rounded" />
        </div>
      )}
      {!loading && reviewData && <AggregationCard data={reviewData} />}
    </div>
  );
}
