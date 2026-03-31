import { WeeklyReportView } from '@/components/reports/WeeklyReportView';
import { getLatestWeeklyReport } from '@/lib/api';


export default async function WeeklyReportPage() {
  const report = await getLatestWeeklyReport();

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
