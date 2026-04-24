/**
 * RSC async child for the 52-card weekly-report timeline on /archive.
 * Phase UX-1c Task 1.
 */

import Link from 'next/link';
import { Archive, CalendarRange, ChevronRight } from 'lucide-react';

import { getWeeklyReports } from '@/lib/api';
import { isReady } from '@/lib/envelope';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export async function ArchiveTimelineSection() {
  const envelope = await getWeeklyReports(52);

  if (!isReady(envelope) || envelope.reports.length === 0) {
    return (
      <Card className="bg-[#11161d] border-border/40 md:col-span-2 xl:col-span-3">
        <CardContent className="p-6 text-sm text-muted-foreground flex items-center gap-2">
          <Archive className="w-4 h-4" />
          <span>No archived weekly reports found yet.</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {envelope.reports.map((report) => (
        <Link key={report.weekEnding} href={`/archive/${report.weekEnding}`}>
          <Card className="bg-[#11161d] border-border/40 h-full hover:border-primary/40 transition-colors">
            <CardHeader>
              <CardDescription className="flex items-center gap-2">
                <CalendarRange className="w-4 h-4" /> {report.weekEnding}
              </CardDescription>
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
    </>
  );
}
