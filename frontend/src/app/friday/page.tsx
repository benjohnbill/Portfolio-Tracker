import { FridayDashboard } from '@/components/friday/FridayDashboard';
import {
  getFridayBriefing,
  getFridayCurrent,
  getFridaySleeveHistory,
  getFridaySnapshot,
  getFridaySnapshots,
} from '@/lib/api';


export default async function FridayPage() {
  const [report, snapshots, briefing, sleeveHistory] = await Promise.all([
    getFridayCurrent(),
    getFridaySnapshots(),
    getFridayBriefing(),
    getFridaySleeveHistory(4),
  ]);

  if (!report) {
    return (
      <div className="space-y-4 p-8 text-white">
        <h1 className="text-2xl font-bold italic">Unable to load Friday data</h1>
        <p className="text-sm text-muted-foreground">The Friday backend data is unavailable right now. Check backend connectivity and try again.</p>
      </div>
    );
  }

  const currentSnapshot = snapshots.some((item) => item.snapshotDate === report.weekEnding)
    ? await getFridaySnapshot(report.weekEnding)
    : null;

  return (
    <FridayDashboard
      report={report}
      snapshots={snapshots}
      currentSnapshot={currentSnapshot}
      briefing={briefing}
      sleeveHistory={sleeveHistory}
    />
  );
}
