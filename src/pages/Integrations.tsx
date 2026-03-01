import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageCircle, Calendar, RefreshCw, Search, Upload, FileUp } from 'lucide-react';
import { InstanceManager } from '@/components/whatsapp/InstanceManager';
import { GoogleCalendarSettings } from '@/components/settings/GoogleCalendarSettings';
import { ProspectingApiConfig } from '@/components/settings/ProspectingApiConfig';
import { UnderDevelopmentBanner } from '@/components/UnderDevelopmentBanner';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function Integrations() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('whatsapp');
  const [isImporting, setIsImporting] = useState(false);

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsImporting(true);
    try {
      const buffer = await file.arrayBuffer();
      let text: string;
      
      const bytes = new Uint8Array(buffer);
      if (bytes[0] === 0xFF && bytes[1] === 0xFE) {
        text = new TextDecoder('utf-16le').decode(buffer);
      } else if (bytes[0] === 0xFE && bytes[1] === 0xFF) {
        text = new TextDecoder('utf-16be').decode(buffer);
      } else {
        text = new TextDecoder('utf-8').decode(buffer);
      }
      
      text = text.replace(/\0/g, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      
      const { data, error } = await supabase.functions.invoke('import-products-csv', {
        body: { csvContent: text },
      });
      
      if (error) throw error;
      
      if (data.inserted > 0) {
        toast.success(`Importação concluída: ${data.inserted} produtos importados`);
      }
      if (data.insert_errors > 0) {
        toast.warning(`${data.insert_errors} erros de inserção`);
      }
      if (data.warnings?.length > 0) {
        toast.info(`${data.warnings.length} avisos durante o parse`);
      }
      
      queryClient.invalidateQueries({ queryKey: ['products'] });
    } catch (err: any) {
      toast.error('Erro na importação: ' + (err.message || 'erro desconhecido'));
      console.error('Import error:', err);
    } finally {
      setIsImporting(false);
      if (e.target) e.target.value = '';
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
          <TabsTrigger value="google-calendar" className="gap-2">
            <Calendar className="h-4 w-4" />
            Google Calendar
          </TabsTrigger>
          <TabsTrigger value="erp" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            ERP
          </TabsTrigger>
          <TabsTrigger value="prospecting-api" className="gap-2">
            <Search className="h-4 w-4" />
            API Prospecção
          </TabsTrigger>
        </TabsList>

        <TabsContent value="whatsapp" className="mt-6">
          <InstanceManager />
        </TabsContent>

        <TabsContent value="google-calendar" className="mt-6">
          <GoogleCalendarSettings />
        </TabsContent>

        <TabsContent value="erp" className="mt-6 space-y-4">
          <div className="flex items-center gap-2">
            <Button onClick={() => navigate('/import-companies')} className="gap-2">
              <Upload className="h-4 w-4" />
              Importar Empresas (XLSX)
            </Button>
            <Button
              variant="outline"
              disabled={isImporting}
              className="gap-2"
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.csv,.txt';
                input.onchange = (e) => handleImportCSV(e as any);
                input.click();
              }}
            >
              <FileUp className={`h-4 w-4 ${isImporting ? 'animate-spin' : ''}`} />
              {isImporting ? 'Importando...' : 'Importar Produtos (CSV)'}
            </Button>
          </div>
          <UnderDevelopmentBanner 
            title="Integração ERP em Desenvolvimento"
            description="O módulo de integração com o ERP está sendo desenvolvido e será disponibilizado em breve. Funcionalidades como sincronização de clientes, produtos, pedidos e logs estarão disponíveis nesta aba."
          />
        </TabsContent>

        <TabsContent value="prospecting-api" className="mt-6">
          <ProspectingApiConfig />
        </TabsContent>
      </Tabs>
    </div>
  );
}
