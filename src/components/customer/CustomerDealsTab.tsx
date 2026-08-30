import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, TrendingUp, Database } from 'lucide-react';
import { DealStageBadges } from '@/components/DealStageBadges';
import { ERP_ENABLED } from '@/config/features';

interface CustomerDealsTabProps {
  customerId: string;
  deals: any[];
  isErpCustomer: boolean;
  canManageDeals?: boolean;
}

export function CustomerDealsTab({ customerId, deals, isErpCustomer, canManageDeals = true }: CustomerDealsTabProps) {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Processos</CardTitle>
            <CardDescription>
              {isErpCustomer
                ? ERP_ENABLED
                  ? 'Para criar processos com este cliente, primeiro importe-o para o CRM'
                  : 'Para criar processos com este cliente, primeiro converta-o para cliente CRM'
                : 'Processos, serviços e atendimentos deste cliente'}
            </CardDescription>
          </div>
          {!isErpCustomer && canManageDeals && (
            <Button size="sm" className="gap-2" onClick={() => navigate(`/pipeline?newDeal=${customerId}`)}>
              <Plus className="h-4 w-4" />
              Novo processo
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isErpCustomer ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Database className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">Negócios não disponíveis</h3>
            <p className="text-muted-foreground max-w-md">
              {ERP_ENABLED
                ? 'Este cliente é sincronizado do ERP. Para criar negócios, primeiro importe-o para o CRM na tela de Integrações.'
                : 'Este cliente é de origem legada. Para criar negócios, primeiro converta-o para cliente CRM.'}
            </p>
          </div>
        ) : deals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <TrendingUp className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">Nenhum processo</h3>
            <p className="text-muted-foreground">Crie o primeiro processo com este cliente.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Processo</TableHead>
                <TableHead>Etapa</TableHead>
                <TableHead>Previsão</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deals.map((deal: any) => (
                <TableRow key={deal.id} className="cursor-pointer" onClick={() => navigate(`/pipeline?deal=${deal.id}`)}>
                  <TableCell className="font-medium">{deal.name}</TableCell>
                  <TableCell><DealStageBadges deals={[deal]} /></TableCell>
                  <TableCell>
                    {deal.expected_close_date
                      ? new Date(deal.expected_close_date).toLocaleDateString('pt-BR')
                      : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
