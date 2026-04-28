"use client";

import { TooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { IndicatorWithMeta } from '@/lib/api';

const STATE_BADGE: Record<IndicatorWithMeta['state'], string> = {
  supportive: 'bg-[#0a2010] text-[#4ADE80]',
  neutral: 'bg-[#11161d] text-[#8b95a5] border border-[#2a3040]',
  adverse: 'bg-[#200a0a] text-[#F87171]',
};

const BUCKET_ABBREV: Record<string, string> = {
  'Liquidity/FCI': 'LIQ',
  'Rates': 'RAT',
  'Inflation': 'INF',
  'Growth/Labor': 'GRO',
  'Stress/Sentiment': 'STR',
};

const TIER_LABEL: Record<string, string> = {
  strong_lead_12_18m: 'STRONG LEAD · 12-18M',
  mid_lead_6_12m: 'MID LEAD · 6-12M',
  coincident: 'COINCIDENT',
  weak_lag_1_3m: 'WEAK LAG · 1-3M',
  strong_lag_quarterly: 'STRONG LAG · QUARTERLY',
};

export function IndicatorCard({ indicator }: { indicator: IndicatorWithMeta }) {
  const abbrev = BUCKET_ABBREV[indicator.bucket] ?? '???';
  const stateLabel = indicator.state === 'supportive' ? 'SUP' : indicator.state === 'adverse' ? 'ADV' : 'NEU';

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="bg-card rounded-lg p-4 border border-border/40 hover:border-primary/40 transition-colors flex flex-col gap-2 min-h-[120px]">
            <div className="flex items-center justify-between">
              <span className={`text-[11px] font-mono uppercase px-2 py-[2px] rounded ${STATE_BADGE[indicator.state]}`}>
                {abbrev} · {stateLabel}
              </span>
              {indicator.coreIndicator && (
                <span className="text-[10px] font-mono uppercase text-[#D4A574]">CORE</span>
              )}
            </div>
            <p className="text-sm text-white">{indicator.label}</p>
            <p className="text-2xl font-mono text-white">
              {indicator.value !== null ? `${indicator.value}${indicator.unit === '%' ? '%' : ''}` : '—'}
              {indicator.unit !== '%' && indicator.value !== null && (
                <span className="text-sm text-muted-foreground ml-1">{indicator.unit}</span>
              )}
            </p>
            {indicator.leadLagTier && (
              <span className="text-[10px] font-mono uppercase text-[#5a6577]">
                {TIER_LABEL[indicator.leadLagTier]}
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-sm">
          <div className="space-y-2 text-xs">
            <p className="font-mono uppercase text-[#5a6577]">{indicator.bucket}</p>
            {indicator.definition && (
              <div>
                <p className="font-medium text-white mb-0.5">Definition</p>
                <p className="text-muted-foreground">{indicator.definition}</p>
              </div>
            )}
            {indicator.methodology && (
              <div>
                <p className="font-medium text-white mb-0.5">Methodology</p>
                <p className="text-muted-foreground">{indicator.methodology}</p>
              </div>
            )}
            {indicator.whyItMatters && (
              <div>
                <p className="font-medium text-white mb-0.5">Why it matters</p>
                <p className="text-muted-foreground">{indicator.whyItMatters}</p>
              </div>
            )}
            {indicator.thresholdRationale && (
              <p className="text-[10px] text-muted-foreground italic">{indicator.thresholdRationale} ({indicator.thresholdRationaleSource})</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
