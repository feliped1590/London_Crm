import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useActiveTenantId } from '@/hooks/useActiveTenantId';
import { toast } from 'sonner';

const QK = {
  commissionRules: ['governance', 'commission_rules'] as const,
  templates: ['governance', 'payment_terms_templates'] as const,
  templateItems: (id: string) => ['governance', 'payment_terms_template_items', id] as const,
  paymentRules: ['governance', 'payment_terms_rules'] as const,
  flags: ['governance', 'flags'] as const,
  pending: ['governance', 'pending_requests'] as const,
};

// ---------- Commission Rules ----------
export function useCommissionRules() {
  const { data: tenantId } = useActiveTenantId();
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: [...QK.commissionRules, tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('commission_rules')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const upsert = useMutation({
    mutationFn: async (payload: any) => {
      if (!tenantId) throw new Error('Tenant não resolvido');
      const row = { ...payload, tenant_id: tenantId };
      const { error } = payload.id
        ? await supabase.from('commission_rules').update(row).eq('id', payload.id)
        : await supabase.from('commission_rules').insert(row);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.commissionRules });
      toast.success('Regra salva');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('commission_rules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.commissionRules });
      toast.success('Regra excluída');
    },
    onError: (e: any) => toast.error(e.message),
  });

  return { rules: list.data || [], isLoading: list.isLoading, upsert, remove };
}

// ---------- Payment Terms Templates ----------
export function usePaymentTemplates() {
  const { data: tenantId } = useActiveTenantId();
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: [...QK.templates, tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('payment_terms_templates')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('rank', { ascending: true })
        .order('name', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const upsert = useMutation({
    mutationFn: async (payload: any) => {
      if (!tenantId) throw new Error('Tenant não resolvido');
      const row = { ...payload, tenant_id: tenantId };
      const { error } = payload.id
        ? await supabase.from('payment_terms_templates').update(row).eq('id', payload.id)
        : await supabase.from('payment_terms_templates').insert(row);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.templates });
      toast.success('Template salvo');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('payment_terms_templates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.templates });
      toast.success('Template excluído');
    },
    onError: (e: any) => toast.error(e.message),
  });

  return { templates: list.data || [], isLoading: list.isLoading, upsert, remove };
}

export function usePaymentTemplateItems(templateId: string | null) {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: QK.templateItems(templateId || 'none'),
    queryFn: async () => {
      if (!templateId) return [];
      const { data, error } = await supabase
        .from('payment_terms_template_items')
        .select('*')
        .eq('template_id', templateId)
        .order('parcela', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!templateId,
  });

  const replaceAll = useMutation({
    mutationFn: async (rows: any[]) => {
      if (!templateId) throw new Error('Template não definido');
      const { error: delErr } = await supabase
        .from('payment_terms_template_items')
        .delete()
        .eq('template_id', templateId);
      if (delErr) throw delErr;
      if (rows.length === 0) return;
      const payload = rows.map((r, i) => ({
        template_id: templateId,
        parcela: i + 1,
        dias: r.dias,
        payment_method_default: r.payment_method_default || null,
        tipo: r.tipo,
        percentual: r.percentual ?? null,
      }));
      const { error } = await supabase.from('payment_terms_template_items').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      if (templateId) qc.invalidateQueries({ queryKey: QK.templateItems(templateId) });
      toast.success('Parcelas atualizadas');
    },
    onError: (e: any) => toast.error(e.message),
  });

  return { items: list.data || [], isLoading: list.isLoading, replaceAll };
}

// ---------- Payment Terms Rules ----------
export function usePaymentRules() {
  const { data: tenantId } = useActiveTenantId();
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: [...QK.paymentRules, tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('payment_terms_rules')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('level', { ascending: true })
        .order('priority', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const upsert = useMutation({
    mutationFn: async (payload: any) => {
      if (!tenantId) throw new Error('Tenant não resolvido');
      const row = { ...payload, tenant_id: tenantId };
      const { error } = payload.id
        ? await supabase.from('payment_terms_rules').update(row).eq('id', payload.id)
        : await supabase.from('payment_terms_rules').insert(row);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.paymentRules });
      toast.success('Regra salva');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('payment_terms_rules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.paymentRules });
      toast.success('Regra excluída');
    },
    onError: (e: any) => toast.error(e.message),
  });

  return { rules: list.data || [], isLoading: list.isLoading, upsert, remove };
}

// ---------- Flags em tenant_settings ----------
export function useGovernanceFlags() {
  const { data: tenantId } = useActiveTenantId();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: [...QK.flags, tenantId],
    queryFn: async () => {
      if (!tenantId) return { commission_allow_exception: true, payment_terms_allow_exception: true };
      const { data } = await supabase
        .from('tenant_settings')
        .select('id, settings')
        .eq('tenant_id', tenantId)
        .eq('category', 'commercial_governance')
        .maybeSingle();
      const s = (data?.settings as any) || {};
      return {
        id: data?.id as string | undefined,
        commission_allow_exception: s.commission_allow_exception ?? true,
        payment_terms_allow_exception: s.payment_terms_allow_exception ?? true,
      };
    },
    enabled: !!tenantId,
  });

  const save = useMutation({
    mutationFn: async (next: { commission_allow_exception: boolean; payment_terms_allow_exception: boolean }) => {
      if (!tenantId) throw new Error('Tenant não resolvido');
      const settings = {
        commission_allow_exception: !!next.commission_allow_exception,
        payment_terms_allow_exception: !!next.payment_terms_allow_exception,
      };
      if (q.data?.id) {
        const { error } = await supabase
          .from('tenant_settings')
          .update({ settings })
          .eq('id', q.data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('tenant_settings')
          .insert({ tenant_id: tenantId, category: 'commercial_governance', settings });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.flags });
      toast.success('Configurações atualizadas');
    },
    onError: (e: any) => toast.error(e.message),
  });

  return { flags: q.data, isLoading: q.isLoading, save };
}

// ---------- Pending Approval Requests ----------
export function usePendingApprovalRequests() {
  const { data: tenantId } = useActiveTenantId();
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: [...QK.pending, tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('order_approval_requests')
        .select('*, order:orders(id, number, total_value, company:companies(name))')
        .eq('tenant_id', tenantId)
        .order('requested_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const review = useMutation({
    mutationFn: async (args: { id: string; decision: 'approved' | 'rejected'; notes?: string }) => {
      const { error } = await supabase.rpc('review_commercial_approval_request', {
        _id: args.id,
        _decision: args.decision,
        _notes: args.notes ?? null,
        _approved_value: null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.pending });
      toast.success('Solicitação revisada');
    },
    onError: (e: any) => toast.error(e.message),
  });

  return { requests: list.data || [], isLoading: list.isLoading, review };
}
