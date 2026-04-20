import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { RiskAdjustedScorecard } from "../RiskAdjustedScorecard";
import type { RiskAdjustedScorecardPayload } from "@/lib/api";

function nullMetrics() {
  return { cagr: null, mdd: null, sd: null, sharpe: null, calmar: null, sortino: null };
}

const emptyPayload: RiskAdjustedScorecardPayload = {
  ready: false,
  based_on_freezes: 4,
  based_on_weeks: 4,
  first_freeze_date: "2026-03-20",
  maturity_gate: { required_weeks: 26, current_weeks: 4, ready: false },
  horizons: {
    "6M": { portfolio: nullMetrics(), spy_krw: nullMetrics() },
    "1Y": { portfolio: nullMetrics(), spy_krw: nullMetrics() },
    ITD: { portfolio: nullMetrics(), spy_krw: nullMetrics() },
  },
};

test("renders empty-state with freeze counter", () => {
  const { container } = render(<RiskAdjustedScorecard payload={emptyPayload} />);
  expect(screen.getByText(/4\s*\/\s*26\s*freezes accumulated/i)).toBeInTheDocument();
  const dashes = container.querySelectorAll("td");
  const dashCount = Array.from(dashes).filter((td) =>
    td.textContent?.includes("—")
  ).length;
  expect(dashCount).toBeGreaterThan(0);
});

test("renders ready-state with populated metrics", () => {
  const readyPayload: RiskAdjustedScorecardPayload = {
    ...emptyPayload,
    ready: true,
    based_on_freezes: 30,
    based_on_weeks: 30,
    maturity_gate: { required_weeks: 26, current_weeks: 30, ready: true },
    horizons: {
      "6M": { portfolio: { ...nullMetrics(), calmar: 0.6, sharpe: 0.5 }, spy_krw: { ...nullMetrics(), calmar: 0.5 } },
      "1Y": { portfolio: { ...nullMetrics(), calmar: 0.7, sharpe: 0.6 }, spy_krw: { ...nullMetrics(), calmar: 0.55 } },
      ITD: { portfolio: { ...nullMetrics(), calmar: 0.65 }, spy_krw: { ...nullMetrics(), calmar: 0.52 } },
    },
  };
  render(<RiskAdjustedScorecard payload={readyPayload} />);
  expect(screen.getByText(/30\s*\/\s*26\s*freezes accumulated/i)).toBeInTheDocument();
  expect(screen.getByText(/0\.70/)).toBeInTheDocument(); // 1Y portfolio calmar
});
