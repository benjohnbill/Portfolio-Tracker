import { WeeklyReportView } from '@/components/reports/WeeklyReportView';
import { getLatestWeeklyReport } from '@/lib/api';


export default async function ThisWeekPage() {
  const report = await getLatestWeeklyReport();

  if (!report) {
    return <div className="p-8 text-white">Unable to load this week&apos;s report.</div>;
  }

  return (
    <WeeklyReportView
      report={report}
      eyebrow="This Week"
      title="Weekly Decision Surface"
      description={`Week Ending ${report.weekEnding} · Generated ${new Date(report.generatedAt).toLocaleString()}`}
    />
  );
}
