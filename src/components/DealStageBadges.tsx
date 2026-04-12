import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TrendingUp } from 'lucide-react';

interface Deal {
  id: string;
  name: string;
  stage: string;
  value: number | null;
}

interface DealStageBadgesProps {
  deals: Deal[];
}

const stageLabels: Record<string, string> = {
  prospeccao: 'Prospecção',
  qualificacao: 'Qualificação',
  proposta: 'Proposta',
  negociacao: 'Negociação',
  fechado_ganho: 'Ganho',
  fechado_perdido: 'Perdido',
};

const stageColors: Record<string, string> = {
  prospeccao: 'bg-slate-100 text-slate-700 border-slate-300',
  qualificacao: 'bg-blue-100 text-blue-700 border-blue-300',
  proposta: 'bg-amber-100 text-amber-700 border-amber-300',
  negociacao: 'bg-purple-100 text-purple-700 border-purple-300',
  fechado_ganho: 'bg-green-100 text-green-700 border-green-300',
  fechado_perdido: 'bg-red-100 text-red-700 border-red-300',
};

const stageOrder: string[] = [
  'prospeccao',
  'qualificacao', 
  'proposta',
  'negociacao',
  'fechado_ganho',
  'fechado_perdido',
];

export function DealStageBadges({ deals }: DealStageBadgesProps) {
  if (!deals || deals.length === 0) {
    return <span className="text-muted-foreground text-sm">-</span>;
  }

  // Ordenar negócios pela ordem das etapas
  const sortedDeals = [...deals].sort((a, b) => {
    return stageOrder.indexOf(a.stage) - stageOrder.indexOf(b.stage);
  });

  // Agrupar por etapa para mostrar contador se houver múltiplos na mesma etapa
  const dealsByStage = sortedDeals.reduce((acc, deal) => {
    if (!acc[deal.stage]) {
      acc[deal.stage] = [];
    }
    acc[deal.stage].push(deal);
    return acc;
  }, {} as Record<string, Deal[]>);

  const formatCurrency = (value: number | null) => {
    if (value === null || value === 0) return '';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <TooltipProvider>
      <div className="flex flex-wrap gap-1">
        {Object.entries(dealsByStage).map(([stage, stageDeals]) => (
          <Tooltip key={stage}>
            <TooltipTrigger asChild>
              <Badge 
                variant="outline" 
                className={`text-xs cursor-default gap-1 ${stageColors[stage] || 'bg-slate-100 text-slate-700 border-slate-300'}`}
              >
                <TrendingUp className="h-3 w-3" />
                {stageLabels[stage] || stage}
                {stageDeals.length > 1 && (
                  <span className="ml-0.5 bg-white/50 rounded-full px-1 text-[10px]">
                    {stageDeals.length}
                  </span>
                )}
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <div className="space-y-1">
                <p className="font-semibold text-sm">
                  {stageDeals.length} negócio{stageDeals.length > 1 ? 's' : ''} em {stageLabels[stage] || stage}
                </p>
                <ul className="text-xs space-y-0.5">
                  {stageDeals.map((deal) => (
                    <li key={deal.id} className="flex justify-between gap-4">
                      <span className="truncate">{deal.name}</span>
                      {deal.value ? (
                        <span className="font-medium whitespace-nowrap">
                          {formatCurrency(deal.value)}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
