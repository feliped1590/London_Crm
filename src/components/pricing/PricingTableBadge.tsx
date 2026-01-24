import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DollarSign, Link2, Unlink } from 'lucide-react';
import { usePricingTables } from '@/hooks/usePricingTables';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface PricingTableBadgeProps {
  entityType: 'company' | 'contact';
  entityId: string;
  compact?: boolean;
}

export function PricingTableBadge({ entityType, entityId, compact = false }: PricingTableBadgeProps) {
  const { isAdmin } = useModulePermissions();
  const { pricingTables, getTableForEntity, assignTable, unassignTable, isPending } = usePricingTables();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTableId, setSelectedTableId] = useState<string>('');

  const linkedTable = getTableForEntity(entityType, entityId);

  const handleAssign = () => {
    if (selectedTableId) {
      assignTable({
        pricing_table_id: selectedTableId,
        entity_type: entityType,
        entity_id: entityId,
        created_by: null,
      });
      setDialogOpen(false);
      setSelectedTableId('');
    }
  };

  const handleUnassign = () => {
    unassignTable({ entityType, entityId });
    setDialogOpen(false);
  };

  if (compact) {
    if (!linkedTable) {
      if (!isAdmin) return null;
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-primary"
                onClick={() => setDialogOpen(true)}
              >
                <Link2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Vincular tabela de preços</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return (
      <>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="secondary"
                className="gap-1 cursor-pointer hover:bg-secondary/80"
                onClick={() => isAdmin && setDialogOpen(true)}
              >
                <DollarSign className="h-3 w-3" />
                {linkedTable.name}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              {isAdmin ? 'Clique para alterar' : `Tabela de preços: ${linkedTable.name}`}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Tabela de Preços</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium">Tabela Vinculada</label>
                <Select value={selectedTableId || linkedTable?.id || ''} onValueChange={setSelectedTableId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma tabela" />
                  </SelectTrigger>
                  <SelectContent>
                    {pricingTables.filter((t) => t.is_active).map((table) => (
                      <SelectItem key={table.id} value={table.id}>
                        {table.name}
                        {table.is_default && ' (Padrão)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="flex gap-2">
              {linkedTable && (
                <Button variant="destructive" onClick={handleUnassign} disabled={isPending}>
                  <Unlink className="h-4 w-4 mr-2" />
                  Remover Vínculo
                </Button>
              )}
              <Button onClick={handleAssign} disabled={isPending || !selectedTableId}>
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Full version for detail views
  return (
    <div className="flex items-center gap-2">
      {linkedTable ? (
        <Badge variant="secondary" className="gap-1.5 px-2 py-1">
          <DollarSign className="h-3.5 w-3.5" />
          {linkedTable.name}
        </Badge>
      ) : (
        <span className="text-sm text-muted-foreground">Nenhuma tabela vinculada</span>
      )}

      {isAdmin && (
        <Button variant="ghost" size="sm" onClick={() => setDialogOpen(true)}>
          {linkedTable ? 'Alterar' : 'Vincular'}
        </Button>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tabela de Preços</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Selecione a Tabela</label>
              <Select
                value={selectedTableId || linkedTable?.id || ''}
                onValueChange={setSelectedTableId}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Selecione uma tabela" />
                </SelectTrigger>
                <SelectContent>
                  {pricingTables.filter((t) => t.is_active).map((table) => (
                    <SelectItem key={table.id} value={table.id}>
                      {table.name}
                      {table.is_default && ' (Padrão)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {pricingTables.length === 0 && (
                <p className="text-sm text-muted-foreground mt-2">
                  Nenhuma tabela de preços disponível. Crie uma em Configurações.
                </p>
              )}
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            {linkedTable && (
              <Button variant="destructive" onClick={handleUnassign} disabled={isPending}>
                <Unlink className="h-4 w-4 mr-2" />
                Remover
              </Button>
            )}
            <Button onClick={handleAssign} disabled={isPending || !selectedTableId}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
