import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertTriangle, Building2, Users, Briefcase, Loader2 } from 'lucide-react';
import { CompanyForReallocation, ReallocationFilters } from '@/hooks/usePortfolioReallocation';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ReallocationConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCompanies: CompanyForReallocation[];
  sellers: { id: string; name: string; role: string }[];
  filterContext: ReallocationFilters;
  onConfirm: (
    toUserId: string,
    transferContacts: boolean,
    transferDeals: boolean,
    reason: string
  ) => void;
  isLoading?: boolean;
}

export function ReallocationConfirmModal({
  open,
  onOpenChange,
  selectedCompanies,
  sellers,
  filterContext,
  onConfirm,
  isLoading
}: ReallocationConfirmModalProps) {
  const [toUserId, setToUserId] = useState('');
  const [transferContacts, setTransferContacts] = useState(true);
  const [transferDeals, setTransferDeals] = useState(true);
  const [reason, setReason] = useState('');

  // Agrupar por vendedor atual para mostrar resumo
  const byOwner = selectedCompanies.reduce((acc, company) => {
    const key = company.owner_name || 'Sem responsável';
    if (!acc[key]) acc[key] = [];
    acc[key].push(company);
    return acc;
  }, {} as Record<string, CompanyForReallocation[]>);

  // Excluir vendedores que são donos dos clientes selecionados do destino
  const ownerIds = new Set(selectedCompanies.map(c => c.owner_id).filter(Boolean));
  const availableSellers = sellers.filter(s => !ownerIds.has(s.id));

  const handleConfirm = () => {
    if (!toUserId || !reason.trim()) return;
    onConfirm(toUserId, transferContacts, transferDeals, reason.trim());
  };

  const handleClose = () => {
    setToUserId('');
    setReason('');
    setTransferContacts(true);
    setTransferDeals(true);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Confirmar Remanejamento
          </DialogTitle>
          <DialogDescription>
            Esta ação transferirá os clientes selecionados para outro vendedor.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Resumo da seleção */}
          <div className="bg-muted/50 p-3 rounded-lg">
            <p className="text-sm font-medium mb-2">
              {selectedCompanies.length} cliente(s) selecionado(s):
            </p>
            <ScrollArea className="max-h-32">
              <div className="space-y-1">
                {Object.entries(byOwner).map(([owner, companies]) => (
                  <div key={owner} className="flex items-center gap-2 text-sm">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">De {owner}:</span>
                    <span className="font-medium">{companies.length} cliente(s)</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Seletor de destino */}
          <div className="space-y-2">
            <Label>Transferir para: *</Label>
            <Select value={toUserId} onValueChange={setToUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o novo responsável" />
              </SelectTrigger>
              <SelectContent>
                {availableSellers.map(seller => (
                  <SelectItem key={seller.id} value={seller.id}>
                    {seller.name} ({seller.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Opções de transferência */}
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <Checkbox
                id="transferContacts"
                checked={transferContacts}
                onCheckedChange={(checked) => setTransferContacts(checked === true)}
              />
              <div className="space-y-1">
                <Label htmlFor="transferContacts" className="cursor-pointer flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Transferir contatos relacionados
                </Label>
                <p className="text-xs text-muted-foreground">
                  Inclui todos os contatos vinculados às empresas selecionadas
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Checkbox
                id="transferDeals"
                checked={transferDeals}
                onCheckedChange={(checked) => setTransferDeals(checked === true)}
              />
              <div className="space-y-1">
                <Label htmlFor="transferDeals" className="cursor-pointer flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  Transferir negócios abertos
                </Label>
                <p className="text-xs text-muted-foreground">
                  Inclui negócios em andamento (exceto fechados)
                </p>
              </div>
            </div>
          </div>

          {/* Motivo obrigatório */}
          <div className="space-y-2">
            <Label>Motivo do remanejamento: *</Label>
            <Textarea
              placeholder="Ex: Redistribuição de carteira por região, vendedor desligado, rebalanceamento de carga..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Este registro ficará no histórico de auditoria
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={!toUserId || !reason.trim() || isLoading}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar Transferência
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
