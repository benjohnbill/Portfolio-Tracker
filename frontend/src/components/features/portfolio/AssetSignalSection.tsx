import { getAssetHistory } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { NDXTrendChart } from '@/components/features/NDXTrendChart';

interface AssetSignalSectionProps {
  ticker: string;
  title: string;
  description: string;
  period: string;
}

export async function AssetSignalSection({ ticker, title, description, period }: AssetSignalSectionProps) {
  const history = await getAssetHistory(ticker, period);

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
