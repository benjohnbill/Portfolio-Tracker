import { getMSTRHistory } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { MSTRZScoreChart } from '@/components/features/MSTRZScoreChart';

export async function MSTRSignalSection({ period }: { period: string }) {
  const mstrHistory = await getMSTRHistory(period);

  return (
    <Card className="bg-[#11161d] border-border/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold text-white">MSTR Z-Score</CardTitle>
        <CardDescription className="text-xs">Mean-reversion signal — drives MSTR ↔ DBMF rotation</CardDescription>
      </CardHeader>
      <CardContent>
        <MSTRZScoreChart data={mstrHistory} />
      </CardContent>
    </Card>
  );
}
