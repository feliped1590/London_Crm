import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageCircle, Calendar, RefreshCw, Search, Upload } from 'lucide-react';
import { InstanceManager } from '@/components/whatsapp/InstanceManager';
import { GoogleCalendarSettings } from '@/components/settings/GoogleCalendarSettings';
import { ProspectingApiConfig } from '@/components/settings/ProspectingApiConfig';
import { UnderDevelopmentBanner } from '@/components/UnderDevelopmentBanner';
import { Button } from '@/components/ui/button';

export default function Integrations() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('whatsapp');

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
          <Button onClick={() => navigate('/import-companies')} className="gap-2">
            <Upload className="h-4 w-4" />
            Importar Empresas (XLSX)
          </Button>
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
