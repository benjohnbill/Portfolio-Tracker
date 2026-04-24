import { WeeklyReportView } from '@/components/reports/WeeklyReportView';
import { getLatestWeeklyReport } from '@/lib/api';
import { isReady } from '@/lib/envelope';


export default async function WeeklyReportPage() {
  // TODO(ux1-phase1c): remove once /reports/weekly is migrated or deleted (scope-lock §3).
  const envelope = await getLatestWeeklyReport();
  const report = isReady(envelope) ? envelope.report : null;

  if (!report) {
    return <div className="p-8 text-white">Unable to load weekly report.</div>;
  }

  return (
    <WeeklyReportView
      report={report}
      eyebrow="Weekly Report"
      title={`Week Ending ${report.weekEnding}`}
      description={`Generated ${new Date(report.generatedAt).toLocaleString()}`}
      backHref="/"
      backLabel="Back to This Week"
    />
  );
}
