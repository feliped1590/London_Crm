import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentUser } from '@/lib/auth/currentUser';
import type { RegraTributacao, ContextoFiscal, ResultadoCalculoFiscal } from '@/types/fiscal-extended';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type RegraInsert = Database['public']['Tables']['regras_tributacao']['Insert'];
type RegraUpdate = Database['public']['Tables']['regras_tributacao']['Update'];

// =============================================================================
// Hook para Regras de Tributação
// =============================================================================

export function useRegrasTributacao() {
  return useQuery({
    queryKey: ['regras-tributacao'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('regras_tributacao')
        .select('*')
        .order('prioridade', { ascending: false })
        .order('nome');
      
      if (error) throw error;
      return data as RegraTributacao[];
    },
  });
}

export function useRegraTributacao(id: string | undefined) {
  return useQuery({
    queryKey: ['regras-tributacao', id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from('regras_tributacao')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as RegraTributacao;
    },
    enabled: !!id,
  });
}

export function useCreateRegraTributacao() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (regra: RegraInsert) => {
      const { data: userData } = await ({ data: { user: await getCurrentUser() } } as { data: { user: Awaited<ReturnType<typeof getCurrentUser>> } });
      
      const insertData: RegraInsert = {
        ...regra,
        created_by: userData.user?.id,
      };
      
      const { data, error } = await supabase
        .from('regras_tributacao')
        .insert(insertData)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['regras-tributacao'] });
      toast.success('Regra fiscal criada com sucesso');
    },
    onError: (error) => {
      console.error('Erro ao criar regra:', error);
      toast.error('Erro ao criar regra fiscal');
    },
  });
}

export function useUpdateRegraTributacao() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: RegraUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('regras_tributacao')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['regras-tributacao'] });
      queryClient.invalidateQueries({ queryKey: ['regras-tributacao', variables.id] });
      toast.success('Regra fiscal atualizada com sucesso');
    },
    onError: (error: Error) => {
      console.error('Erro ao atualizar regra:', error);
      if (error.message.includes('bloqueada')) {
        toast.error('Esta regra está bloqueada e não pode ser alterada (já foi usada em documentos fiscais)');
      } else {
        toast.error('Erro ao atualizar regra fiscal');
      }
    },
  });
}

export function useDeleteRegraTributacao() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('regras_tributacao')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['regras-tributacao'] });
      toast.success('Regra fiscal excluída com sucesso');
    },
    onError: (error: Error) => {
      console.error('Erro ao excluir regra:', error);
      if (error.message.includes('bloqueada')) {
        toast.error('Esta regra está bloqueada e não pode ser excluída (já foi usada em documentos fiscais)');
      } else {
        toast.error('Erro ao excluir regra fiscal');
      }
    },
  });
}

// =============================================================================
// Hook para Cálculo Fiscal
// =============================================================================

export function useCalcularTributacao() {
  return useMutation({
    mutationFn: async (contexto: ContextoFiscal): Promise<ResultadoCalculoFiscal> => {
      const { data, error } = await supabase.functions.invoke('calcular-tributacao', {
        body: { contexto },
      });
      
      if (error) throw error;
      return data as ResultadoCalculoFiscal;
    },
  });
}

// Hook para cálculo em tempo real (com debounce/cache)
export function useTributacaoPreview(contexto: ContextoFiscal | null, enabled = true) {
  return useQuery({
    queryKey: ['tributacao-preview', contexto],
    queryFn: async () => {
      if (!contexto) return null;
      
      const { data, error } = await supabase.functions.invoke('calcular-tributacao', {
        body: { contexto },
      });
      
      if (error) throw error;
      return data as ResultadoCalculoFiscal;
    },
    enabled: enabled && !!contexto?.empresa?.uf && !!contexto?.cliente?.uf && !!contexto?.produto?.ncm,
    staleTime: 30000, // Cache por 30 segundos
    retry: false,
  });
}

// =============================================================================
// Hook para Cadastros Auxiliares (CST, CFOP, etc.)
// =============================================================================

export function useCadastroCST(tributo?: 'ICMS' | 'IPI' | 'PIS' | 'COFINS', tipo?: 'CST' | 'CSOSN') {
  return useQuery({
    queryKey: ['cadastro-cst', tributo, tipo],
    queryFn: async () => {
      let query = supabase
        .from('cadastro_cst')
        .select('*')
        .eq('is_active', true)
        .order('codigo');
      
      if (tributo) query = query.eq('tributo', tributo);
      if (tipo) query = query.eq('tipo', tipo);
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useCadastroCFOP(tipoOperacao?: string) {
  return useQuery({
    queryKey: ['cadastro-cfop', tipoOperacao],
    queryFn: async () => {
      let query = supabase
        .from('cadastro_cfop')
        .select('*')
        .eq('is_active', true)
        .order('codigo');
      
      if (tipoOperacao) query = query.eq('tipo_operacao', tipoOperacao);
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useCadastroEnquadramentoIPI() {
  return useQuery({
    queryKey: ['cadastro-enquadramento-ipi'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cadastro_enquadramento_ipi')
        .select('*')
        .eq('is_active', true)
        .order('codigo');
      
      if (error) throw error;
      return data;
    },
  });
}
