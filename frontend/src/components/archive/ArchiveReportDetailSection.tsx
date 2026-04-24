/**
 * RSC async child for the report detail view on /archive/[weekEnding].
 * Phase UX-1c Task 2.
 */

import { WeeklyReportView } from '@/components/reports/WeeklyReportView';
import { getWeeklyReport } from '@/lib/api';
import { isReady } from '@/lib/envelope';

export async function ArchiveReportDetailSection({ weekEnding }: { weekEnding: string }) {
  const envelope = await getWeeklyReport(weekEnding);

  if (!isReady(envelope) || envelope.report === null) {
    return (
      <div className="mx-auto max-w-xl rounded-lg border border-border/40 bg-[#11161d] p-6 text-sm text-muted-foreground text-center">
        Archived report for <span className="font-mono text-white">{envelope.week_ending}</span> is unavailable.
      </div>
    );
  }

  const report = envelope.report;
  return (
    <WeeklyReportView
      report={report}
      eyebrow="Archive"
      title={`Week Ending ${report.weekEnding}`}
      description={`Archived report · Generated ${new Date(report.generatedAt).toLocaleString()}`}
      backHref="/archive"
      backLabel="Back to Archive"
    />
  );
}
