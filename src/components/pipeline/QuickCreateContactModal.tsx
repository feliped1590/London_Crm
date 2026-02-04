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
import { formatCPF, cleanDocument } from '@/lib/cpfCnpjMask';

interface QuickCreateContactModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (contactId: string) => void;
  initialName?: string;
  companyId?: string | null;
}

export function QuickCreateContactModal({ 
  open, 
  onOpenChange, 
  onCreated,
  initialName = '',
  companyId = null,
}: QuickCreateContactModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    first_name: initialName,
    last_name: '',
    cpf: '',
    email: '',
    phone: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.first_name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.from('contacts').insert({
        first_name: formData.first_name.trim(),
        last_name: formData.last_name?.trim() || null,
        cpf: formData.cpf ? cleanDocument(formData.cpf) : null,
        email: formData.email || null,
        phone: formData.phone || null,
        company_id: companyId,
        created_by: user?.id,
        owner_id: user?.id,
      }).select('id').single();

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['contacts-with-cpf'] });
      toast.success('Contato criado com sucesso!');
      onCreated(data.id);
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar contato');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({ first_name: '', last_name: '', cpf: '', email: '', phone: '' });
  };

  const handleCpfChange = (value: string) => {
    const formatted = formatCPF(value);
    setFormData({ ...formData, cpf: formatted });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Contato (Rápido)</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="qc-contact-first-name">Nome *</Label>
              <Input
                id="qc-contact-first-name"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                placeholder="Nome"
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="qc-contact-last-name">Sobrenome</Label>
              <Input
                id="qc-contact-last-name"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                placeholder="Sobrenome"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="qc-contact-cpf">CPF</Label>
            <Input
              id="qc-contact-cpf"
              value={formData.cpf}
              onChange={(e) => handleCpfChange(e.target.value)}
              placeholder="000.000.000-00"
              maxLength={14}
            />
          </div>
          <div>
            <Label htmlFor="qc-contact-email">Email</Label>
            <Input
              id="qc-contact-email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="email@exemplo.com"
            />
          </div>
          <div>
            <Label htmlFor="qc-contact-phone">Telefone/Celular</Label>
            <Input
              id="qc-contact-phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="(00) 00000-0000"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar Contato
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
