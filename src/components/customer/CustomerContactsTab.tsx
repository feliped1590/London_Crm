import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Phone, Mail, Linkedin, MessageCircle, Users, Database } from 'lucide-react';
import { toast } from 'sonner';
import { formatCPF, cleanDocument } from '@/lib/cpfCnpjMask';
import { CustomFieldsRenderer } from '@/components/CustomFieldsRenderer';
import type { CustomerContact, UnifiedCustomer } from '@/hooks/useCustomerDetail';
import type { Json } from '@/integrations/supabase/types';

interface CustomerContactsTabProps {
  customer: UnifiedCustomer;
  contacts: CustomerContact[];
  saveContactMutation: any;
  deleteContactMutation: any;
}

export function CustomerContactsTab({ customer, contacts, saveContactMutation, deleteContactMutation }: CustomerContactsTabProps) {
  const navigate = useNavigate();
  const isErpCustomer = customer.source === 'erp';

  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<CustomerContact | null>(null);
  const [contactForm, setContactForm] = useState({
    first_name: '', last_name: '', email: '', phone: '', mobile: '',
    job_title: '', department: '', linkedin_url: '', cpf: '', notes: '',
  });
  const [contactCustomFields, setContactCustomFields] = useState<Record<string, unknown>>({});

  const resetContactForm = () => {
    setContactForm({ first_name: '', last_name: '', email: '', phone: '', mobile: '', job_title: '', department: '', linkedin_url: '', cpf: '', notes: '' });
    setContactCustomFields({});
    setEditingContact(null);
    setIsContactDialogOpen(false);
  };

  const handleEditContact = (contact: CustomerContact) => {
    setEditingContact(contact);
    setContactForm({
      first_name: contact.first_name,
      last_name: contact.last_name || '',
      email: contact.email || '',
      phone: contact.phone || '',
      mobile: contact.mobile || '',
      job_title: contact.job_title || '',
      department: contact.department || '',
      linkedin_url: contact.linkedin_url || '',
      cpf: contact.cpf ? formatCPF(contact.cpf) : '',
      notes: contact.notes || '',
    });
    setContactCustomFields((contact.custom_fields as Record<string, unknown>) || {});
    setIsContactDialogOpen(true);
  };

  const handleSaveContact = (e: React.FormEvent) => {
    e.preventDefault();
    const cpfLimpo = contactForm.cpf ? cleanDocument(contactForm.cpf) : null;
    saveContactMutation.mutate(
      { data: { ...contactForm, cpf: cpfLimpo, custom_fields: contactCustomFields as Json }, editingContactId: editingContact?.id || null },
      { onSuccess: () => resetContactForm() },
    );
  };

  const handleOpenWhatsApp = (phone: string | null, contactName: string) => {
    if (!phone) { toast.error('Este contato não possui telefone'); return; }
    navigate(`/whatsapp?phone=${encodeURIComponent(phone)}&contactName=${encodeURIComponent(contactName)}`);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Contatos</CardTitle>
            <CardDescription>
              {isErpCustomer ? 'Contatos não disponíveis para clientes sincronizados do ERP' : 'Pessoas de contato vinculadas a este cliente'}
            </CardDescription>
          </div>
          {!isErpCustomer && (
            <Dialog open={isContactDialogOpen} onOpenChange={(open) => { setIsContactDialogOpen(open); if (!open) resetContactForm(); }}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2"><Plus className="h-4 w-4" />Novo Contato</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>{editingContact ? 'Editar Contato' : 'Novo Contato'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSaveContact} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label htmlFor="contact_first_name">Nome *</Label><Input id="contact_first_name" value={contactForm.first_name} onChange={(e) => setContactForm({ ...contactForm, first_name: e.target.value })} required /></div>
                    <div><Label htmlFor="contact_last_name">Sobrenome</Label><Input id="contact_last_name" value={contactForm.last_name} onChange={(e) => setContactForm({ ...contactForm, last_name: e.target.value })} /></div>
                    <div><Label htmlFor="contact_cpf">CPF</Label><Input id="contact_cpf" value={contactForm.cpf} onChange={(e) => setContactForm({ ...contactForm, cpf: formatCPF(e.target.value) })} maxLength={14} /></div>
                    <div><Label htmlFor="contact_job_title">Cargo</Label><Input id="contact_job_title" value={contactForm.job_title} onChange={(e) => setContactForm({ ...contactForm, job_title: e.target.value })} /></div>
                    <div><Label htmlFor="contact_email">Email</Label><Input id="contact_email" type="email" value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} /></div>
                    <div><Label htmlFor="contact_mobile">Celular</Label><Input id="contact_mobile" value={contactForm.mobile} onChange={(e) => setContactForm({ ...contactForm, mobile: e.target.value })} /></div>
                    <div><Label htmlFor="contact_phone">Telefone</Label><Input id="contact_phone" value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} /></div>
                    <div><Label htmlFor="contact_department">Departamento</Label><Input id="contact_department" value={contactForm.department} onChange={(e) => setContactForm({ ...contactForm, department: e.target.value })} /></div>
                    <div className="col-span-2"><Label htmlFor="contact_linkedin">LinkedIn</Label><Input id="contact_linkedin" value={contactForm.linkedin_url} onChange={(e) => setContactForm({ ...contactForm, linkedin_url: e.target.value })} placeholder="https://linkedin.com/in/..." /></div>
                    <div className="col-span-2"><Label htmlFor="contact_notes">Observações</Label><Textarea id="contact_notes" value={contactForm.notes} onChange={(e) => setContactForm({ ...contactForm, notes: e.target.value })} rows={2} /></div>
                    <CustomFieldsRenderer entity="contact" values={contactCustomFields} onChange={setContactCustomFields} />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={resetContactForm}>Cancelar</Button>
                    <Button type="submit" disabled={saveContactMutation.isPending}>{editingContact ? 'Atualizar' : 'Adicionar'}</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isErpCustomer ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Database className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">Contatos não disponíveis</h3>
            <p className="text-muted-foreground max-w-md">Os contatos de clientes sincronizados do ERP são gerenciados diretamente no sistema de origem.</p>
          </div>
        ) : contacts.length === 0 && customer.contact_name ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
              <div className="flex items-center gap-4">
                <Avatar><AvatarFallback>{customer.contact_name.charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{customer.contact_name}</p>
                    <Badge variant="outline" className="text-xs">Importado</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">Contato importado do arquivo. Clique em "+ Novo Contato" para cadastrar com mais detalhes.</p>
                </div>
              </div>
            </div>
          </div>
        ) : contacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Users className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">Nenhum contato</h3>
            <p className="text-muted-foreground">Adicione o primeiro contato deste cliente.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {contacts.map((contact, index) => (
              <div key={contact.id} className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50">
                <div className="flex items-center gap-4">
                  <Avatar><AvatarFallback>{contact.first_name[0]}{contact.last_name?.[0] || ''}</AvatarFallback></Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{contact.first_name} {contact.last_name}</p>
                      {index === 0 && <Badge variant="default" className="text-xs">Principal</Badge>}
                    </div>
                    {contact.job_title && <p className="text-sm text-muted-foreground">{contact.job_title}</p>}
                    <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                      {contact.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{contact.email}</span>}
                      {contact.mobile && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{contact.mobile}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => handleOpenWhatsApp(contact.mobile, `${contact.first_name} ${contact.last_name || ''}`)} disabled={!contact.mobile} title="WhatsApp"><MessageCircle className="h-4 w-4" /></Button>
                  {contact.linkedin_url && <Button variant="ghost" size="icon" onClick={() => window.open(contact.linkedin_url!, '_blank')} title="LinkedIn"><Linkedin className="h-4 w-4" /></Button>}
                  <Button variant="ghost" size="icon" onClick={() => handleEditContact(contact)} title="Editar"><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => { if (confirm('Remover este contato?')) deleteContactMutation.mutate(contact.id); }} title="Remover"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
