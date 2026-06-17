import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2 } from 'lucide-react';
import { CurrencyInput } from '@/components/ui/currency-input';
import { cleanDocument } from '@/lib/cpfCnpjMask';
import { supabase } from '@/integrations/supabase/client';
import { useProductLookups } from '@/hooks/useProductLookups';
import { useLegalEntities } from '@/hooks/useLegalEntities';
import { useQuickQuote, useQuickQuoteMutations, QuickQuote, QuickQuoteStatus, QuickQuoteItem } from '@/hooks/useQuickQuotes';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  dealId: string;
  defaultLegalEntityId: string | null;
  defaultCompanyId?: string | null;
  editing: QuickQuote | null;
}

interface DraftItem {
  family_id: string | null;
  class_id: string | null;
  tipo_id: string | null;
  grupo_id: string | null;
  subgrupo_id: string | null;
  description: string;
  quantity: number;
  unit: string | null;
  unit_price: number;
  notes: string | null;
  width: number | null;
  length: number | null;
  thickness: number | null;
  fator: number | null;
  weight: number;
}

const emptyItem = (): DraftItem => ({
  family_id: null, class_id: null, tipo_id: null, grupo_id: null, subgrupo_id: null,
  description: '', quantity: 1, unit: 'UN', unit_price: 0, notes: null,
  width: null, length: null, thickness: null, fator: null, weight: 0,
});

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();


const STATUSES: { value: QuickQuoteStatus; label: string }[] = [
  { value: 'draft', label: 'Rascunho' },
  { value: 'sent', label: 'Enviado' },
  { value: 'approved', label: 'Aprovado' },
  { value: 'rejected', label: 'Reprovado' },
  { value: 'expired', label: 'Expirado' },
];

