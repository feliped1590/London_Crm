import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import { useTransicaoTributaria } from '@/hooks/useTransicaoTributaria';
import { cronogramaTransicao, modeloTributarioOptions } from '@/types/fiscal-reforma';

export function TransicaoTributariaPanel() {
  const { parametros, isLoading, determinarModelo, getPercentuaisTransicao, getAliquotasReferencia } = useTransicaoTributaria();

  const anoAtual = new Date().getFullYear();
  const { modelo } = determinarModelo(new Date());
  const percentuais = getPercentuaisTransicao(anoAtual);
  const aliquotas = getAliquotasReferencia(anoAtual);
  
  const modeloLabel = modeloTributarioOptions.find(o => o.value === modelo)?.label || modelo;
  const progressoTransicao = ((anoAtual - 2025) / 8) * 100; // 2025-2033

  if (isLoading) {
    return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-32 w-full" />)}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Status Atual */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Transição Tributária - {anoAtual}
              </CardTitle>
              <CardDescription>
                EC 132/2023 - Reforma Tributária do Consumo
              </CardDescription>
            </div>
            <Badge variant={modelo === 'legado' ? 'secondary' : modelo === 'novo' ? 'default' : 'outline'}>
              {modeloLabel}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Timeline */}
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>2025 (Legado)</span>
              <span>2033 (Novo)</span>
            </div>
            <Progress value={Math.min(Math.max(progressoTransicao, 0), 100)} className="h-2" />
          </div>

          {/* Tributos Ativos */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Tributos Legados</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ICMS/ISS</span>
                  <span className="font-mono">{percentuais.icms_iss}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">PIS/COFINS</span>
                  <span className="font-mono">{percentuais.pis_cofins}%</span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Novos Tributos</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CBS</span>
                  <span className="font-mono">{percentuais.cbs}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">IBS</span>
                  <span className="font-mono">{percentuais.ibs}%</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alíquotas de Referência */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Alíquotas de Referência</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1">CBS (Federal)</p>
              <p className="text-lg font-bold">{aliquotas.cbs}%</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1">IBS (Total)</p>
              <p className="text-lg font-bold">{aliquotas.ibs}%</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1">IBS Estadual</p>
              <p className="text-lg font-bold">{aliquotas.ibs_estadual}%</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1">IBS Municipal</p>
              <p className="text-lg font-bold">{aliquotas.ibs_municipal}%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cronograma Completo */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Cronograma de Transição</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4">Ano</th>
                  <th className="text-center py-2 px-2">Modelo</th>
                  <th className="text-center py-2 px-2">ICMS/ISS</th>
                  <th className="text-center py-2 px-2">IBS</th>
                  <th className="text-center py-2 px-2">PIS/COF</th>
                  <th className="text-center py-2 px-2">CBS</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(cronogramaTransicao).map(([ano, dados]) => {
                  const anoNum = parseInt(ano);
                  const isAtual = anoNum === anoAtual;
                  return (
                    <tr key={ano} className={`border-b ${isAtual ? 'bg-primary/5 font-medium' : ''}`}>
                      <td className="py-2 pr-4 flex items-center gap-2">
                        {ano}
                        {isAtual && <Badge variant="default" className="text-[10px] h-4">Atual</Badge>}
                      </td>
                      <td className="text-center py-2 px-2">
                        <Badge variant="outline" className="text-[10px]">
                          {dados.modelo === 'legado' ? 'LEG' : dados.modelo === 'dual_teste' ? 'TESTE' : dados.modelo === 'dual_transicao' ? 'TRANS' : 'NOVO'}
                        </Badge>
                      </td>
                      <td className="text-center py-2 px-2 font-mono">{dados.icms}%</td>
                      <td className="text-center py-2 px-2 font-mono">{dados.ibs}%</td>
                      <td className="text-center py-2 px-2 font-mono">{dados.pis_cofins}%</td>
                      <td className="text-center py-2 px-2 font-mono">{dados.cbs}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Alertas */}
      {modelo !== 'legado' && (
        <Card className="border-amber-200 dark:border-amber-800">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
              <div className="space-y-1 text-sm">
                <p className="font-medium">Atenção: Período de transição ativo</p>
                <ul className="text-muted-foreground space-y-1">
                  <li className="flex items-center gap-2">
                    <Clock className="h-3 w-3" />
                    Campos CBS/IBS são obrigatórios em NF-e desde 01/2026
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-3 w-3" />
                    O motor fiscal calcula automaticamente ambos os modelos
                  </li>
                  {!parametros?.length && (
                    <li className="flex items-center gap-2 text-amber-600">
                      <AlertTriangle className="h-3 w-3" />
                      Parâmetros de transição não configurados - usando valores padrão
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
