import { useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  MessageSquare, 
  Clock, 
  TrendingUp, 
  AlertTriangle, 
  Sparkles,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  User,
  Building,
  Phone,
  ExternalLink
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import {
  useContactMetrics,
  useConversationSummary,
  useConversationObjections,
  useGenerateConversationSummary,
  useUpdateObjectionStatus,
} from '@/hooks/useConversationAnalytics';
import { toast } from 'sonner';

interface ConversationAnalyticsPanelProps {
  phone: string;
  contactId: string | null;
  contactName: string | null;
  companyName?: string | null;
  className?: string;
}

export function ConversationAnalyticsPanel({
  phone,
  contactId,
  contactName,
  companyName,
  className,
}: ConversationAnalyticsPanelProps) {
  const [summaryOpen, setSummaryOpen] = useState(true);
  const [objectionsOpen, setObjectionsOpen] = useState(true);

  const { data: metrics, isLoading: metricsLoading } = useContactMetrics(phone);
  const { data: summary, isLoading: summaryLoading } = useConversationSummary(phone);
  const { data: objections, isLoading: objectionsLoading } = useConversationObjections(phone);
  const generateSummary = useGenerateConversationSummary();
  const updateObjectionStatus = useUpdateObjectionStatus();

  const handleGenerateSummary = () => {
    generateSummary.mutate(
      { phone, contactId },
      {
        onSuccess: () => {
          toast.success('Análise gerada com sucesso!');
        },
        onError: (error) => {
          toast.error('Erro ao gerar análise: ' + (error as Error).message);
        },
      }
    );
  };

  const handleUpdateObjection = (objectionId: string, newStatus: 'raised' | 'addressed' | 'resolved') => {
    updateObjectionStatus.mutate(
      { objectionId, status: newStatus },
      {
        onSuccess: () => {
          toast.success('Status atualizado!');
        },
      }
    );
  };

  const formatPhoneNumber = (p: string) => {
    if (p.length === 13 && p.startsWith('55')) {
      const ddd = p.slice(2, 4);
      const part1 = p.slice(4, 9);
      const part2 = p.slice(9);
      return `(${ddd}) ${part1}-${part2}`;
    }
    return p;
  };

  const getObjectionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      price: 'Preço',
      timing: 'Timing',
      competition: 'Concorrência',
      authority: 'Autoridade',
      need: 'Necessidade',
      other: 'Outro',
    };
    return labels[type] || type;
  };

  const getObjectionTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      price: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      timing: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
      competition: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      authority: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      need: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      other: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
    };
    return colors[type] || colors.other;
  };

  const getSentimentIcon = (sentiment: string | null) => {
    if (sentiment === 'positive') return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    if (sentiment === 'negative') return <XCircle className="h-4 w-4 text-red-500" />;
    return <AlertCircle className="h-4 w-4 text-amber-500" />;
  };

  const getSentimentLabel = (sentiment: string | null) => {
    if (sentiment === 'positive') return 'Positivo';
    if (sentiment === 'negative') return 'Negativo';
    return 'Neutro';
  };

  return (
    <ScrollArea className={cn("h-full", className)}>
      <div className="p-4 space-y-4">
        {/* Header - Contact Info */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{contactName || 'Contato não vinculado'}</span>
            {metrics?.isPending && (
              <Badge variant="destructive" className="text-xs">Pendente</Badge>
            )}
          </div>
          {companyName && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Building className="h-4 w-4" />
              <span>{companyName}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Phone className="h-4 w-4" />
            <span>{formatPhoneNumber(phone)}</span>
          </div>
          {contactId && (
            <Link to={`/contacts?id=${contactId}`}>
              <Button variant="ghost" size="sm" className="gap-1 text-primary">
                <ExternalLink className="h-3 w-3" />
                Ver no CRM
              </Button>
            </Link>
          )}
        </div>

        {/* Quick Metrics */}
        <div className="grid grid-cols-2 gap-2">
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Mensagens</p>
                {metricsLoading ? (
                  <Skeleton className="h-5 w-12" />
                ) : (
                  <p className="text-lg font-semibold">{metrics?.totalMessages || 0}</p>
                )}
              </div>
            </div>
          </Card>

          <Card className="p-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Taxa Resposta</p>
                {metricsLoading ? (
                  <Skeleton className="h-5 w-12" />
                ) : (
                  <p className={cn(
                    "text-lg font-semibold",
                    (metrics?.responseRate || 0) >= 80 ? "text-green-600" :
                    (metrics?.responseRate || 0) >= 50 ? "text-amber-600" : "text-red-600"
                  )}>
                    {metrics?.responseRate || 0}%
                  </p>
                )}
              </div>
            </div>
          </Card>

          <Card className="p-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Tempo Médio</p>
                {metricsLoading ? (
                  <Skeleton className="h-5 w-16" />
                ) : (
                  <p className="text-lg font-semibold">
                    {metrics?.avgResponseTimeMinutes !== null 
                      ? `${metrics.avgResponseTimeMinutes}min` 
                      : '-'}
                  </p>
                )}
              </div>
            </div>
          </Card>

          <Card className="p-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Objeções</p>
                {objectionsLoading ? (
                  <Skeleton className="h-5 w-8" />
                ) : (
                  <p className="text-lg font-semibold">
                    {objections?.filter(o => o.status === 'raised').length || 0}
                  </p>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Timeline info */}
        {metrics && (
          <div className="text-xs text-muted-foreground space-y-1">
            {metrics.firstMessageAt && (
              <p>Primeiro contato: {format(new Date(metrics.firstMessageAt), "d MMM yyyy", { locale: ptBR })}</p>
            )}
            {metrics.lastMessageAt && (
              <p>Última mensagem: {formatDistanceToNow(new Date(metrics.lastMessageAt), { locale: ptBR, addSuffix: true })}</p>
            )}
          </div>
        )}

        {/* AI Summary Section */}
        <Collapsible open={summaryOpen} onOpenChange={setSummaryOpen}>
          <Card>
            <CardHeader className="p-3 pb-0">
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between cursor-pointer">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Resumo IA
                  </CardTitle>
                  {summaryOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="p-3 pt-2 space-y-3">
                {summaryLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                ) : summary ? (
                  <>
                    <p className="text-sm">{summary.summary}</p>
                    
                    <div className="flex items-center gap-2">
                      {getSentimentIcon(summary.sentiment)}
                      <span className="text-xs text-muted-foreground">
                        Sentimento: {getSentimentLabel(summary.sentiment)}
                      </span>
                    </div>

                    {summary.customer_intent && (
                      <Badge variant="outline" className="text-xs">
                        Interesse: {summary.customer_intent}
                      </Badge>
                    )}

                    {summary.next_steps && summary.next_steps.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Próximos passos:</p>
                        <ul className="text-xs space-y-1">
                          {summary.next_steps.map((step, i) => (
                            <li key={i} className="flex items-start gap-1">
                              <span className="text-primary">•</span>
                              {step}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground">
                      Analisado {formatDistanceToNow(new Date(summary.analyzed_at), { locale: ptBR, addSuffix: true })}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhuma análise disponível ainda.</p>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                  onClick={handleGenerateSummary}
                  disabled={generateSummary.isPending}
                >
                  {generateSummary.isPending ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {summary ? 'Atualizar Análise' : 'Gerar Análise'}
                </Button>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Objections Section */}
        <Collapsible open={objectionsOpen} onOpenChange={setObjectionsOpen}>
          <Card>
            <CardHeader className="p-3 pb-0">
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between cursor-pointer">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Objeções Identificadas
                    {objections && objections.filter(o => o.status === 'raised').length > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        {objections.filter(o => o.status === 'raised').length}
                      </Badge>
                    )}
                  </CardTitle>
                  {objectionsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="p-3 pt-2 space-y-2">
                {objectionsLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : objections && objections.length > 0 ? (
                  objections.map((objection) => (
                    <div 
                      key={objection.id} 
                      className={cn(
                        "p-2 rounded-lg border space-y-2",
                        objection.status === 'raised' ? "bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800" :
                        objection.status === 'addressed' ? "bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800" :
                        "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <Badge className={getObjectionTypeColor(objection.type)}>
                          {getObjectionTypeLabel(objection.type)}
                        </Badge>
                        <Badge 
                          variant={
                            objection.status === 'raised' ? 'destructive' :
                            objection.status === 'addressed' ? 'secondary' : 'default'
                          }
                          className="text-xs"
                        >
                          {objection.status === 'raised' ? 'Levantada' :
                           objection.status === 'addressed' ? 'Em tratamento' : 'Resolvida'}
                        </Badge>
                      </div>
                      
                      <p className="text-sm">{objection.description}</p>
                      
                      {objection.message_excerpt && (
                        <p className="text-xs text-muted-foreground italic border-l-2 border-muted pl-2">
                          "{objection.message_excerpt}"
                        </p>
                      )}

                      {objection.status !== 'resolved' && (
                        <div className="flex gap-1">
                          {objection.status === 'raised' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-7"
                              onClick={() => handleUpdateObjection(objection.id, 'addressed')}
                            >
                              Em tratamento
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-7"
                            onClick={() => handleUpdateObjection(objection.id, 'resolved')}
                          >
                            Resolvida
                          </Button>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    Nenhuma objeção identificada
                  </p>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>
    </ScrollArea>
  );
}
