/**
 * RSC async child for the Friday snapshot detail page.
 *
 * Fetches a single snapshot by date. Envelope carries per-section coverage
 * flags; ready + partial both render the panel (the panel tolerates missing
 * sub-sections via `??` fallbacks — see CLAUDE.md partial-snapshot safety).
 * Only unavailable renders the placeholder. Phase UX-1a D4.
 */

import { FridaySnapshotPanel } from '@/components/friday/FridaySnapshotPanel';
import { getFridaySnapshot } from '@/lib/api';
import { isUnavailable } from '@/lib/envelope';

export async function FridaySnapshotSection({ date }: { date: string }) {
  const envelope = await getFridaySnapshot(date);

  if (isUnavailable(envelope) || !envelope.snapshot) {
    return (
      <div className="space-y-4 p-8 text-white">
        <h1 className="text-2xl font-bold italic">Frozen Friday unavailable</h1>
        <p className="text-sm text-muted-foreground">
          That snapshot has not been frozen yet, or the backend could not return it.
        </p>
      </div>
    );
  }

  const snapshot = envelope.snapshot;
  return (
    <FridaySnapshotPanel
      report={snapshot.frozenReport}
      eyebrow="Friday Archive"
      title={`Frozen Friday · ${snapshot.snapshotDate}`}
      description={`Snapshot created ${snapshot.createdAt ? new Date(snapshot.createdAt).toLocaleString() : 'unknown time'}`}
      backHref="/friday/archive"
      backLabel="Back to Friday Archive"
      decisions={snapshot.decisions}
      comment={snapshot.comment}
    />
  );
}
