import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CreditAnalysis {
  id: string;
  company_id: string;
  cnpj: string;
  credit_score: number | null;
  risk_classification: 'baixo' | 'medio' | 'alto' | null;
  cadastral_status: string | null;
  restrictions_summary: string | null;
  api_provider: string | null;
  analysis_date: string;
  consultation_reason: string;
  consulted_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreditAuditRecord {
  id: string;
  company_id: string;
  company_name: string;
  cnpj: string;
  user_id: string;
  user_name: string;
  reason: string;
  action: string;
  result_summary: {
    credit_score: number;
    risk_classification: string;
    cadastral_status: string;
  };
  created_at: string;
}

export type ScoreValidityStatus = 'atual' | 'atencao' | 'desatualizado' | 'nenhum';

export function getScoreValidityStatus(analysisDate: string | null | undefined): ScoreValidityStatus {
  if (!analysisDate) return 'nenhum';
  
  const daysSince = Math.floor(
    (Date.now() - new Date(analysisDate).getTime()) / (1000 * 60 * 60 * 24)
  );
  
  if (daysSince <= 30) return 'atual';
  if (daysSince <= 90) return 'atencao';
  return 'desatualizado';
}

export function getStatusConfig(status: ScoreValidityStatus) {
  const configs = {
    atual: { label: 'Atual', color: 'bg-green-500', textColor: 'text-green-700', bgLight: 'bg-green-50' },
    atencao: { label: 'Atenção', color: 'bg-yellow-500', textColor: 'text-yellow-700', bgLight: 'bg-yellow-50' },
    desatualizado: { label: 'Desatualizado', color: 'bg-red-500', textColor: 'text-red-700', bgLight: 'bg-red-50' },
    nenhum: { label: 'Não consultado', color: 'bg-gray-400', textColor: 'text-gray-600', bgLight: 'bg-gray-50' },
  };
  return configs[status];
}

export function useCreditAnalysis(companyId: string | undefined) {
  return useQuery({
    queryKey: ['credit-analysis', companyId],
    queryFn: async () => {
      if (!companyId) return null;
      
      const { data, error } = await supabase
        .from('credit_analyses')
        .select('*')
        .eq('company_id', companyId)
        .maybeSingle();
      
      if (error) throw error;
      return data as CreditAnalysis | null;
    },
    enabled: !!companyId,
  });
}

export function useCreditAuditHistory(companyId: string | undefined) {
  return useQuery({
    queryKey: ['credit-audit-history', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      
      const { data, error } = await supabase
        .from('credit_analysis_audit')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []) as CreditAuditRecord[];
    },
    enabled: !!companyId,
  });
}

export function useCanUpdateCreditScore() {
  return useQuery({
    queryKey: ['can-update-credit-score'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      
      const { data, error } = await supabase.rpc('can_update_credit_score', {
        _user_id: user.id
      });
      
      if (error) {
        console.error('Error checking credit permission:', error);
        return false;
      }
      
      return data as boolean;
    },
  });
}

interface UpdateCreditRequest {
  companyId: string;
  cnpj: string;
  companyName: string;
  reason: string;
}

export function useUpdateCreditScore() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (request: UpdateCreditRequest) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');
      
      const response = await supabase.functions.invoke('credit-analysis', {
        body: request,
      });
      
      if (response.error) {
        throw new Error(response.error.message || 'Erro ao atualizar análise de crédito');
      }
      
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['credit-analysis', variables.companyId] });
      queryClient.invalidateQueries({ queryKey: ['credit-audit-history', variables.companyId] });
      toast.success('Análise de crédito atualizada com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao atualizar análise de crédito');
    },
  });
}
