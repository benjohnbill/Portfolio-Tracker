"use client";

import { useEffect, useState } from "react";
import { fetchCalmarTrajectory, type CalmarTrajectoryPayload } from "@/lib/api";

export function CalmarTrajectoryPlaceholder() {
  const [payload, setPayload] = useState<CalmarTrajectoryPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCalmarTrajectory()
      .then((p) => {
        if (!cancelled) setPayload(p);
      })
      .catch(() => {
        if (!cancelled) {
          setPayload({ ready: false, based_on_freezes: 0, required_weeks: 52, points: [], decision_markers: [] });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const freezes = payload?.based_on_freezes ?? 0;
  const required = payload?.required_weeks ?? 52;

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-950 p-6">
      <header className="mb-3 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-neutral-100">Calmar Trajectory</h2>
        <span className="text-sm text-neutral-400">
          {freezes} / {required} freezes accumulated
        </span>
      </header>
      <p className="text-sm italic text-neutral-500">
        Trajectory line unlocks at {required} freezes. Decision markers will accumulate here.
      </p>
    </section>
  );
}
