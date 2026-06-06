import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Percent, Layers, ScrollText, Settings as SettingsIcon, Inbox } from 'lucide-react';
import { CommissionRulesManager } from './CommissionRulesManager';
import { PaymentTemplatesManager } from './PaymentTemplatesManager';
import { PaymentRulesManager } from './PaymentRulesManager';
import { GovernanceSettingsManager } from './GovernanceSettingsManager';
import { PendingApprovalsManager } from './PendingApprovalsManager';

export function CommercialGovernanceTab() {
  return (
    <Tabs defaultValue="commission" className="w-full">
      <TabsList className="flex-wrap h-auto gap-1">
        <TabsTrigger value="commission" className="gap-2"><Percent className="h-4 w-4" />Comissão</TabsTrigger>
        <TabsTrigger value="templates" className="gap-2"><Layers className="h-4 w-4" />Templates</TabsTrigger>
        <TabsTrigger value="payment-rules" className="gap-2"><ScrollText className="h-4 w-4" />Regras de Pagamento</TabsTrigger>
        <TabsTrigger value="settings" className="gap-2"><SettingsIcon className="h-4 w-4" />Configurações</TabsTrigger>
        <TabsTrigger value="pending" className="gap-2"><Inbox className="h-4 w-4" />Solicitações</TabsTrigger>
      </TabsList>
      <TabsContent value="commission" className="mt-4"><CommissionRulesManager /></TabsContent>
      <TabsContent value="templates" className="mt-4"><PaymentTemplatesManager /></TabsContent>
      <TabsContent value="payment-rules" className="mt-4"><PaymentRulesManager /></TabsContent>
      <TabsContent value="settings" className="mt-4"><GovernanceSettingsManager /></TabsContent>
      <TabsContent value="pending" className="mt-4"><PendingApprovalsManager /></TabsContent>
    </Tabs>
  );
}
