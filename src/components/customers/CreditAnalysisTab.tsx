import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload } from 'lucide-react';
import { 
  RefreshCw, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2, 
  Clock,
  ShieldAlert,
  FileText,
  History
} from 'lucide-react';
import {
  useCreditAnalysis,
  useCreditAuditHistory,
  useCanUpdateCreditScore,
  useUpdateCreditScore,
  getScoreValidityStatus,
  getStatusConfig,
} from '@/hooks/useCreditAnalysis';
import { CreditUpdateModal } from './CreditUpdateModal';
import { CreditAuditHistory } from './CreditAuditHistory';
import { CreditDocumentsTab } from './CreditDocumentsTab';

interface CreditAnalysisTabProps {
  companyId: string;
  companyName: string;
  cnpj: string | null;
}

function ScoreGauge({ score }: { score: number | null }) {
  if (score === null) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="text-center">
          <div className="text-4xl font-bold text-muted-foreground">--</div>
          <p className="text-sm text-muted-foreground mt-1">Score não disponível</p>
        </div>
      </div>
    );
  }

  // Score de 300 a 900
  const percentage = Math.min(100, Math.max(0, ((score - 300) / 600) * 100));
  const getScoreColor = () => {
    if (score >= 700) return 'text-green-600';
    if (score >= 500) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-16 overflow-hidden">
        <div className="absolute inset-0 flex items-end justify-center">
          <div 
            className="w-full h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 rounded-t-full"
            style={{ clipPath: 'polygon(0 100%, 100% 100%, 100% 50%, 0 50%)' }}
          />
        </div>
        <div 
          className="absolute bottom-0 left-1/2 w-1 h-14 bg-foreground origin-bottom transform -translate-x-1/2 transition-transform duration-500"
          style={{ transform: `translateX(-50%) rotate(${-90 + (percentage * 1.8)}deg)` }}
        />
      </div>
      <div className={`text-4xl font-bold mt-2 ${getScoreColor()}`}>
        {score}
      </div>
      <p className="text-sm text-muted-foreground">pontos</p>
    </div>
  );
}

function RiskClassificationCard({ risk }: { risk: 'baixo' | 'medio' | 'alto' | null }) {
  const configs = {
    baixo: { 
      icon: CheckCircle2, 
      label: 'Risco Baixo', 
      description: 'Cliente com bom histórico de crédito',
      color: 'text-green-600',
      bg: 'bg-green-50 border-green-200'
    },
    medio: { 
      icon: AlertCircle, 
      label: 'Risco Médio', 
      description: 'Recomenda-se acompanhamento',
      color: 'text-yellow-600',
      bg: 'bg-yellow-50 border-yellow-200'
    },
    alto: { 
      icon: ShieldAlert, 
      label: 'Risco Alto', 
      description: 'Análise detalhada recomendada',
      color: 'text-red-600',
      bg: 'bg-red-50 border-red-200'
    },
  };

  if (!risk) {
    return (
      <div className="rounded-lg border p-4 text-center">
        <p className="text-muted-foreground">Classificação não disponível</p>
      </div>
    );
  }

  const config = configs[risk];
  const Icon = config.icon;

  return (
    <div className={`rounded-lg border p-4 ${config.bg}`}>
      <div className="flex items-center gap-3">
        <Icon className={`h-8 w-8 ${config.color}`} />
        <div>
          <p className={`font-semibold ${config.color}`}>{config.label}</p>
          <p className="text-sm text-muted-foreground">{config.description}</p>
        </div>
      </div>
    </div>
  );
}

export function CreditAnalysisTab({ companyId, companyName, cnpj }: CreditAnalysisTabProps) {
  const [modalOpen, setModalOpen] = useState(false);
  
  const { data: analysis, isLoading: loadingAnalysis } = useCreditAnalysis(companyId);
  const { data: auditHistory, isLoading: loadingAudit } = useCreditAuditHistory(companyId);
  const { data: canUpdate } = useCanUpdateCreditScore();
  const updateMutation = useUpdateCreditScore();

  const validityStatus = getScoreValidityStatus(analysis?.analysis_date);
  const statusConfig = getStatusConfig(validityStatus);

  const handleUpdateCredit = (reason: string) => {
    if (!cnpj) {
      return;
    }
    
    updateMutation.mutate({
      companyId,
      cnpj,
      companyName,
      reason,
    }, {
      onSuccess: () => setModalOpen(false),
    });
  };

  if (!cnpj) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium">CNPJ não cadastrado</h3>
        <p className="text-muted-foreground mt-1">
          Para consultar análise de crédito, é necessário que a empresa tenha um CNPJ cadastrado.
        </p>
      </div>
    );
  }

  if (loadingAnalysis) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-[200px] w-full" />
        <Skeleton className="h-[100px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="resumo">
        <TabsList>
          <TabsTrigger value="resumo" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Resumo
          </TabsTrigger>
          <TabsTrigger value="historico" className="gap-2">
            <History className="h-4 w-4" />
            Histórico de Consultas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="resumo" className="space-y-6 mt-6">
          {/* Header with Status and Update Button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge 
                variant="outline" 
                className={`${statusConfig.bgLight} ${statusConfig.textColor} border-current`}
              >
                <span className={`w-2 h-2 rounded-full ${statusConfig.color} mr-2`} />
                {statusConfig.label}
              </Badge>
              {analysis?.analysis_date && (
                <span className="text-sm text-muted-foreground">
                  Última consulta: {format(new Date(analysis.analysis_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </span>
              )}
            </div>
            
            {canUpdate && (
              <Button 
                onClick={() => setModalOpen(true)}
                disabled={updateMutation.isPending}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${updateMutation.isPending ? 'animate-spin' : ''}`} />
                {analysis ? 'Atualizar Score' : 'Consultar Crédito'}
              </Button>
            )}
          </div>

          {/* Main Content */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Score Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Score de Crédito
                </CardTitle>
                <CardDescription>
                  Pontuação de 300 a 900 pontos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScoreGauge score={analysis?.credit_score ?? null} />
              </CardContent>
            </Card>

            {/* Risk Classification Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5" />
                  Classificação de Risco
                </CardTitle>
                <CardDescription>
                  Avaliação baseada no score e histórico
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RiskClassificationCard risk={analysis?.risk_classification ?? null} />
              </CardContent>
            </Card>
          </div>

          {/* Additional Info */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Status Cadastral
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-medium">
                  {analysis?.cadastral_status || 'Não consultado'}
                </p>
                {analysis?.restrictions_summary && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {analysis.restrictions_summary}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Detalhes da Consulta
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Provedor:</span>
                  <Badge variant="outline">{analysis?.api_provider || 'N/A'}</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Último motivo:</span>
                  <span className="text-right max-w-[200px] truncate">
                    {analysis?.consultation_reason || 'N/A'}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="historico" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="h-5 w-5" />
                Histórico de Consultas
              </CardTitle>
              <CardDescription>
                Todas as consultas realizadas são registradas para auditoria
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CreditAuditHistory records={auditHistory || []} isLoading={loadingAudit} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <CreditUpdateModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onConfirm={handleUpdateCredit}
        isLoading={updateMutation.isPending}
        companyName={companyName}
      />
    </div>
  );
}
