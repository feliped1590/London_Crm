import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageCircle, RefreshCw, FlaskConical, Calendar, FileText } from 'lucide-react';
import { InstanceManager } from '@/components/whatsapp/InstanceManager';
import { InflexTab } from '@/components/integrations/InflexTab';
import { InflexSandboxTab } from '@/components/integrations/InflexSandboxTab';
import { GoogleCalendarSettings } from '@/components/settings/GoogleCalendarSettings';
import { SyncLogsTab } from '@/components/integrations/SyncLogsTab';

export default function Integrations() {
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
          <TabsTrigger value="iniflex" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Iniflex
          </TabsTrigger>
          <TabsTrigger value="sandbox" className="gap-2">
            <FlaskConical className="h-4 w-4" />
            Sandbox
          </TabsTrigger>
          <TabsTrigger value="sync-logs" className="gap-2">
            <FileText className="h-4 w-4" />
            Logs de Sync
          </TabsTrigger>
        </TabsList>

        <TabsContent value="whatsapp" className="mt-6">
          <InstanceManager />
        </TabsContent>

        <TabsContent value="google-calendar" className="mt-6">
          <GoogleCalendarSettings />
        </TabsContent>

        <TabsContent value="iniflex" className="mt-6">
          <InflexTab />
        </TabsContent>

        <TabsContent value="sandbox" className="mt-6">
          <InflexSandboxTab />
        </TabsContent>

        <TabsContent value="sync-logs" className="mt-6">
          <SyncLogsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
