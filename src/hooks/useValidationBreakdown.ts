import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ValidationBreakdownItem {
  field: string;
  count: number;
  label: string;
}

const FIELD_LABELS: Record<string, string> = {
  cnpj: 'Sem CNPJ válido',
  company_name: 'Sem Razão Social',
  address: 'Endereço incompleto',
  city_mapping: 'Cidade não mapeada',
  sales_rep: 'Sem vendedor',
  erp_user: 'Usuário ERP não configurado',
};

export function useValidationBreakdown() {
  return useQuery<ValidationBreakdownItem[]>({
    queryKey: ['validation-breakdown'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_validation_breakdown');
      if (error) throw error;
      return (data || []).map((row: any) => ({
        field: row.field,
        count: Number(row.count),
        label: FIELD_LABELS[row.field] ?? row.field,
      }));
    },
    staleTime: 30_000,
  });
}

export function useBlockedValidationCount() {
  return useQuery<number>({
    queryKey: ['blocked-validation-count'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_blocked_validation_count');
      if (error) throw error;
      return Number(data ?? 0);
    },
    staleTime: 30_000,
  });
}
