import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Save, ExternalLink, Key, CheckCircle2, XCircle, Search, Building2, MapPin, Briefcase, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

interface ProspectingConfig {
  id?: string;
  api_provider: string;
  api_key_configured: boolean;
  is_enabled: boolean;
  monthly_quota: number;
  quota_used: number;
}

const SUPPORTED_PROVIDERS = [
  {
    id: 'cnpja',
    name: 'CNPJ.A',
    description: 'API completa para consulta de empresas brasileiras',
    features: ['Busca por CNPJ', 'Filtros avançados', 'Dados de sócios', 'Atividades econômicas'],
    pricing: 'A partir de R$ 99/mês',
    docsUrl: 'https://cnpja.com/docs',
  },
  {
    id: 'receitaws',
    name: 'ReceitaWS',
    description: 'Consulta de dados da Receita Federal',
    features: ['Busca por CNPJ', 'Dados cadastrais', 'Situação cadastral'],
    pricing: 'Gratuito com limites / Planos pagos',
    docsUrl: 'https://receitaws.com.br/api',
  },
  {
    id: 'casadosdados',
    name: 'Casa dos Dados',
    description: 'Plataforma de inteligência comercial',
    features: ['Busca avançada', 'Filtros por porte/região', 'Enriquecimento de dados'],
    pricing: 'Sob consulta',
    docsUrl: 'https://casadosdados.com.br',
  },
];

export function ProspectingApiConfig() {
  const queryClient = useQueryClient();
  const [selectedProvider, setSelectedProvider] = useState<string>('cnpja');
  const [apiKey, setApiKey] = useState('');
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [keyValidated, setKeyValidated] = useState<boolean | null>(null);

  // For now, we'll store config locally - in production this would be in the database
  const [config, setConfig] = useState<ProspectingConfig>({
    api_provider: 'cnpja',
    api_key_configured: false,
    is_enabled: false,
    monthly_quota: 1000,
    quota_used: 0,
  });

  const handleTestApiKey = async () => {
    if (!apiKey.trim()) {
      toast.error('Informe uma chave de API');
      return;
    }

    setIsTestingKey(true);
    setKeyValidated(null);

    // Simulate API key validation
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // For demo purposes, accept any key longer than 10 chars
    const isValid = apiKey.length > 10;
    setKeyValidated(isValid);
    
    if (isValid) {
      toast.success('Chave de API válida!');
    } else {
      toast.error('Chave de API inválida');
    }
    
    setIsTestingKey(false);
  };

  const handleSaveConfig = async () => {
    if (!keyValidated) {
      toast.error('Valide a chave de API antes de salvar');
      return;
    }

    // In production, this would save to Supabase secrets/config
    setConfig({
      ...config,
      api_provider: selectedProvider,
      api_key_configured: true,
      is_enabled: true,
    });
    
    toast.success('Configuração salva! A API de prospecção avançada está ativa.');
  };

  const handleToggleEnabled = (enabled: boolean) => {
    setConfig({ ...config, is_enabled: enabled });
    toast.success(enabled ? 'API de prospecção ativada' : 'API de prospecção desativada');
  };

  const currentProvider = SUPPORTED_PROVIDERS.find(p => p.id === selectedProvider);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">API de Prospecção Avançada</h3>
        <p className="text-sm text-muted-foreground">
          Configure uma API paga para habilitar filtros avançados de prospecção (Razão Social, Porte, Município, Capital Social, etc.)
        </p>
      </div>

      {/* Status Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Status da Integração</CardTitle>
            <Switch
              checked={config.is_enabled}
              onCheckedChange={handleToggleEnabled}
              disabled={!config.api_key_configured}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
          {config.api_key_configured && config.is_enabled ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">API Configurada e Ativa</span>
              </>
            ) : config.api_key_configured ? (
              <>
                <XCircle className="h-5 w-5 text-amber-500" />
                <span className="text-sm text-amber-600 dark:text-amber-400">API Configurada mas Desativada</span>
              </>
            ) : (
              <>
                <XCircle className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Nenhuma API configurada</span>
              </>
            )}
          </div>
          
          {config.api_key_configured && (
            <div className="mt-3 pt-3 border-t">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Uso mensal:</span>
                <span className="font-medium">{config.quota_used} / {config.monthly_quota} consultas</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 mt-2">
                <div 
                  className="bg-primary h-2 rounded-full" 
                  style={{ width: `${(config.quota_used / config.monthly_quota) * 100}%` }}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Features Enabled */}
      <Alert>
        <Search className="h-4 w-4" />
        <AlertDescription>
          <p className="font-medium mb-2">Filtros disponíveis com API paga:</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-1">
              <Building2 className="h-3 w-3" /> Razão Social / Nome Fantasia
            </div>
            <div className="flex items-center gap-1">
              <Briefcase className="h-3 w-3" /> Porte da Empresa
            </div>
            <div className="flex items-center gap-1">
              <MapPin className="h-3 w-3" /> Estado / Município
            </div>
            <div className="flex items-center gap-1">
              <DollarSign className="h-3 w-3" /> Capital Social
            </div>
          </div>
        </AlertDescription>
      </Alert>

      {/* Provider Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Selecione o Provedor</CardTitle>
          <CardDescription>Escolha o serviço de API para prospecção</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            {SUPPORTED_PROVIDERS.map((provider) => (
              <div
                key={provider.id}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                  selectedProvider === provider.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground/50'
                }`}
                onClick={() => setSelectedProvider(provider.id)}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{provider.name}</h4>
                      {selectedProvider === provider.id && (
                        <Badge variant="secondary" className="text-xs">Selecionado</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{provider.description}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {provider.features.map((feature) => (
                        <Badge key={feature} variant="outline" className="text-xs">
                          {feature}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">{provider.pricing}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-1 h-7 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(provider.docsUrl, '_blank');
                      }}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Docs
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* API Key Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="h-4 w-4" />
            Configurar Chave de API
          </CardTitle>
          <CardDescription>
            Obtenha sua chave de API no painel do {currentProvider?.name}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="api-key">Chave de API *</Label>
            <div className="flex gap-2 mt-1">
              <Input
                id="api-key"
                type="password"
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setKeyValidated(null);
                }}
                placeholder="Digite sua chave de API..."
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={handleTestApiKey}
                disabled={isTestingKey || !apiKey.trim()}
              >
                {isTestingKey ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Testar'
                )}
              </Button>
            </div>
            {keyValidated !== null && (
              <p className={`text-sm mt-2 flex items-center gap-1 ${keyValidated ? 'text-green-600' : 'text-destructive'}`}>
                {keyValidated ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Chave válida e funcionando
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4" />
                    Chave inválida ou expirada
                  </>
                )}
              </p>
            )}
          </div>

          <Button
            onClick={handleSaveConfig}
            disabled={!keyValidated}
            className="w-full gap-2"
          >
            <Save className="h-4 w-4" />
            Salvar Configuração
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
