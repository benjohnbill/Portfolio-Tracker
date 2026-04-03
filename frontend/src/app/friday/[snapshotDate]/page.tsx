import { FridaySnapshotPanel } from '@/components/friday/FridaySnapshotPanel';
import { getFridaySnapshot } from '@/lib/api';


export default async function FridaySnapshotDetailPage({ params }: { params: Promise<{ snapshotDate: string }> }) {
  const { snapshotDate } = await params;
  const snapshot = await getFridaySnapshot(snapshotDate);

  if (!snapshot) {
    return (
      <div className="space-y-4 p-8 text-white">
        <h1 className="text-2xl font-bold italic">Frozen Friday unavailable</h1>
        <p className="text-sm text-muted-foreground">That snapshot has not been frozen yet, or the backend could not return it.</p>
      </div>
    );
  }

  return (
    <FridaySnapshotPanel
      report={snapshot.frozenReport}
      eyebrow="Friday Archive"
      title={`Frozen Friday · ${snapshot.snapshotDate}`}
      description={`Snapshot created ${snapshot.createdAt ? new Date(snapshot.createdAt).toLocaleString() : 'unknown time'}`}
      backHref="/friday/archive"
      backLabel="Back to Friday Archive"
      decisions={snapshot.decisions}
    />
  );
}
