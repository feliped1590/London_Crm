import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageCircle, RefreshCw, FlaskConical } from 'lucide-react';
import { InstanceManager } from '@/components/whatsapp/InstanceManager';
import { InflexTab } from '@/components/integrations/InflexTab';
import { InflexSandboxTab } from '@/components/integrations/InflexSandboxTab';

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
          <TabsTrigger value="iniflex" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Iniflex
          </TabsTrigger>
          <TabsTrigger value="sandbox" className="gap-2">
            <FlaskConical className="h-4 w-4" />
            Sandbox
          </TabsTrigger>
        </TabsList>

        <TabsContent value="whatsapp" className="mt-6">
          <InstanceManager />
        </TabsContent>

        <TabsContent value="iniflex" className="mt-6">
          <InflexTab />
        </TabsContent>

        <TabsContent value="sandbox" className="mt-6">
          <InflexSandboxTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
