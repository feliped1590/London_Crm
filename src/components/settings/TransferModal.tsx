import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Building2, Users, Briefcase, Loader2 } from 'lucide-react';
import { PortfolioItem } from '@/hooks/usePortfolio';

const typeLabels: Record<string, string> = {
  company: 'empresa(s)',
  contact: 'contato(s)',
  deal: 'negócio(s)'
};

const typeIcons: Record<string, React.ReactNode> = {
  company: <Building2 className="h-4 w-4" />,
  contact: <Users className="h-4 w-4" />,
  deal: <Briefcase className="h-4 w-4" />
};

interface TransferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: PortfolioItem[];
  fromUserId: string | null;
  fromUserName: string;
  users: { id: string; name: string; role: string }[];
  onConfirm: (toUserId: string, transferRelated: boolean, notes?: string) => void;
  isLoading?: boolean;
}

export function TransferModal({
  open,
  onOpenChange,
  items,
  fromUserId,
  fromUserName,
  users,
  onConfirm,
  isLoading
}: TransferModalProps) {
  const [toUserId, setToUserId] = useState('');
  const [transferRelated, setTransferRelated] = useState(true);
  const [notes, setNotes] = useState('');

  const hasCompanies = items.some(i => i.type === 'company');

  // Agrupar itens por tipo
  const groupedItems = items.reduce((acc, item) => {
    if (!acc[item.type]) acc[item.type] = 0;
    acc[item.type]++;
    return acc;
  }, {} as Record<string, number>);

  const handleConfirm = () => {
    if (!toUserId) return;
    onConfirm(toUserId, transferRelated, notes || undefined);
  };

  const availableUsers = users.filter(u => u.id !== fromUserId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Transferir Itens</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Resumo dos itens */}
          <div className="bg-muted/50 p-3 rounded-lg space-y-1">
            <p className="text-sm text-muted-foreground">Itens selecionados:</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(groupedItems).map(([type, count]) => (
                <div key={type} className="flex items-center gap-1 text-sm bg-background px-2 py-1 rounded">
                  {typeIcons[type]}
                  <span>{count} {typeLabels[type]}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              De: <span className="font-medium">{fromUserName}</span>
            </p>
          </div>

          {/* Seletor de destino */}
          <div className="space-y-2">
            <Label>Transferir para:</Label>
            <Select value={toUserId} onValueChange={setToUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um vendedor" />
              </SelectTrigger>
              <SelectContent>
                {availableUsers.map(user => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name} ({user.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Checkbox para transferir relacionados */}
          {hasCompanies && (
            <div className="flex items-start gap-2">
              <Checkbox
                id="transferRelated"
                checked={transferRelated}
                onCheckedChange={(checked) => setTransferRelated(checked === true)}
              />
              <div className="space-y-1">
                <Label htmlFor="transferRelated" className="cursor-pointer">
                  Transferir itens relacionados
                </Label>
                <p className="text-xs text-muted-foreground">
                  Inclui contatos e negócios vinculados às empresas selecionadas
                </p>
              </div>
            </div>
          )}

          {/* Observações */}
          <div className="space-y-2">
            <Label>Observação (opcional)</Label>
            <Textarea
              placeholder="Ex: Vendedor desligado em 24/01/2026"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!toUserId || isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
