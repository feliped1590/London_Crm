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
      const { salesRepIds = [], legalEntityIds = [], ...rule } = payload;
      // singular sales_rep_id deprecated — sempre null nas escritas novas
      const row = { ...rule, sales_rep_id: null, tenant_id: tenantId };
      let ruleId = rule.id as string | undefined;
      if (ruleId) {
        const { error } = await supabase.from('commission_rules').update(row).eq('id', ruleId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('commission_rules').insert(row).select('id').single();
        if (error) throw error;
        ruleId = data.id as string;
      }
      // sync junctions
      await supabase.from('commission_rule_sales_reps').delete().eq('rule_id', ruleId);
      if (salesRepIds.length) {
        const { error } = await supabase.from('commission_rule_sales_reps')
          .insert(salesRepIds.map((sid: string) => ({ rule_id: ruleId, sales_rep_id: sid, tenant_id: tenantId })));
        if (error) throw error;
      }
      await supabase.from('commission_rule_legal_entities').delete().eq('rule_id', ruleId);
      if (legalEntityIds.length) {
        const { error } = await supabase.from('commission_rule_legal_entities')
          .insert(legalEntityIds.map((lid: string) => ({ rule_id: ruleId, legal_entity_id: lid, tenant_id: tenantId })));
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.commissionRules });
      qc.invalidateQueries({ queryKey: ['governance', 'commission_rule_junctions'] });
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
      const { salesRepIds = [], legalEntityIds = [], ...rule } = payload;
      const row = { ...rule, sales_rep_id: null, tenant_id: tenantId };
      let ruleId = rule.id as string | undefined;
      if (ruleId) {
        const { error } = await supabase.from('payment_terms_rules').update(row).eq('id', ruleId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('payment_terms_rules').insert(row).select('id').single();
        if (error) throw error;
        ruleId = data.id as string;
      }
      await supabase.from('payment_terms_rule_sales_reps').delete().eq('rule_id', ruleId);
      if (salesRepIds.length) {
        const { error } = await supabase.from('payment_terms_rule_sales_reps')
          .insert(salesRepIds.map((sid: string) => ({ rule_id: ruleId, sales_rep_id: sid, tenant_id: tenantId })));
        if (error) throw error;
      }
      await supabase.from('payment_terms_rule_legal_entities').delete().eq('rule_id', ruleId);
      if (legalEntityIds.length) {
        const { error } = await supabase.from('payment_terms_rule_legal_entities')
          .insert(legalEntityIds.map((lid: string) => ({ rule_id: ruleId, legal_entity_id: lid, tenant_id: tenantId })));
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.paymentRules });
      qc.invalidateQueries({ queryKey: ['governance', 'payment_terms_rule_junctions'] });
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

// ---------- Rule junctions (sales reps + legal entities) ----------
export function useCommissionRuleJunctions(ruleId?: string | null) {
  return useQuery({
    queryKey: ['governance', 'commission_rule_junctions', ruleId],
    queryFn: async () => {
      if (!ruleId) return { salesRepIds: [] as string[], legalEntityIds: [] as string[] };
      const [{ data: srs }, { data: les }] = await Promise.all([
        supabase.from('commission_rule_sales_reps').select('sales_rep_id').eq('rule_id', ruleId),
        supabase.from('commission_rule_legal_entities').select('legal_entity_id').eq('rule_id', ruleId),
      ]);
      return {
        salesRepIds: (srs || []).map((r: any) => r.sales_rep_id),
        legalEntityIds: (les || []).map((r: any) => r.legal_entity_id),
      };
    },
    enabled: !!ruleId,
  });
}

export function usePaymentRuleJunctions(ruleId?: string | null) {
  return useQuery({
    queryKey: ['governance', 'payment_terms_rule_junctions', ruleId],
    queryFn: async () => {
      if (!ruleId) return { salesRepIds: [] as string[], legalEntityIds: [] as string[] };
      const [{ data: srs }, { data: les }] = await Promise.all([
        supabase.from('payment_terms_rule_sales_reps').select('sales_rep_id').eq('rule_id', ruleId),
        supabase.from('payment_terms_rule_legal_entities').select('legal_entity_id').eq('rule_id', ruleId),
      ]);
      return {
        salesRepIds: (srs || []).map((r: any) => r.sales_rep_id),
        legalEntityIds: (les || []).map((r: any) => r.legal_entity_id),
      };
    },
    enabled: !!ruleId,
  });
}

// Pré-carrega contagens para a listagem (1 query por tabela)
export function useAllCommissionRuleJunctions() {
  const { data: tenantId } = useActiveTenantId();
  return useQuery({
    queryKey: ['governance', 'commission_rule_junctions', 'all', tenantId],
    queryFn: async () => {
      if (!tenantId) return {} as Record<string, { salesRepIds: string[]; legalEntityIds: string[] }>;
      const [{ data: srs }, { data: les }] = await Promise.all([
        supabase.from('commission_rule_sales_reps').select('rule_id, sales_rep_id').eq('tenant_id', tenantId),
        supabase.from('commission_rule_legal_entities').select('rule_id, legal_entity_id').eq('tenant_id', tenantId),
      ]);
      const map: Record<string, { salesRepIds: string[]; legalEntityIds: string[] }> = {};
      (srs || []).forEach((r: any) => { (map[r.rule_id] ||= { salesRepIds: [], legalEntityIds: [] }).salesRepIds.push(r.sales_rep_id); });
      (les || []).forEach((r: any) => { (map[r.rule_id] ||= { salesRepIds: [], legalEntityIds: [] }).legalEntityIds.push(r.legal_entity_id); });
      return map;
    },
    enabled: !!tenantId,
  });
}

