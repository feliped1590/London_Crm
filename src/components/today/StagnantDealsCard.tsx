import { AlertTriangle, Phone, MessageCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { StagnantDeal } from '@/hooks/useTodayData';
import { formatCurrency } from '@/lib/formatters';
import { Link } from 'react-router-dom';

interface StagnantDealsCardProps {
  deals: StagnantDeal[];
  isLoading: boolean;
}

const stageLabels: Record<string, string> = {
  prospeccao: 'Prospecção',
  qualificacao: 'Qualificação',
  proposta: 'Proposta',
  negociacao: 'Negociação',
};

export function StagnantDealsCard({ deals, isLoading }: StagnantDealsCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Deals sem Follow-up
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (deals.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-muted-foreground" />
            Deals sem Follow-up
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <p>Todos os deals estão em dia! 🎉</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-orange-200 dark:border-orange-900">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Deals sem Follow-up
            <Badge variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300">
              {deals.length}
            </Badge>
          </CardTitle>
          <Link to="/pipeline">
            <Button variant="ghost" size="sm">Ver pipeline →</Button>
          </Link>
        </div>
        <p className="text-sm text-muted-foreground">Sem atividade há mais de 5 dias</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {deals.map(deal => {
            const phone = deal.contact?.mobile;
            const whatsappUrl = phone ? `https://wa.me/55${phone.replace(/\D/g, '')}` : null;

            return (
              <div
                key={deal.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-orange-50/50 dark:bg-orange-950/20"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Link to={`/pipeline?deal=${deal.id}`} className="font-medium text-sm hover:underline truncate">
                      {deal.name}
                    </Link>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {deal.days_stagnant} dias
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {deal.value && (
                      <span className="text-sm font-semibold text-primary">
                        {formatCurrency(deal.value)}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {stageLabels[deal.stage] || deal.stage}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {phone && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      asChild
                    >
                      <a href={`tel:${phone}`} title="Ligar">
                        <Phone className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                  {whatsappUrl && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-green-600 hover:text-green-700"
                      asChild
                    >
                      <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" title="WhatsApp">
                        <MessageCircle className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
