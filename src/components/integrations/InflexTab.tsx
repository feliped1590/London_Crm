import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Package, ShoppingCart } from 'lucide-react';
import { InflexClientsTab } from './InflexClientsTab';
import { InflexProductsTab } from './InflexProductsTab';
import { InflexOrdersTab } from './InflexOrdersTab';

export function InflexTab() {
  const [activeSubTab, setActiveSubTab] = useState('clientes');

  return (
    <div className="space-y-6">
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <TabsList>
          <TabsTrigger value="clientes" className="gap-2">
            <Users className="h-4 w-4" />
            Clientes
          </TabsTrigger>
          <TabsTrigger value="produtos" className="gap-2">
            <Package className="h-4 w-4" />
            Produtos
          </TabsTrigger>
          <TabsTrigger value="pedidos" className="gap-2">
            <ShoppingCart className="h-4 w-4" />
            Pedidos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="clientes" className="mt-6">
          <InflexClientsTab />
        </TabsContent>

        <TabsContent value="produtos" className="mt-6">
          <InflexProductsTab />
        </TabsContent>

        <TabsContent value="pedidos" className="mt-6">
          <InflexOrdersTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
