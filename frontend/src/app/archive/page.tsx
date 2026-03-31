import Link from 'next/link';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getWeeklyReports } from '@/lib/api';
import { Archive, CalendarRange, ChevronRight } from 'lucide-react';


export default async function ArchivePage() {
  const reports = await getWeeklyReports(52);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      <div>
        <div className="flex items-center gap-2 text-primary mb-1 text-xs font-bold uppercase tracking-wider">
          <Archive className="w-4 h-4" />
          <span>Archive</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white italic">Decision Memory</h1>
        <p className="text-sm text-muted-foreground mt-1">Browse historical weekly reports, scores, and context.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {reports.length === 0 ? (
          <Card className="bg-[#11161d] border-border/40 md:col-span-2 xl:col-span-3">
            <CardContent className="p-6 text-sm text-muted-foreground">No archived weekly reports found yet.</CardContent>
          </Card>
        ) : reports.map((report) => (
          <Link key={report.weekEnding} href={`/archive/${report.weekEnding}`}>
            <Card className="bg-[#11161d] border-border/40 h-full hover:border-primary/40 transition-colors">
              <CardHeader>
                <CardDescription className="flex items-center gap-2"><CalendarRange className="w-4 h-4" /> {report.weekEnding}</CardDescription>
                <CardTitle className="text-white flex items-center justify-between gap-3">
                  <span>Score {report.score ?? '—'}</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-1">
                <p>Status: {report.status}</p>
                <p>Generated: {report.generatedAt ? new Date(report.generatedAt).toLocaleString() : '—'}</p>
                <p>Logic: {report.logicVersion}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
