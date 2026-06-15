import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';

export type ReportCode =
  | 'dashboard_executivo'
  | 'conversao'
  | 'perdas_atendimento'
  | 'perdas_cotacao'
  | 'metas'
  | 'vendas_entidade'
  | 'vendas_vendedor'
  | 'vendas_cliente'
  | 'vendas_produto'
  | 'rankings'
  | 'clientes_atendidos'
  | 'pipeline_comercial'
  | 'forecast_vendas'
  // Composite (no RPC; rendered via dedicated React components)
  | 'executivo_comercial'
  | 'vendedor_360';

export const COMPOSITE_REPORT_CODES: ReportCode[] = ['executivo_comercial', 'vendedor_360'];
export function isCompositeReport(code: ReportCode | null | undefined) {
  return !!code && (COMPOSITE_REPORT_CODES as string[]).includes(code);
}

export interface ReportDefinition {
  id: string;
  code: ReportCode;
  name: string;
  description: string | null;
  category: string;
  chart_type: string;
  required_roles: string[];
  sort_order: number;
  is_active: boolean;
}

export interface BIReportFilters {
  startDate?: Date;
  endDate?: Date;
  sellerId?: string;
  pipelineId?: string;
  legalEntityId?: string;
  companyId?: string;
  productFamilyId?: string;
  [key: string]: unknown;
}

export function useReportDefinitions() {
  return useQuery({
    queryKey: ['report_definitions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('report_definitions')
        .select('*')
        .eq('is_active', true)
        .order('category')
        .order('sort_order');
      if (error) throw error;
      return (data || []) as ReportDefinition[];
    },
    staleTime: 60 * 60 * 1000,
  });
}

function serializeFilters(filters: BIReportFilters) {
  const f: Record<string, unknown> = {};
  if (filters.startDate) f.start_date = format(filters.startDate, 'yyyy-MM-dd');
  if (filters.endDate) f.end_date = format(filters.endDate, 'yyyy-MM-dd');
  if (filters.sellerId) f.sales_rep_id = filters.sellerId;
  if (filters.pipelineId) f.pipeline_id = filters.pipelineId;
  if (filters.legalEntityId) f.legal_entity_id = filters.legalEntityId;
  if (filters.companyId) f.company_id = filters.companyId;
  if (filters.productFamilyId) f.product_family_id = filters.productFamilyId;
  return f;
}

export function useBIReport<T = any>(code: ReportCode | null, filters: BIReportFilters) {
  return useQuery({
    queryKey: ['bi-report', code, filters],
    enabled: !!code && !isCompositeReport(code),
    queryFn: async () => {
      const { data, error } = await supabase.rpc(`report_${code}` as any, {
        p_filters: serializeFilters(filters) as any,
      });
      if (error) throw error;
      return data as T;
    },
    staleTime: 60 * 1000,
  });
}

export function useBIFavorites() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['bi-favorites', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('report_favorites')
        .select('report_id')
        .eq('user_id', user!.id);
      if (error) throw error;
      return new Set((data || []).map((r) => r.report_id));
    },
  });

  const toggle = useMutation({
    mutationFn: async (reportId: string) => {
      if (!user?.id) throw new Error('not auth');
      const isFav = query.data?.has(reportId);
      if (isFav) {
        const { error } = await supabase
          .from('report_favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('report_id', reportId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('report_favorites')
          .insert({ user_id: user.id, report_id: reportId });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bi-favorites'] }),
  });

  return { favorites: query.data ?? new Set<string>(), toggle: toggle.mutate, isLoading: query.isLoading };
}
