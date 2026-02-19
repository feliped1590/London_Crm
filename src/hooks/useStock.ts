import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

// ── Types ──────────────────────────────────────────────────────────────
export interface StockItem {
  id: string;
  product_id: string;
  company_id: string;
  tenant_id: string;
  quantidade_atual: number;
  estoque_minimo: number | null;
  estoque_maximo: number | null;
  created_at: string;
  updated_at: string;
  product_name?: string;
  product_sku?: string;
  company_name?: string;
  company_cnpj?: string;
}

export interface StockMovement {
  id: string;
  product_id: string;
  company_id: string;
  tenant_id: string;
  tipo: 'entrada' | 'saida' | 'ajuste';
  quantidade: number;
  motivo: string | null;
  referencia_id: string | null;
  referencia_tipo: string | null;
  usuario_id: string;
  created_at: string;
  product_name?: string;
  product_sku?: string;
  company_name?: string;
  usuario_name?: string;
}

export interface StockFilters {
  company_id?: string;
  product_search?: string;
  status?: 'all' | 'normal' | 'baixo' | 'zerado';
}

export interface HistoryFilters {
  company_id?: string;
  product_id?: string;
  tipo?: string;
  date_from?: string;
  date_to?: string;
}

export interface MoveStockPayload {
  product_id: string;
  company_id: string;
  tipo: 'entrada' | 'saida' | 'ajuste';
  quantidade: number;
  motivo: string;
}

export interface TransferStockPayload {
  product_id: string;
  from_company_id: string;
  to_company_id: string;
  quantidade: number;
  motivo: string;
}

// ── Helper: get tenant_id ──────────────────────────────────────────────
async function getActiveTenantId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');

  const { data: profile } = await supabase
    .from('profiles')
    .select('active_tenant_id')
    .eq('user_id', user.id)
    .single();

  if (!profile?.active_tenant_id) throw new Error('Tenant ativo não encontrado');
  return profile.active_tenant_id;
}

// ── Queries ────────────────────────────────────────────────────────────
export function useStockList(filters: StockFilters = {}) {
  return useQuery({
    queryKey: ['stock-list', filters],
    queryFn: async () => {
      const tenantId = await getActiveTenantId();

      let query = supabase
        .from('product_stock')
        .select(`
          *,
          products:product_id (name, sku),
          legal_entities:company_id (name, cnpj)
        `)
        .eq('tenant_id', tenantId)
        .order('updated_at', { ascending: false });

      if (filters.company_id) {
        query = query.eq('company_id', filters.company_id);
      }

      const { data, error } = await query;
      if (error) throw error;

      let items: StockItem[] = (data || []).map((row: any) => ({
        ...row,
        product_name: row.products?.name || '',
        product_sku: row.products?.sku || '',
        company_name: row.legal_entities?.name || '',
        company_cnpj: row.legal_entities?.cnpj || '',
      }));

      // Filter by product search
      if (filters.product_search) {
        const search = filters.product_search.toLowerCase();
        items = items.filter(
          (i) =>
            i.product_name?.toLowerCase().includes(search) ||
            i.product_sku?.toLowerCase().includes(search)
        );
      }

      // Filter by status
      if (filters.status && filters.status !== 'all') {
        items = items.filter((i) => {
          if (filters.status === 'zerado') return i.quantidade_atual === 0;
          if (filters.status === 'baixo')
            return (
              i.quantidade_atual > 0 &&
              i.estoque_minimo != null &&
              i.quantidade_atual <= i.estoque_minimo
            );
          if (filters.status === 'normal') {
            if (i.quantidade_atual === 0) return false;
            if (i.estoque_minimo != null && i.quantidade_atual <= i.estoque_minimo) return false;
            return true;
          }
          return true;
        });
      }

      return items;
    },
  });
}

export function useStockHistory(filters: HistoryFilters = {}) {
  return useQuery({
    queryKey: ['stock-history', filters],
    queryFn: async () => {
      const tenantId = await getActiveTenantId();

      let query = supabase
        .from('stock_movements')
        .select(`
          *,
          products:product_id (name, sku),
          legal_entities:company_id (name),
          profiles:usuario_id (full_name)
        `)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(500);

      if (filters.company_id) query = query.eq('company_id', filters.company_id);
      if (filters.product_id) query = query.eq('product_id', filters.product_id);
      if (filters.tipo) query = query.eq('tipo', filters.tipo as any);
      if (filters.date_from) query = query.gte('created_at', filters.date_from);
      if (filters.date_to) query = query.lte('created_at', filters.date_to + 'T23:59:59');

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((row: any) => ({
        ...row,
        product_name: row.products?.name || '',
        product_sku: row.products?.sku || '',
        company_name: row.legal_entities?.name || '',
        usuario_name: row.profiles?.full_name || '',
      })) as StockMovement[];
    },
  });
}

// ── Mutations ──────────────────────────────────────────────────────────
export function useMoveStock() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: MoveStockPayload) => {
      const tenantId = await getActiveTenantId();

      const { data, error } = await supabase.rpc('process_stock_movement', {
        p_product_id: payload.product_id,
        p_company_id: payload.company_id,
        p_tenant_id: tenantId,
        p_tipo: payload.tipo,
        p_quantidade: payload.quantidade,
        p_motivo: payload.motivo,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-list'] });
      qc.invalidateQueries({ queryKey: ['stock-history'] });
      toast.success('Movimentação registrada com sucesso');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao registrar movimentação');
    },
  });
}

export function useTransferStock() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: TransferStockPayload) => {
      const tenantId = await getActiveTenantId();

      const { data, error } = await supabase.rpc('transfer_stock', {
        p_product_id: payload.product_id,
        p_from_company_id: payload.from_company_id,
        p_to_company_id: payload.to_company_id,
        p_tenant_id: tenantId,
        p_quantidade: payload.quantidade,
        p_motivo: payload.motivo,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-list'] });
      qc.invalidateQueries({ queryKey: ['stock-history'] });
      toast.success('Transferência realizada com sucesso');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao realizar transferência');
    },
  });
}

// ── Shared data queries ────────────────────────────────────────────────
export function useLegalEntitiesForStock() {
  return useQuery({
    queryKey: ['stock-legal-entities'],
    queryFn: async () => {
      const tenantId = await getActiveTenantId();
      const { data, error } = await supabase
        .from('legal_entities')
        .select('id, name, cnpj')
        .eq('tenant_id', tenantId)
        .eq('active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });
}

export function useProductsForStock() {
  return useQuery({
    queryKey: ['stock-products'],
    queryFn: async () => {
      const tenantId = await getActiveTenantId();
      const { data, error } = await supabase
        .from('products')
        .select('id, name, sku')
        .eq('tenant_id', tenantId)
        .eq('active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });
}
