import { getAssetHistoryCached as getAssetHistory } from '@/lib/api-rsc-cache';
import type { NDXHistoryPoint } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { NDXTrendChart } from '@/components/features/NDXTrendChart';

interface AssetSignalSectionProps {
  ticker: string;
  title: string;
  description: string;
  period: string;
  preloaded?: NDXHistoryPoint[];
}

export async function AssetSignalSection({ ticker, title, description, period, preloaded }: AssetSignalSectionProps) {
  const history = preloaded ?? (await getAssetHistory(ticker, period));

  return (
    <Card className="bg-[#11161d] border-border/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold text-white">{title}</CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <NDXTrendChart data={history} />
      </CardContent>
    </Card>
  );
}
