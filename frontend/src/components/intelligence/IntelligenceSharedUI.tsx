/**
 * Shared UI primitives extracted from the legacy IntelligenceDashboard
 * during Phase UX-1b Task 1. Used by RSC section components.
 *
 * Both are CLIENT components because they use tailwind classes with
 * variant logic and the heatmap carries hover interactivity.
 */

"use client";

import { AttributionData } from '@/lib/api';

export function DataDensityBadge({ weeks }: { weeks: number }) {
  if (weeks < 4) {
    return (
      <div className="px-3 py-1 rounded-full bg-accent border border-border/40 text-xs text-muted-foreground">
        Getting started — {weeks} week{weeks !== 1 ? 's' : ''} of data
      </div>
    );
  }
  if (weeks < 12) {
    return (
      <div className="px-3 py-1 rounded-full bg-amber-900/20 border border-amber-800/30 text-xs text-[#D4A574]">
        Early data — {weeks} weeks analyzed
      </div>
    );
  }
  return (
    <div className="px-3 py-1 rounded-full bg-emerald-900/20 border border-emerald-800/30 text-xs text-emerald-400">
      {weeks} weeks analyzed
    </div>
  );
}

export function ContributionHeatmap({ attributions }: { attributions: AttributionData[] }) {
  if (attributions.length === 0) {
    return (
      <div className="grid grid-cols-[repeat(52,12px)] gap-[2px]">
        {Array.from({ length: 52 }).map((_, i) => (
          <div key={i} className="w-3 h-3 rounded-sm border border-border/30" />
        ))}
      </div>
    );
  }

  const maxScore = 100;
  return (
    <div className="grid grid-cols-[repeat(52,12px)] gap-[2px]">
      {Array.from({ length: 52 }).map((_, i) => {
        const attr = attributions[attributions.length - 52 + i];
        if (!attr) {
          return <div key={i} className="w-3 h-3 rounded-sm border border-border/30" />;
        }
        const opacity = Math.max(0.2, attr.totalScore / maxScore);
        return (
          <div
            key={i}
            className="w-3 h-3 rounded-sm cursor-pointer transition-transform hover:scale-150"
            style={{ backgroundColor: `rgba(212, 165, 116, ${opacity})` }}
            title={`${attr.snapshotDate}: ${attr.totalScore}/100`}
          />
        );
      })}
    </div>
  );
}
