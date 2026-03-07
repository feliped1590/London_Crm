import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { formatCNPJ, cleanDocument } from '@/lib/cpfCnpjMask';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSalesReps } from '@/hooks/useSalesReps';

interface QuickCreateCompanyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (companyId: string) => void;
  initialName?: string;
}

export function QuickCreateCompanyModal({ 
  open, 
  onOpenChange, 
  onCreated,
  initialName = '' 
}: QuickCreateCompanyModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { myActiveSalesReps, defaultSalesRepId } = useSalesReps();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedSalesRepId, setSelectedSalesRepId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: initialName,
    cnpj: '',
    email: '',
    phone: '',
  });

  // Set default when loaded
  useState(() => {
    if (defaultSalesRepId) setSelectedSalesRepId(defaultSalesRepId);
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.from('companies').insert({
        name: formData.name.trim(),
        cnpj: formData.cnpj ? cleanDocument(formData.cnpj) : null,
        email: formData.email || null,
        phone: formData.phone || null,
        created_by: user?.id,
        owner_id: user?.id,
        sales_rep_id: selectedSalesRepId || null,
      }).select('id').single();

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['companies-with-cnpj'] });
      toast.success('Empresa criada com sucesso!');
      onCreated(data.id);
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar empresa');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({ name: '', cnpj: '', email: '', phone: '' });
  };

  const handleCnpjChange = (value: string) => {
    const formatted = formatCNPJ(value);
    setFormData({ ...formData, cnpj: formatted });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Empresa (Rápido)</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="qc-company-name">Nome da Empresa *</Label>
            <Input
              id="qc-company-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Razão social ou fantasia"
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="qc-company-cnpj">CNPJ</Label>
            <Input
              id="qc-company-cnpj"
              value={formData.cnpj}
              onChange={(e) => handleCnpjChange(e.target.value)}
              placeholder="00.000.000/0000-00"
              maxLength={18}
            />
          </div>
          <div>
            <Label htmlFor="qc-company-email">Email</Label>
            <Input
              id="qc-company-email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="email@empresa.com"
            />
          </div>
          <div>
            <Label htmlFor="qc-company-phone">Telefone</Label>
            <Input
              id="qc-company-phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="(00) 0000-0000"
            />
          </div>
          {myActiveSalesReps.length > 0 && (
            <div>
              <Label>Vendedor Comercial</Label>
              <Select value={selectedSalesRepId || ''} onValueChange={v => setSelectedSalesRepId(v || null)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {myActiveSalesReps.map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar Empresa
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
