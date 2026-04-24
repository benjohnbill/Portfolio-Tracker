/**
 * RSC async child for the main Friday dashboard (hero + portfolio delta +
 * signals + macro + decisions + archive access).
 *
 * Fetches the current weekly report plus the snapshot list in parallel.
 * If a snapshot exists for this report's week, additionally fetches the
 * full FridaySnapshot (needed for the decision journal). Phase UX-1a D3.
 */

import { FridayDashboard } from '@/components/friday/FridayDashboard';
import { getFridaySnapshot } from '@/lib/api';
import { getFridayCurrentCached, getFridaySnapshotsCached } from '@/lib/friday-fetchers-rsc';
import { isReady } from '@/lib/envelope';


export async function FridayReportSection() {
  const [reportEnvelope, snapshotsEnvelope] = await Promise.all([
    getFridayCurrentCached(),
    getFridaySnapshotsCached(),
  ]);

  if (!isReady(reportEnvelope) || !reportEnvelope.report) {
    return (
      <div className="rounded-lg border border-border/40 p-8 text-sm text-muted-foreground">
        이번 주 리포트를 불러올 수 없어요.
      </div>
    );
  }

  const snapshots = isReady(snapshotsEnvelope) ? snapshotsEnvelope.snapshots : [];
  const report = reportEnvelope.report;
  const currentSnapshot = snapshots.some((item) => item.snapshotDate === report.weekEnding)
    ? await getFridaySnapshot(report.weekEnding)
    : null;

  return <FridayDashboard report={report} snapshots={snapshots} currentSnapshot={currentSnapshot} />;
}
