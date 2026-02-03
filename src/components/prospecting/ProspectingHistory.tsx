import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, Search, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Json } from '@/integrations/supabase/types';

interface SearchHistoryItem {
  id: string;
  filters: Json;
  results_count: number | null;
  created_at: string;
}

interface ProspectingHistoryProps {
  history: SearchHistoryItem[] | undefined;
  isLoading: boolean;
}

export function ProspectingHistory({ history, isLoading }: ProspectingHistoryProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <History className="h-4 w-4" />
            Histórico de Buscas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!history || history.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <History className="h-4 w-4" />
            Histórico de Buscas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma busca realizada ainda
          </p>
        </CardContent>
      </Card>
    );
  }

  const getFilterLabel = (filters: Record<string, unknown>) => {
    if (filters.cnpj) {
      return `CNPJ: ${filters.cnpj}`;
    }
    if (filters.razaoSocial) {
      return `Razão: ${filters.razaoSocial}`;
    }
    return 'Busca';
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <History className="h-4 w-4" />
          Histórico de Buscas
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[280px]">
          <div className="space-y-1 p-4 pt-0">
            {history.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm truncate">
                      {getFilterLabel(item.filters as Record<string, unknown>)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(item.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
                <Badge variant="secondary" className="shrink-0">
                  <Building2 className="h-3 w-3 mr-1" />
                  {item.results_count || 0}
                </Badge>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
