import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useInflexConfig } from '@/hooks/useInflexConfig';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Play, 
  RefreshCw, 
  CheckCircle2, 
  XCircle,
  AlertCircle,
  Clock,
  Zap,
  RotateCcw,
  History,
  Terminal,
  Settings2,
  Info,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SandboxTestResult {
  success: boolean;
  test_result: {
    success: boolean;
    httpStatus: number | null;
    latencyMs: number;
    request: {
      url: string;
      payload: unknown;
      hasToken: boolean;
      tokenLength: number;
      tokenPreview: string;
    };
    response: {
      raw: unknown;
      text?: string;
    };
    error?: string;
  };
  timestamp: string;
}

interface SandboxLog {
  id: string;
  request_payload: Record<string, unknown>;
  response_payload: unknown;
  http_status: number | null;
  latency_ms: number | null;
  error_message: string | null;
  created_at: string;
}

const DEFAULT_PAYLOAD = {
  tipoComando: "ASDCOMANDO",
  grupoComando: "EXP_CLIENTE",
  "#out#p_retorno": "T",
  json: {
    cnpj_cpf: 14649675000170
  }
};

export function InflexSandboxTab() {
  const queryClient = useQueryClient();
  const { config, updateConfig, clearConfig, isConfigured, isTokenInvalid } = useInflexConfig();
  
  const [payloadJson, setPayloadJson] = useState(JSON.stringify(DEFAULT_PAYLOAD, null, 2));
  const [timeoutMs, setTimeoutMs] = useState(15000);
  const [lastResult, setLastResult] = useState<SandboxTestResult | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Buscar logs anteriores
  const { data: logs, isLoading: isLoadingLogs, refetch: refetchLogs } = useQuery({
    queryKey: ['iniflex-sandbox-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('iniflex_sandbox_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as SandboxLog[];
    },
  });

  // Mutation para testar conexão (validação rápida)
  const connectionTestMutation = useMutation({
    mutationFn: async () => {
      // Payload mínimo para testar autenticação
      const testPayload = {
        tipoComando: "CONSULTA",
        grupoComando: "PING",
      };
      const { data, error } = await supabase.functions.invoke('iniflex-sandbox-test', {
        body: { 
          payload: testPayload, 
          timeout_ms: 10000, 
          save_log: false,
          api_url: config.baseUrl,
          api_token: config.token,
        },
      });
      if (error) throw error;
      return data as SandboxTestResult;
    },
    onSuccess: (data) => {
      if (data.test_result.httpStatus === 401) {
        toast.error('Falha na autenticação: Token inválido ou não informado');
      } else if (data.test_result.httpStatus === 404) {
        toast.error('URL não encontrada: Verifique o endpoint');
      } else if (data.test_result.success || data.test_result.httpStatus === 200) {
        toast.success('Conexão OK! Autenticação válida');
      } else {
        toast.warning(`Resposta recebida (HTTP ${data.test_result.httpStatus})`);
      }
    },
    onError: (error: Error) => {
      toast.error(`Erro de conexão: ${error.message}`);
    },
  });

  // Mutation para executar teste
  const testMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data, error } = await supabase.functions.invoke('iniflex-sandbox-test', {
        body: { 
          payload, 
          timeout_ms: timeoutMs, 
          save_log: true,
          api_url: config.baseUrl,
          api_token: config.token,
        },
      });
      if (error) throw error;
      return data as SandboxTestResult;
    },
    onSuccess: (data) => {
      setLastResult(data);
      queryClient.invalidateQueries({ queryKey: ['iniflex-sandbox-logs'] });
      if (data.test_result.success) {
        toast.success('Teste executado com sucesso!');
      } else {
        toast.error(`Teste falhou: ${data.test_result.error || 'Erro HTTP ' + data.test_result.httpStatus}`);
      }
    },
    onError: (error: Error) => {
      toast.error(`Erro ao executar teste: ${error.message}`);
    },
  });

  const handleExecuteTest = () => {
    if (!isConfigured) {
      toast.error('Preencha a URL e o Token antes de executar');
      return;
    }
    try {
      const payload = JSON.parse(payloadJson);
      setJsonError(null);
      testMutation.mutate(payload);
    } catch (e) {
      setJsonError('JSON inválido: ' + (e as Error).message);
      toast.error('Payload JSON inválido');
    }
  };

  const handleRestoreDefault = () => {
    setPayloadJson(JSON.stringify(DEFAULT_PAYLOAD, null, 2));
    setJsonError(null);
  };

  const handleLoadFromLog = (log: SandboxLog) => {
    setPayloadJson(JSON.stringify(log.request_payload, null, 2));
    setJsonError(null);
  };

  const handleTestConnection = () => {
    if (!isConfigured) {
      toast.error('Preencha a URL e o Token antes de testar');
      return;
    }
    connectionTestMutation.mutate();
  };

  const validateJson = (value: string) => {
    try {
      JSON.parse(value);
      setJsonError(null);
    } catch (e) {
      setJsonError((e as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">Sandbox Iniflex</h2>
            <Badge variant="outline" className="text-amber-500 border-amber-500/50">
              Admin
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Ambiente de teste isolado para validação da API Iniflex
          </p>
        </div>
      </div>

      {/* Alerta se token corrompido */}
      {isTokenInvalid && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              <strong>Token corrompido detectado!</strong> O token armazenado está em formato inválido (bytes). 
              Clique em "Limpar" e insira o token novamente.
            </span>
            <Button variant="destructive" size="sm" onClick={clearConfig} className="ml-4">
              <Trash2 className="h-3 w-3 mr-1" />
              Limpar Agora
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Alerta se não configurado */}
      {!isConfigured && !isTokenInvalid && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Configuração obrigatória:</strong> Preencha a URL da API e o Token para usar o Sandbox.
            As credenciais são salvas localmente no seu navegador.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Configuration & Execute */}
        <div className="space-y-6">
          {/* Integration Config Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Settings2 className="h-5 w-5" />
                  <CardTitle className="text-base">Configuração Sandbox</CardTitle>
                </div>
                {isConfigured ? (
                  <Badge className="bg-emerald-600 hover:bg-emerald-700">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Configurado
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    <AlertCircle className="h-3 w-3 mr-1" /> Pendente
                  </Badge>
                )}
              </div>
              <CardDescription>
                As credenciais são salvas no localStorage do navegador (não no servidor)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <TooltipProvider>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label className="text-destructive">URL da API *</Label>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs text-xs">
                          URL completa do endpoint Iniflex (ex: https://iniflex.novafix.ind.br/api/v1/...)
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input 
                    value={config.baseUrl}
                    onChange={(e) => updateConfig({ baseUrl: e.target.value })}
                    placeholder="https://iniflex.novafix.ind.br/api/v1/runtime/endpoint/integracao/iniflex/json"
                    className={`font-mono text-xs ${!config.baseUrl.trim() ? 'border-destructive' : ''}`}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label className="text-destructive">Token de Autenticação *</Label>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs text-xs">
                          Token de autenticação da API Iniflex (será enviado no campo "chave" do payload)
                        </p>
                      </TooltipContent>
                    </Tooltip>
                    {config.token && (
                      <Badge variant="secondary" className="text-xs">
                        {config.token.length} caracteres
                      </Badge>
                    )}
                  </div>
                  <Input 
                    type="password"
                    value={config.token}
                    onChange={(e) => updateConfig({ token: e.target.value })}
                    placeholder="Cole o token aqui..."
                    className={`font-mono text-xs ${!config.token.trim() ? 'border-destructive' : ''}`}
                  />
                </div>
              </TooltipProvider>

              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleTestConnection}
                  disabled={connectionTestMutation.isPending || !isConfigured}
                  className="gap-1"
                >
                  {connectionTestMutation.isPending ? (
                    <RefreshCw className="h-3 w-3 animate-spin" />
                  ) : (
                    <Zap className="h-3 w-3" />
                  )}
                  Testar Conexão
                </Button>
                {isConfigured && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={clearConfig}
                    className="gap-1 text-xs text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                    Limpar
                  </Button>
                )}
              </div>

              <div className="space-y-2">
                <Label>Timeout (ms)</Label>
                <Input 
                  type="number"
                  value={timeoutMs}
                  onChange={(e) => setTimeoutMs(Number(e.target.value))}
                  min={1000}
                  max={60000}
                  step={1000}
                />
              </div>
            </CardContent>
          </Card>

          {/* Command Terminal */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal className="h-5 w-5" />
                  <CardTitle className="text-base">Terminal de Comandos</CardTitle>
                  <Badge variant="outline" className="text-amber-500 border-amber-500/50">
                    Admin
                  </Badge>
                </div>
                <Button variant="ghost" size="sm" onClick={handleRestoreDefault} className="gap-1">
                  <RotateCcw className="h-4 w-4" />
                  Restaurar padrão
                </Button>
              </div>
              <CardDescription>Envie comandos JSON customizados para a API Iniflex</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Comando JSON</Label>
                <Textarea 
                  value={payloadJson}
                  onChange={(e) => {
                    setPayloadJson(e.target.value);
                    validateJson(e.target.value);
                  }}
                  placeholder="Digite o payload JSON..."
                  className={`font-mono text-sm min-h-[200px] ${jsonError ? 'border-red-500' : ''}`}
                />
                {jsonError && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <XCircle className="h-3 w-3" /> {jsonError}
                  </p>
                )}
              </div>

              <Button 
                onClick={handleExecuteTest}
                disabled={testMutation.isPending || !!jsonError || !isConfigured}
                className="w-full gap-2"
              >
                {testMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                Executar Teste
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right: Results */}
        <div className="space-y-6">
          {/* Last Result */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  <CardTitle className="text-base">Resultado do Teste</CardTitle>
                </div>
                {lastResult && (
                  <div className="flex items-center gap-2">
                    {lastResult.test_result.success ? (
                      <Badge className="bg-emerald-600 hover:bg-emerald-700">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Sucesso
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <XCircle className="h-3 w-3 mr-1" /> Erro
                      </Badge>
                    )}
                    <Badge variant="outline" className="gap-1">
                      <Clock className="h-3 w-3" />
                      {lastResult.test_result.latencyMs}ms
                    </Badge>
                    {lastResult.test_result.httpStatus && (
                      <Badge variant={lastResult.test_result.httpStatus < 400 ? 'secondary' : 'destructive'}>
                        HTTP {lastResult.test_result.httpStatus}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!lastResult ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Terminal className="h-12 w-12 text-muted-foreground/30" />
                  <p className="mt-4 text-muted-foreground">
                    Execute um teste para ver os resultados
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {lastResult.test_result.error && (
                    <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                      <p className="text-sm text-destructive font-medium">Erro:</p>
                      <p className="text-sm text-destructive/80 font-mono">{lastResult.test_result.error}</p>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Resposta da API</Label>
                    <ScrollArea className="h-[300px] rounded-lg border bg-muted/30">
                      <pre className="p-4 text-xs font-mono whitespace-pre-wrap">
                        {JSON.stringify(lastResult.test_result.response.raw, null, 2)}
                      </pre>
                    </ScrollArea>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Logs History */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  <CardTitle className="text-base">Histórico de Testes</CardTitle>
                </div>
                <Button variant="ghost" size="sm" onClick={() => refetchLogs()} className="gap-1">
                  <RefreshCw className={`h-4 w-4 ${isLoadingLogs ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingLogs ? (
                <div className="flex items-center justify-center py-6">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !logs || logs.length === 0 ? (
                <p className="text-center text-muted-foreground py-6">
                  Nenhum teste executado ainda
                </p>
              ) : (
                <ScrollArea className="h-[250px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Quando</TableHead>
                        <TableHead>Comando</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Latência</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(log.created_at), { 
                              addSuffix: true, 
                              locale: ptBR 
                            })}
                          </TableCell>
                          <TableCell className="text-xs font-mono">
                            {String((log.request_payload as Record<string, unknown>)?.grupoComando || 'N/A')}
                          </TableCell>
                          <TableCell>
                            {log.http_status && log.http_status < 400 ? (
                              <Badge variant="secondary" className="text-xs">
                                {log.http_status}
                              </Badge>
                            ) : log.http_status ? (
                              <Badge variant="destructive" className="text-xs">
                                {log.http_status}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">
                                Erro
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            {log.latency_ms ? `${log.latency_ms}ms` : '-'}
                          </TableCell>
                          <TableCell>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleLoadFromLog(log)}
                              className="h-7 px-2"
                            >
                              <RotateCcw className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
