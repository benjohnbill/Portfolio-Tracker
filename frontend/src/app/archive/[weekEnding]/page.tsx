import { WeeklyReportView } from '@/components/reports/WeeklyReportView';
import { getWeeklyReport } from '@/lib/api';


export default async function ArchiveReportDetailPage({ params }: { params: Promise<{ weekEnding: string }> }) {
  const { weekEnding } = await params;
  const report = await getWeeklyReport(weekEnding);

  if (!report) {
    return <div className="p-8 text-white">Unable to load archived report.</div>;
  }

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
