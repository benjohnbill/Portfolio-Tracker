import type {
  RiskAdjustedScorecardPayload,
  RiskMetricValues,
} from "@/lib/api";
import { isReady } from "@/lib/envelope";

interface Props {
  payload: RiskAdjustedScorecardPayload;
}

const METRIC_KEYS: Array<keyof RiskMetricValues> = [
  "cagr",
  "mdd",
  "sd",
  "sharpe",
  "calmar",
  "sortino",
];

const METRIC_LABELS: Record<keyof RiskMetricValues, string> = {
  cagr: "CAGR",
  mdd: "MDD",
  sd: "SD",
  sharpe: "Sharpe",
  calmar: "Calmar",
  sortino: "Sortino",
};

function fmt(value: number | null): string {
  if (value === null) return "—";
  return value.toFixed(2);
}

export function RiskAdjustedScorecard({ payload }: Props) {
  const { based_on_freezes, maturity_gate, horizons } = payload;
  const ready = isReady(payload);
  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-950 p-6">
      <header className="mb-4 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-neutral-100">Risk-Adjusted Scorecard</h2>
        <span className="text-sm text-neutral-400">
          {based_on_freezes} / {maturity_gate.required_weeks} freezes accumulated
        </span>
      </header>

      {!ready && (
        <p className="mb-4 text-sm italic text-neutral-500">
          Accumulating. Full scorecard unlocks at {maturity_gate.required_weeks} freezes.
        </p>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase text-neutral-500">
            <th className="py-2">Metric</th>
            <th className="py-2">6M</th>
            <th className="py-2">1Y</th>
            <th className="py-2">ITD</th>
          </tr>
        </thead>
        <tbody>
          {METRIC_KEYS.map((key) => (
            <tr key={key} className="border-t border-neutral-800">
              <td className="py-2 text-neutral-300">{METRIC_LABELS[key]}</td>
              <td className="py-2 font-mono text-neutral-100">
                {fmt(horizons["6M"].portfolio[key])}
                <span className="text-neutral-600"> vs </span>
                {fmt(horizons["6M"].spy_krw[key])}
              </td>
              <td className="py-2 font-mono text-neutral-100">
                {fmt(horizons["1Y"].portfolio[key])}
                <span className="text-neutral-600"> vs </span>
                {fmt(horizons["1Y"].spy_krw[key])}
              </td>
              <td className="py-2 font-mono text-neutral-100">
                {fmt(horizons["ITD"].portfolio[key])}
                <span className="text-neutral-600"> vs </span>
                {fmt(horizons["ITD"].spy_krw[key])}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
