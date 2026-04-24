import { render, screen, waitFor } from "@testing-library/react";
import { CalmarTrajectoryPlaceholder } from "../CalmarTrajectoryPlaceholder";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

test("renders placeholder with freeze counter after fetch", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      status: 'unavailable',
      ready: false,
      based_on_freezes: 7,
      required_weeks: 52,
      points: [],
      decision_markers: [],
    }),
  }) as unknown as typeof fetch;

  render(<CalmarTrajectoryPlaceholder />);
  await waitFor(() =>
    expect(screen.getByText(/7\s*\/\s*52\s*freezes accumulated/i)).toBeInTheDocument(),
  );
});
