import { useDashboardCards, AVAILABLE_CARDS } from '@/hooks/useDashboardCards';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Building2, Layers, Activity, TrendingUp, Handshake } from 'lucide-react';

const ICON_MAP: Record<string, React.ElementType> = {
  Users,
  Building2,
  Layers,
  Activity,
  TrendingUp,
  Handshake,
};

export function CustomerDashboardCards() {
  const { activeCards, metrics, isLoading } = useDashboardCards();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-8 w-16 mb-1" />
              <Skeleton className="h-3 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (activeCards.length === 0) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {activeCards.map((card) => {
        const def = AVAILABLE_CARDS.find((c) => c.key === card.card_key);
        if (!def) return null;
        const Icon = ICON_MAP[def.icon] || Users;
        const data = metrics[card.card_key];

        return (
          <Card key={card.card_key} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4 flex flex-col gap-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Icon className="h-4 w-4" />
                <span className="text-xs font-medium truncate">{def.label}</span>
              </div>
              <p className="text-2xl font-bold text-foreground truncate" title={data?.value ?? '—'}>
                {data?.value ?? '—'}
              </p>
              <p className="text-xs text-muted-foreground truncate" title={data?.subtitle ?? ''}>
                {data?.subtitle ?? ''}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