export function QuickQuoteDialog({ open, onOpenChange, dealId, defaultLegalEntityId, defaultCompanyId, editing }: Props) {
  const { accessibleEntities } = useLegalEntities();
  const { tipos, grupos, subgrupos, familias, classes, unitMeasures } = useProductLookups();
  const { create, update, upsertItems } = useQuickQuoteMutations(dealId);
  const { data: full } = useQuickQuote(editing?.id ?? null);

  const [legalEntityId, setLegalEntityId] = useState<string | null>(defaultLegalEntityId);
  const [status, setStatus] = useState<QuickQuoteStatus>('draft');
  const [validity, setValidity] = useState<string>('');
  const [clientName, setClientName] = useState('');
  const [clientCnpj, setClientCnpj] = useState('');
  const [clientContact, setClientContact] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [companyId, setCompanyId] = useState<string | null>(defaultCompanyId ?? null);
  const [paymentTerms, setPaymentTerms] = useState('');
  const [deliveryTerms, setDeliveryTerms] = useState('');
  const [observations, setObservations] = useState('');
  const [items, setItems] = useState<DraftItem[]>([emptyItem()]);
  const [cnpjSuggestion, setCnpjSuggestion] = useState<{ id: string; name: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Carrega dados quando abrir edição
  useEffect(() => {
    if (!open) return;
    if (editing && full?.quote) {
      const q = full.quote;
      setLegalEntityId(q.legal_entity_id);
      setStatus(q.status);
      setValidity(q.validity_date || '');
      setClientName(q.client_name);
      setClientCnpj(q.client_cnpj || '');
      setClientContact(q.client_contact || '');
      setClientPhone(q.client_phone || '');
      setClientEmail(q.client_email || '');
      setCompanyId(q.company_id);
      setPaymentTerms(q.payment_terms_free || '');
      setDeliveryTerms(q.delivery_terms_free || '');
      setObservations(q.observations || '');
      setItems((full.items || []).map((it: QuickQuoteItem) => ({
        family_id: it.family_id, class_id: it.class_id, tipo_id: it.tipo_id,
        grupo_id: it.grupo_id, subgrupo_id: it.subgrupo_id,
        description: it.description, quantity: Number(it.quantity), unit: it.unit,
        unit_price: Number(it.unit_price), notes: it.notes,
        width: it.width != null ? Number(it.width) : null,
        length: it.length != null ? Number(it.length) : null,
        thickness: it.thickness != null ? Number(it.thickness) : null,
        fator: it.fator != null ? Number(it.fator) : null,
        weight: Number(it.weight || 0),
      })));
    } else if (!editing) {
      // novo
      setLegalEntityId(defaultLegalEntityId);
      setStatus('draft');
      setValidity('');
      setClientName(''); setClientCnpj(''); setClientContact('');
      setClientPhone(''); setClientEmail('');
      setCompanyId(defaultCompanyId ?? null);
      setPaymentTerms(''); setDeliveryTerms(''); setObservations('');
      setItems([emptyItem()]);
      setCnpjSuggestion(null);
    }
  }, [open, editing, full, defaultLegalEntityId, defaultCompanyId]);

  // Lookup CNPJ em companies (debounced)
  useEffect(() => {
    const digits = cleanDocument(clientCnpj);
    if (digits.length !== 14) { setCnpjSuggestion(null); return; }
    let active = true;
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('companies')
        .select('id, name')
        .eq('cnpj', digits)
        .limit(1)
        .maybeSingle();
      if (active && data) setCnpjSuggestion({ id: data.id, name: data.name });
      else if (active) setCnpjSuggestion(null);
    }, 400);
    return () => { active = false; clearTimeout(t); };
  }, [clientCnpj]);

  const totalValue = items.reduce((s, it) => s + (Number(it.quantity || 0) * Number(it.unit_price || 0)), 0);

  const composeDescription = (it: DraftItem) => {
    const parts = [
      familias.items.find(x => x.id === it.family_id)?.label,
      grupos.items.find(x => x.id === it.grupo_id)?.label,
      subgrupos.items.find(x => x.id === it.subgrupo_id)?.label,
      classes.items.find(x => x.id === it.class_id)?.label,
    ].filter(Boolean);
    return parts.join(' • ');
  };

  const updateItem = (idx: number, patch: Partial<DraftItem>) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
  };

  const validate = (): string | null => {
    if (!legalEntityId) return 'Selecione o CNPJ de atendimento.';
    if (!clientName.trim()) return 'Informe o nome do cliente.';
    if (clientCnpj && cleanDocument(clientCnpj).length !== 14) return 'CNPJ inválido.';
    if (items.length === 0) return 'Adicione ao menos um item.';
    for (const [i, it] of items.entries()) {
      if (!it.description.trim()) return `Item ${i + 1}: descrição obrigatória.`;
      if (Number(it.quantity) <= 0) return `Item ${i + 1}: quantidade deve ser maior que zero.`;
      if (Number(it.unit_price) < 0) return `Item ${i + 1}: valor unitário não pode ser negativo.`;
    }
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    setSubmitting(true);
    try {
      const payload = {
        legal_entity_id: legalEntityId!,
        client_name: clientName.trim(),
        client_cnpj: clientCnpj ? cleanDocument(clientCnpj) : null,
        client_contact: clientContact || null,
        client_phone: clientPhone || null,
        client_email: clientEmail || null,
        company_id: companyId,
        validity_date: validity || null,
        payment_terms_free: paymentTerms || null,
        delivery_terms_free: deliveryTerms || null,
        observations: observations || null,
      };

      let quoteId = editing?.id;
      if (editing) {
        await update.mutateAsync({ id: editing.id, patch: { ...payload, status } as any });
      } else {
        const created = await create.mutateAsync(payload);
        quoteId = created.id;
      }
      if (quoteId) {
        await upsertItems.mutateAsync({ quoteId, items });
      }
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? `Orçamento ${editing.number || ''}` : 'Novo Orçamento Livre'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Linha topo */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>CNPJ de Atendimento *</Label>
              <Select value={legalEntityId ?? ''} onValueChange={(v) => setLegalEntityId(v)} disabled={!!editing}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {accessibleEntities.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Validade</Label>
              <Input type="date" value={validity} onChange={(e) => setValidity(e.target.value)} />
            </div>
            {editing && (
              <div>
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as QuickQuoteStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Cliente */}
          <div className="border rounded p-3 space-y-3">
            <h4 className="text-sm font-semibold">Cliente (preenchimento livre)</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nome *</Label>
                <Input value={clientName} onChange={(e) => setClientName(e.target.value)} />
              </div>
              <div>
                <Label>CNPJ</Label>
                <Input value={clientCnpj} onChange={(e) => setClientCnpj(e.target.value)} placeholder="Somente números" />
                {cnpjSuggestion && (
                  <button
                    type="button"
                    className="text-xs text-primary mt-1 underline"
                    onClick={() => setCompanyId(cnpjSuggestion.id)}
                  >
                    Vincular a "{cnpjSuggestion.name}" (já cadastrado)
                  </button>
                )}
                {companyId && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Vinculado ao cadastro CRM.
                    <button
                      type="button"
                      className="ml-2 underline"
                      onClick={() => setCompanyId(null)}
                    >desvincular</button>
                  </p>
                )}
              </div>
              <div>
                <Label>Contato</Label>
                <Input value={clientContact} onChange={(e) => setClientContact(e.target.value)} />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} />
              </div>
              <div className="col-span-2">
                <Label>E-mail</Label>
                <Input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Itens */}
          <div className="border rounded p-3 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">Itens</h4>
              <Button size="sm" variant="outline" onClick={() => setItems([...items, emptyItem()])}>
                <Plus className="h-4 w-4 mr-1" /> Adicionar item
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">#</TableHead>
                  <TableHead>Classificação & Descrição</TableHead>
                  <TableHead className="w-[90px]">Qtd</TableHead>
                  <TableHead className="w-[80px]">Un</TableHead>
                  <TableHead className="w-[130px]">Vlr Unit.</TableHead>
                  <TableHead className="w-[130px] text-right">Total</TableHead>
                  <TableHead className="w-[40px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it, i) => (
                  <TableRow key={i}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell>
                      <div className="grid grid-cols-5 gap-1 mb-2">
                        <Select value={it.family_id ?? ''} onValueChange={(v) => updateItem(i, { family_id: v || null })}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Família" /></SelectTrigger>
                          <SelectContent>{familias.items.map(o => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={it.tipo_id ?? ''} onValueChange={(v) => updateItem(i, { tipo_id: v || null })}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Tipo" /></SelectTrigger>
                          <SelectContent>{tipos.items.map(o => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={it.grupo_id ?? ''} onValueChange={(v) => updateItem(i, { grupo_id: v || null })}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Grupo" /></SelectTrigger>
                          <SelectContent>{grupos.items.map(o => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={it.subgrupo_id ?? ''} onValueChange={(v) => updateItem(i, { subgrupo_id: v || null })}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Subgrupo" /></SelectTrigger>
                          <SelectContent>{subgrupos.items.map(o => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={it.class_id ?? ''} onValueChange={(v) => updateItem(i, { class_id: v || null })}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Classe" /></SelectTrigger>
                          <SelectContent>{classes.items.map(o => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="flex gap-1">
                        <Textarea
                          rows={1}
                          placeholder="Descrição do item *"
                          value={it.description}
                          onChange={(e) => updateItem(i, { description: e.target.value })}
                          className="min-h-[36px] text-sm"
                        />
                        <Button
                          type="button" size="sm" variant="ghost"
                          title="Sugerir descrição a partir da classificação"
                          onClick={() => {
                            const suggested = composeDescription(it);
                            if (suggested) updateItem(i, { description: suggested });
                          }}
                        >Sug.</Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number" min="0" step="0.01"
                        value={it.quantity}
                        onChange={(e) => updateItem(i, { quantity: Number(e.target.value) })}
                      />
                    </TableCell>
                    <TableCell>
                      <Select value={it.unit ?? ''} onValueChange={(v) => updateItem(i, { unit: v })}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {unitMeasures.items.map(u => <SelectItem key={u.id} value={u.value}>{u.value}</SelectItem>)}
                          {unitMeasures.items.length === 0 && <SelectItem value="UN">UN</SelectItem>}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <CurrencyInput
                        value={it.unit_price}
                        onChange={(v) => updateItem(i, { unit_price: v })}
                      />
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {(Number(it.quantity || 0) * Number(it.unit_price || 0))
                        .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button" size="icon" variant="ghost"
                        onClick={() => setItems(items.filter((_, idx) => idx !== i))}
                        disabled={items.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex justify-end text-sm font-semibold">
              Total: {totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
          </div>

          {/* Condições */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Condições de Pagamento</Label>
              <Textarea rows={2} value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} />
            </div>
            <div>
              <Label>Condições de Entrega</Label>
              <Textarea rows={2} value={deliveryTerms} onChange={(e) => setDeliveryTerms(e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label>Observações</Label>
              <Textarea rows={3} value={observations} onChange={(e) => setObservations(e.target.value)} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {editing ? 'Salvar' : 'Criar Orçamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
