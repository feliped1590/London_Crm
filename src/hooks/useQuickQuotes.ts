import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useActiveTenantId } from '@/hooks/useActiveTenantId';
import { toast } from 'sonner';

export type QuickQuoteStatus =
  | 'draft' | 'sent' | 'approved' | 'rejected' | 'expired' | 'converted';

export interface QuickQuoteItem {
  id: string;
  quote_id: string;
  sort_order: number;
  family_id: string | null;
  class_id: string | null;
  tipo_id: string | null;
  grupo_id: string | null;
  subgrupo_id: string | null;
  description: string;
  quantity: number;
  unit: string | null;
  unit_price: number;
  total_price: number;
  notes: string | null;
}

export interface QuickQuote {
  id: string;
  tenant_id: string;
  legal_entity_id: string;
  deal_id: string;
  number: string | null;
  status: QuickQuoteStatus;
  validity_date: string | null;
  client_name: string;
  client_cnpj: string | null;
  client_contact: string | null;
  client_phone: string | null;
  client_email: string | null;
  client_notes: string | null;
  company_id: string | null;
  contact_id: string | null;
  payment_terms_free: string | null;
  delivery_terms_free: string | null;
  observations: string | null;
  total_value: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  converted_company_id: string | null;
  converted_proposal_id: string | null;
  converted_at: string | null;
}

export function useQuickQuotesByDeal(dealId: string | null | undefined) {
  return useQuery({
    queryKey: ['quick_quotes', 'deal', dealId],
    queryFn: async () => {
      if (!dealId) return [];
      const { data, error } = await supabase
        .from('quick_quotes' as any)
        .select('*')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as QuickQuote[];
    },
    enabled: !!dealId,
  });
}

export function useQuickQuote(quoteId: string | null) {
  return useQuery({
    queryKey: ['quick_quote', quoteId],
    queryFn: async () => {
      if (!quoteId) return null;
      const [{ data: q, error: qe }, { data: items, error: ie }] = await Promise.all([
        supabase.from('quick_quotes' as any).select('*').eq('id', quoteId).single(),
        supabase.from('quick_quote_items' as any).select('*').eq('quote_id', quoteId).order('sort_order'),
      ]);
      if (qe) throw qe;
      if (ie) throw ie;
      return { quote: q as unknown as QuickQuote, items: (items || []) as unknown as QuickQuoteItem[] };
    },
    enabled: !!quoteId,
  });
}

export function useQuickQuoteMutations(dealId: string) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: tenantId } = useActiveTenantId();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['quick_quotes', 'deal', dealId] });
  };

  const create = useMutation({
    mutationFn: async (payload: {
      legal_entity_id: string;
      client_name: string;
      client_cnpj?: string | null;
      client_contact?: string | null;
      client_phone?: string | null;
      client_email?: string | null;
      client_notes?: string | null;
      company_id?: string | null;
      validity_date?: string | null;
      payment_terms_free?: string | null;
      delivery_terms_free?: string | null;
      observations?: string | null;
    }) => {
      if (!tenantId) throw new Error('Tenant ativo não identificado.');
      if (!user?.id) throw new Error('Usuário não autenticado.');
      const { data, error } = await supabase
        .from('quick_quotes' as any)
        .insert({
          ...payload,
          tenant_id: tenantId,
          deal_id: dealId,
          created_by: user.id,
          status: 'draft',
        })
        .select('*')
        .single();
      if (error) throw error;
      return data as unknown as QuickQuote;
    },
    onSuccess: () => { invalidate(); toast.success('Orçamento criado'); },
    onError: (e: any) => toast.error(e?.message || 'Erro ao criar orçamento'),
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<QuickQuote> }) => {
      const { error } = await supabase.from('quick_quotes' as any).update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      invalidate();
      qc.invalidateQueries({ queryKey: ['quick_quote', vars.id] });
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao atualizar orçamento'),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('quick_quotes' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success('Orçamento removido'); },
    onError: (e: any) => toast.error(e?.message || 'Erro ao remover orçamento'),
  });

  const upsertItems = useMutation({
    mutationFn: async ({
      quoteId,
      items,
    }: {
      quoteId: string;
      items: Array<Partial<QuickQuoteItem> & { description: string }>;
    }) => {
      // estratégia simples: apaga todos e reinsere (lista costuma ser pequena)
      const { error: delErr } = await supabase
        .from('quick_quote_items' as any)
        .delete()
        .eq('quote_id', quoteId);
      if (delErr) throw delErr;

      if (items.length === 0) return;
      const rows = items.map((it, idx) => ({
        quote_id: quoteId,
        sort_order: idx,
        family_id: it.family_id ?? null,
        class_id: it.class_id ?? null,
        tipo_id: it.tipo_id ?? null,
        grupo_id: it.grupo_id ?? null,
        subgrupo_id: it.subgrupo_id ?? null,
        description: it.description,
        quantity: Number(it.quantity || 0),
        unit: it.unit ?? null,
        unit_price: Number(it.unit_price || 0),
        notes: it.notes ?? null,
      }));
      const { error } = await supabase.from('quick_quote_items' as any).insert(rows);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      invalidate();
      qc.invalidateQueries({ queryKey: ['quick_quote', vars.quoteId] });
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao salvar itens'),
  });

  return { create, update, remove, upsertItems };
}

/** Gera/abre PDF do orçamento em nova aba e (opcional) marca como enviado. */
export async function openQuickQuotePdf(quoteId: string, opts?: { markSent?: boolean }) {
  const projectRef = 'lusyhkizwoihixcvcgap';
  const session = (await supabase.auth.getSession()).data.session;
  const url = `https://${projectRef}.supabase.co/functions/v1/generate-quick-quote-pdf`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token || ''}`,
    },
    body: JSON.stringify({ quote_id: quoteId, mark_sent: !!opts?.markSent }),
  });
  if (!res.ok) {
    toast.error('Falha ao gerar PDF do orçamento');
    return;
  }
  const html = await res.text();
  const blob = new Blob([html], { type: 'text/html' });
  const blobUrl = URL.createObjectURL(blob);
  window.open(blobUrl, '_blank');
}
