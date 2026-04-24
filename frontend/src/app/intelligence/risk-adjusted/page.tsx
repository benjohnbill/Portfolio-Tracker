"use client";

import { useEffect, useState } from "react";
import { fetchRiskAdjustedScorecard, type RiskAdjustedScorecardPayload } from "@/lib/api";
import { RiskAdjustedScorecard } from "@/components/intelligence/RiskAdjustedScorecard";

function emptyPayload(): RiskAdjustedScorecardPayload {
  const nullMetric = { cagr: null, mdd: null, sd: null, sharpe: null, calmar: null, sortino: null };
  return {
    status: 'unavailable',
    ready: false,
    based_on_freezes: 0,
    based_on_weeks: 0,
    first_freeze_date: null,
    maturity_gate: { required_weeks: 26, current_weeks: 0, ready: false },
    horizons: {
      "6M": { portfolio: { ...nullMetric }, spy_krw: { ...nullMetric } },
      "1Y": { portfolio: { ...nullMetric }, spy_krw: { ...nullMetric } },
      ITD: { portfolio: { ...nullMetric }, spy_krw: { ...nullMetric } },
    },
  };
}

export default function RiskAdjustedPage() {
  const [payload, setPayload] = useState<RiskAdjustedScorecardPayload>(emptyPayload());

  useEffect(() => {
    let cancelled = false;
    fetchRiskAdjustedScorecard()
      .then((p) => { if (!cancelled) setPayload(p); })
      .catch(() => { /* keep empty-state fallback */ });
    return () => { cancelled = true; };
  }, []);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <RiskAdjustedScorecard payload={payload} />
    </main>
  );
}