export function useAllPaymentRuleJunctions() {
  const { data: tenantId } = useActiveTenantId();
  return useQuery({
    queryKey: ['governance', 'payment_terms_rule_junctions', 'all', tenantId],
    queryFn: async () => {
      if (!tenantId) return {} as Record<string, { salesRepIds: string[]; legalEntityIds: string[] }>;
      const [{ data: srs }, { data: les }] = await Promise.all([
        supabase.from('payment_terms_rule_sales_reps').select('rule_id, sales_rep_id').eq('tenant_id', tenantId),
        supabase.from('payment_terms_rule_legal_entities').select('rule_id, legal_entity_id').eq('tenant_id', tenantId),
      ]);
      const map: Record<string, { salesRepIds: string[]; legalEntityIds: string[] }> = {};
      (srs || []).forEach((r: any) => { (map[r.rule_id] ||= { salesRepIds: [], legalEntityIds: [] }).salesRepIds.push(r.sales_rep_id); });
      (les || []).forEach((r: any) => { (map[r.rule_id] ||= { salesRepIds: [], legalEntityIds: [] }).legalEntityIds.push(r.legal_entity_id); });
      return map;
    },
    enabled: !!tenantId,
  });
}

// ---------- Resolvers (per-order/item context) ----------
export function useResolveCommissionRule(params: {
  salesRepId?: string | null;
  companyId?: string | null;
  productId?: string | null;
  legalEntityId?: string | null;
  enabled?: boolean;
}) {
  const { data: tenantId } = useActiveTenantId();
  const enabled = (params.enabled ?? true) && !!tenantId && !!params.productId;
  return useQuery({
    queryKey: ['governance', 'resolve_commission', tenantId, params.salesRepId, params.companyId, params.productId, params.legalEntityId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('resolve_commission_rule', {
        _tenant: tenantId!,
        _sales_rep: params.salesRepId ?? null,
        _company: params.companyId ?? null,
        _product: params.productId!,
        _at: new Date().toISOString().slice(0, 10),
        _legal_entity: params.legalEntityId ?? null,
      } as any);

      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return row || null;
    },
    enabled,
  });
}

export function useResolvePaymentTermsRule(params: {
  companyId?: string | null;
  salesRepId?: string | null;
  amount: number;
  legalEntityId?: string | null;
  enabled?: boolean;
}) {
  const { data: tenantId } = useActiveTenantId();
  const enabled = (params.enabled ?? true) && !!tenantId && params.amount > 0;
  return useQuery({
    queryKey: ['governance', 'resolve_payment', tenantId, params.companyId, params.salesRepId, params.amount, params.legalEntityId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('resolve_payment_terms_rule', {
        _tenant: tenantId!,
        _company: params.companyId ?? null,
        _sales_rep: params.salesRepId ?? null,
        _amount: params.amount,
        _at: new Date().toISOString().slice(0, 10),
        _legal_entity: params.legalEntityId ?? null,
      } as any);

      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return row || null;
    },
    enabled,
  });
}


// ---------- Order-scoped governance state ----------
export function useOrderGovernanceState(orderId?: string | null) {
  const qc = useQueryClient();

  const commissionSnapshots = useQuery({
    queryKey: ['governance', 'order_commission_snapshots', orderId],
    queryFn: async () => {
      if (!orderId) return [];
      const { data, error } = await (supabase as any)
        .from('order_item_commission_snapshot')
        .select('*')
        .eq('order_id', orderId);

      if (error) throw error;
      return data || [];
    },
    enabled: !!orderId,
  });

  const paymentSnapshot = useQuery({
    queryKey: ['governance', 'order_payment_snapshot', orderId],
    queryFn: async () => {
      if (!orderId) return null;
      const { data, error } = await supabase
        .from('order_payment_terms_snapshot')
        .select('*')
        .eq('order_id', orderId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!orderId,
  });

  const requests = useQuery({
    queryKey: ['governance', 'order_requests', orderId],
    queryFn: async () => {
      if (!orderId) return [];
      const { data, error } = await supabase
        .from('order_approval_requests')
        .select('*')
        .eq('order_id', orderId)
        .order('requested_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!orderId,
  });

  const create = useMutation({
    mutationFn: async (args: {
      kind: 'commission' | 'payment_terms';
      justification: string;
      requested_value?: any;
      max_allowed?: any;
      rule_id?: string | null;
      order_item_id?: string | null;
    }) => {
      if (!orderId) throw new Error('Pedido não definido');
      const { error } = await supabase.rpc('create_commercial_approval_request', {
        _order_id: orderId,
        _order_item_id: args.order_item_id ?? null,
        _request_type: args.kind,
        _justification: args.justification,
        _requested_value: args.requested_value ?? null,
        _max_allowed: args.max_allowed ?? null,
        _rule_id: args.rule_id ?? null,
      });
      if (error) throw error;
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['governance', 'order_requests', orderId] });
      qc.invalidateQueries({ queryKey: QK.pending });
      toast.success('Solicitação de aprovação enviada');
    },
    onError: (e: any) => toast.error(e.message),
  });

  return {
    commissionSnapshots: commissionSnapshots.data || [],
    paymentSnapshot: paymentSnapshot.data || null,
    requests: requests.data || [],
    isLoading: commissionSnapshots.isLoading || paymentSnapshot.isLoading || requests.isLoading,
    createRequest: create,
    hasPending: (requests.data || []).some((r: any) => r.status === 'pending'),
    hasNeedsApproval:
      (commissionSnapshots.data || []).some((s: any) => s.needs_approval) ||
      ((paymentSnapshot.data as any)?.needs_approval ?? false),
  };
}

