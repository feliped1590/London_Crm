import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Building2,
  Users,
  Briefcase,
  ArrowRightLeft,
  History,
  Loader2,
  FolderOpen,
  User
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { usePortfolio, useUsers, UserPortfolio, PortfolioItem } from '@/hooks/usePortfolio';
import { useSalesReps } from '@/hooks/useSalesReps';
import { TransferModal } from './TransferModal';

const typeLabels: Record<string, string> = {
  interno: 'Interno',
  representante: 'Representante',
};

export function PortfolioManager() {
  const { portfolios, isLoadingPortfolios, transfers, isLoadingTransfers, transferItems, isTransferring } = usePortfolio();
  const { data: users } = useUsers();
  const { salesReps } = useSalesReps();

  const [activeTab, setActiveTab] = useState('portfolios');
  const [selectedPortfolio, setSelectedPortfolio] = useState<UserPortfolio | null>(null);
  const [manageDialogOpen, setManageDialogOpen] = useState(false);
  const [entityTab, setEntityTab] = useState<'companies' | 'contacts' | 'deals'>('companies');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [transferModalOpen, setTransferModalOpen] = useState(false);

  // Itens selecionados como array
  const selectedItemsArray = useMemo(() => {
    if (!selectedPortfolio) return [];
    const allItems = [
      ...selectedPortfolio.companies,
      ...selectedPortfolio.contacts,
      ...selectedPortfolio.deals
    ];
    return allItems.filter(item => selectedItems.has(item.id));
  }, [selectedPortfolio, selectedItems]);

  // Itens do tipo atual
  const currentItems = useMemo(() => {
    if (!selectedPortfolio) return [];
    return selectedPortfolio[entityTab];
  }, [selectedPortfolio, entityTab]);

  // Sales reps disponíveis para transferência (exclui o atual)
  const availableSalesReps = useMemo(() => {
    return salesReps
      ?.filter(sr => sr.active && sr.id !== selectedPortfolio?.salesRepId)
      .map(sr => ({ id: sr.id, name: sr.name, role: sr.type || 'interno' })) || [];
  }, [salesReps, selectedPortfolio]);

  const handleOpenManage = (portfolio: UserPortfolio) => {
    setSelectedPortfolio(portfolio);
    setSelectedItems(new Set());
    setEntityTab('companies');
    setManageDialogOpen(true);
  };

  const handleSelectItem = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedItems);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedItems(newSelected);
  };

  const handleSelectAllCurrent = (checked: boolean) => {
    const newSelected = new Set(selectedItems);
    currentItems.forEach(item => {
      if (checked) {
        newSelected.add(item.id);
      } else {
        newSelected.delete(item.id);
      }
    });
    setSelectedItems(newSelected);
  };

  const handleSelectAll = () => {
    if (!selectedPortfolio) return;
    const allIds = [
      ...selectedPortfolio.companies,
      ...selectedPortfolio.contacts,
      ...selectedPortfolio.deals
    ].map(i => i.id);
    setSelectedItems(new Set(allIds));
  };

  const handleTransferConfirm = (toSalesRepId: string, transferRelated: boolean, notes?: string) => {
    transferItems({
      items: selectedItemsArray,
      fromSalesRepId: selectedPortfolio?.salesRepId || null,
      toSalesRepId,
      transferRelated,
      notes
    }, {
      onSuccess: () => {
        setTransferModalOpen(false);
        setManageDialogOpen(false);
        setSelectedItems(new Set());
      }
    });
  };

  const allCurrentSelected = currentItems.length > 0 && currentItems.every(item => selectedItems.has(item.id));

  // Mapa de nomes para histórico (users + sales_reps)
  const usersMap = useMemo(() => {
    const map: Record<string, string> = {};
    users?.forEach(u => { map[u.id] = u.name; });
    return map;
  }, [users]);

  if (isLoadingPortfolios) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="portfolios" className="gap-2">
            <FolderOpen className="h-4 w-4" />
            Carteiras
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="portfolios" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {portfolios?.map(portfolio => {
              const totalItems = portfolio.companies.length + portfolio.contacts.length + portfolio.deals.length;
              return (
                <Card key={portfolio.salesRepId} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{portfolio.salesRepName}</CardTitle>
                          <Badge variant="outline" className="mt-1">
                            {typeLabels[portfolio.salesRepType || 'interno'] || portfolio.salesRepType}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <Building2 className="h-4 w-4" />
                          Empresas
                        </span>
                        <span className="font-medium">{portfolio.companies.length}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <Users className="h-4 w-4" />
                          Contatos
                        </span>
                        <span className="font-medium">{portfolio.contacts.length}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <Briefcase className="h-4 w-4" />
                          Negócios
                        </span>
                        <span className="font-medium">{portfolio.deals.length}</span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => handleOpenManage(portfolio)}
                      disabled={totalItems === 0}
                    >
                      <ArrowRightLeft className="h-4 w-4 mr-2" />
                      Gerenciar
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Histórico de Transferências</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingTransfers ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !transfers?.length ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma transferência registrada
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>De</TableHead>
                      <TableHead>Para</TableHead>
                      <TableHead>Por</TableHead>
                      <TableHead>Obs</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transfers.map(transfer => (
                      <TableRow key={transfer.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(transfer.transferred_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate">
                          {transfer.entity_name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {transfer.entity_type === 'company' && 'Empresa'}
                            {transfer.entity_type === 'contact' && 'Contato'}
                            {transfer.entity_type === 'deal' && 'Negócio'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {transfer.from_user_id ? usersMap[transfer.from_user_id] || '—' : '—'}
                        </TableCell>
                        <TableCell>
                          {usersMap[transfer.to_user_id] || '—'}
                        </TableCell>
                        <TableCell>
                          {usersMap[transfer.transferred_by] || '—'}
                        </TableCell>
                        <TableCell className="max-w-[100px] truncate" title={transfer.notes || ''}>
                          {transfer.notes || '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal de gerenciamento da carteira */}
      <Dialog open={manageDialogOpen} onOpenChange={setManageDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Carteira de: {selectedPortfolio?.salesRepName}
            </DialogTitle>
          </DialogHeader>

          <Tabs value={entityTab} onValueChange={(v) => setEntityTab(v as any)} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="companies" className="gap-2">
                <Building2 className="h-4 w-4" />
                Empresas ({selectedPortfolio?.companies.length || 0})
              </TabsTrigger>
              <TabsTrigger value="contacts" className="gap-2">
                <Users className="h-4 w-4" />
                Contatos ({selectedPortfolio?.contacts.length || 0})
              </TabsTrigger>
              <TabsTrigger value="deals" className="gap-2">
                <Briefcase className="h-4 w-4" />
                Negócios ({selectedPortfolio?.deals.length || 0})
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-hidden mt-4">
              <div className="flex items-center gap-2 mb-2">
                <Checkbox
                  id="selectAllCurrent"
                  checked={allCurrentSelected}
                  onCheckedChange={handleSelectAllCurrent}
                  disabled={currentItems.length === 0}
                />
                <label htmlFor="selectAllCurrent" className="text-sm cursor-pointer">
                  Selecionar todos ({currentItems.length})
                </label>
              </div>

              <ScrollArea className="h-[300px] border rounded-lg">
                {currentItems.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    Nenhum item nesta categoria
                  </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {currentItems.map(item => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 p-2 rounded hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={selectedItems.has(item.id)}
                          onCheckedChange={(checked) => handleSelectItem(item.id, checked === true)}
                        />
                        <span className="flex-1 truncate">{item.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </Tabs>

          <div className="flex items-center justify-between pt-4 border-t mt-4">
            <span className="text-sm text-muted-foreground">
              {selectedItems.size} item(ns) selecionado(s)
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleSelectAll}
                disabled={!selectedPortfolio}
              >
                Selecionar Tudo
              </Button>
              <Button
                onClick={() => setTransferModalOpen(true)}
                disabled={selectedItems.size === 0}
              >
                <ArrowRightLeft className="h-4 w-4 mr-2" />
                Transferir Selecionados
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de transferência */}
      <TransferModal
        open={transferModalOpen}
        onOpenChange={setTransferModalOpen}
        items={selectedItemsArray}
        fromUserId={selectedPortfolio?.salesRepId || null}
        fromUserName={selectedPortfolio?.salesRepName || ''}
        users={availableSalesReps}
        onConfirm={handleTransferConfirm}
        isLoading={isTransferring}
      />
    </div>
  );
}
