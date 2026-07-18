import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { MessageCircle, Calendar, RefreshCw, Search, Upload, Save, Eye, EyeOff } from 'lucide-react';
import { InstanceManager } from '@/components/whatsapp/InstanceManager';
import { GoogleCalendarSettings } from '@/components/settings/GoogleCalendarSettings';
import { ProspectingApiConfig } from '@/components/settings/ProspectingApiConfig';
import { StagingMonitor } from '@/components/integrations/StagingMonitor';
import { IntegrationValidationPanel } from '@/components/integrations/IntegrationValidationPanel';
import { CustomerPayloadSimulator } from '@/components/integrations/CustomerPayloadSimulator';
import { OrderPayloadSimulator } from '@/components/integrations/OrderPayloadSimulator';
import { ErpMappingsManager } from '@/components/settings/ErpMappingsManager';
import { ErpAttributeMappingManager } from '@/components/settings/ErpAttributeMappingManager';
import { CustomerSyncMonitor } from '@/components/integrations/CustomerSyncMonitor';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { ERP_ENABLED, GOOGLE_CALENDAR_ENABLED } from '@/config/features';

export default function Integrations() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('whatsapp');

  const { data: isDeveloper = false } = useQuery({
    queryKey: ['is-developer', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data } = await (supabase as any).rpc('has_role', { _user_id: user.id, _role: 'desenvolvedor' });
      return !!data;
    },
    enabled: !!user?.id,
  });

  // ERP Config state
  const [erpEndpoint, setErpEndpoint] = useState('');
  const [erpToken, setErpToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);

  useEffect(() => {
    if (activeTab === 'erp' && !configLoaded) {
      loadErpConfig();
    }
  }, [activeTab]);

  const loadErpConfig = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('active_tenant_id')
        .eq('id', session.user.id)
        .single();

      let tenantId = profile?.active_tenant_id;
      if (!tenantId) {
        const { data: ut } = await (supabase as any)
          .from('user_tenants')
          .select('tenant_id')
          .eq('user_id', session.user.id)
          .limit(1)
          .maybeSingle();
        tenantId = ut?.tenant_id;
      }
      if (!tenantId) return;

      const { data } = await (supabase as any)
        .from('tenant_settings')
        .select('settings')
        .eq('tenant_id', tenantId)
        .eq('category', 'erp_integration')
        .maybeSingle();

      if (data?.settings) {
        setErpEndpoint(data.settings.endpoint || '');
        setErpToken(data.settings.token || '');
      }
      setConfigLoaded(true);
    } catch (err) {
      console.error('Error loading ERP config:', err);
    }
  };

  const handleSaveErpConfig = async () => {
    setIsSavingConfig(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const { data: profile } = await supabase
        .from('profiles')
        .select('active_tenant_id')
        .eq('id', session.user.id)
        .single();

      let tenantId = profile?.active_tenant_id;

      if (!tenantId) {
        const { data: ut } = await (supabase as any)
          .from('user_tenants')
          .select('tenant_id')
          .eq('user_id', session.user.id)
          .limit(1)
          .maybeSingle();
        tenantId = ut?.tenant_id;
      }

      if (!tenantId) throw new Error('Tenant não encontrado. Verifique se você está vinculado a uma organização.');

      const { error } = await (supabase as any)
        .from('tenant_settings')
        .upsert({
          tenant_id: tenantId,
          category: 'erp_integration',
          settings: {
            endpoint: erpEndpoint.trim(),
            token: erpToken.trim(),
          },
          updated_at: new Date().toISOString(),
        }, { onConflict: 'tenant_id,category' });

      if (error) throw error;
      toast.success('Configuração ERP salva com sucesso');
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + (err.message || 'erro desconhecido'));
    } finally {
      setIsSavingConfig(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Integrações</h1>
        <p className="text-muted-foreground">Gerencie todas as integrações do CRM</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="whatsapp" className="gap-2">
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </TabsTrigger>
          {GOOGLE_CALENDAR_ENABLED && (
            <TabsTrigger value="google-calendar" className="gap-2">
              <Calendar className="h-4 w-4" />
              Google Calendar
            </TabsTrigger>
          )}
          {ERP_ENABLED && (
            <TabsTrigger value="erp" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              ERP
            </TabsTrigger>
          )}
          <TabsTrigger value="prospecting-api" className="gap-2">
            <Search className="h-4 w-4" />
            API Prospecção
          </TabsTrigger>
        </TabsList>

        <TabsContent value="whatsapp" className="mt-6">
          <InstanceManager />
        </TabsContent>

        {GOOGLE_CALENDAR_ENABLED && (
          <TabsContent value="google-calendar" className="mt-6">
            <GoogleCalendarSettings />
          </TabsContent>
        )}

        {ERP_ENABLED && (
          <TabsContent value="erp" className="mt-6 space-y-6">
            {/* ERP Connection Config */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Configuração da Conexão ERP</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="erp-endpoint">Endpoint da API</Label>
                  <Input
                    id="erp-endpoint"
                    placeholder="https://exemplo.com/api/v1/runtime/endpoint/integracao/..."
                    value={erpEndpoint}
                    onChange={(e) => setErpEndpoint(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="erp-token">Bearer Token</Label>
                  <div className="flex gap-2">
                    <Input
                      id="erp-token"
                      type={showToken ? 'text' : 'password'}
                      placeholder="Token de autenticação do ERP"
                      value={erpToken}
                      onChange={(e) => setErpToken(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setShowToken(!showToken)}
                    >
                      {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    O token será armazenado de forma segura e utilizado nas chamadas ao ERP.
                  </p>
                </div>
                <Button onClick={handleSaveErpConfig} disabled={isSavingConfig || (!erpEndpoint && !erpToken)} className="gap-2">
                  <Save className="h-4 w-4" />
                  {isSavingConfig ? 'Salvando...' : 'Salvar Configuração'}
                </Button>
              </CardContent>
            </Card>

            {/* Import buttons */}
            <div className="flex items-center gap-2">
              <Button onClick={() => navigate('/import-data')} className="gap-2">
                <Upload className="h-4 w-4" />
                Importar Clientes e Produtos (CSV)
              </Button>
            </div>

            <IntegrationValidationPanel />

            <CustomerSyncMonitor />

            <StagingMonitor />

            {isDeveloper && <CustomerPayloadSimulator />}

            {isDeveloper && <OrderPayloadSimulator />}

            {isDeveloper && <ErpMappingsManager />}

            <ErpAttributeMappingManager />
          </TabsContent>
        )}

        <TabsContent value="prospecting-api" className="mt-6">
          <ProspectingApiConfig />
        </TabsContent>
      </Tabs>
    </div>
  );
}
