import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentUser } from '@/lib/auth/currentUser';
import type { BeneficioFiscal, ClienteBeneficioFiscal } from '@/types/fiscal-extended';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type BeneficioInsert = Database['public']['Tables']['beneficios_fiscais']['Insert'];
type BeneficioUpdate = Database['public']['Tables']['beneficios_fiscais']['Update'];
type ClienteBeneficioInsert = Database['public']['Tables']['cliente_beneficios_fiscais']['Insert'];

// =============================================================================
// Hook para Benefícios Fiscais
// =============================================================================

export function useBeneficiosFiscais() {
  return useQuery({
    queryKey: ['beneficios-fiscais'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('beneficios_fiscais')
        .select('*')
        .order('nome');
      
      if (error) throw error;
      return data as BeneficioFiscal[];
    },
  });
}

export function useBeneficioFiscal(id: string | undefined) {
  return useQuery({
    queryKey: ['beneficios-fiscais', id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from('beneficios_fiscais')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as BeneficioFiscal;
    },
    enabled: !!id,
  });
}

export function useCreateBeneficioFiscal() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (beneficio: BeneficioInsert) => {
      const { data: userData } = await ({ data: { user: await getCurrentUser() } } as { data: { user: Awaited<ReturnType<typeof getCurrentUser>> } });
      
      const insertData: BeneficioInsert = {
        ...beneficio,
        created_by: userData.user?.id,
      };
      
      const { data, error } = await supabase
        .from('beneficios_fiscais')
        .insert(insertData)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['beneficios-fiscais'] });
      toast.success('Benefício fiscal criado com sucesso');
    },
    onError: (error) => {
      console.error('Erro ao criar benefício:', error);
      toast.error('Erro ao criar benefício fiscal');
    },
  });
}

export function useUpdateBeneficioFiscal() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: BeneficioUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('beneficios_fiscais')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['beneficios-fiscais'] });
      queryClient.invalidateQueries({ queryKey: ['beneficios-fiscais', variables.id] });
      toast.success('Benefício fiscal atualizado com sucesso');
    },
    onError: (error) => {
      console.error('Erro ao atualizar benefício:', error);
      toast.error('Erro ao atualizar benefício fiscal');
    },
  });
}

export function useDeleteBeneficioFiscal() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('beneficios_fiscais')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['beneficios-fiscais'] });
      toast.success('Benefício fiscal excluído com sucesso');
    },
    onError: (error) => {
      console.error('Erro ao excluir benefício:', error);
      toast.error('Erro ao excluir benefício fiscal');
    },
  });
}

// =============================================================================
// Hook para Benefícios Fiscais do Cliente
// =============================================================================

export function useClienteBeneficiosFiscais(companyId: string | undefined) {
  return useQuery({
    queryKey: ['cliente-beneficios-fiscais', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      
      const { data, error } = await supabase
        .from('cliente_beneficios_fiscais')
        .select(`
          *,
          beneficio:beneficios_fiscais (*)
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as (ClienteBeneficioFiscal & { beneficio: BeneficioFiscal })[];
    },
    enabled: !!companyId,
  });
}

export function useVincularBeneficioCliente() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (vinculo: ClienteBeneficioInsert) => {
      const { data: userData } = await ({ data: { user: await getCurrentUser() } } as { data: { user: Awaited<ReturnType<typeof getCurrentUser>> } });
      
      const insertData: ClienteBeneficioInsert = {
        ...vinculo,
        created_by: userData.user?.id,
      };
      
      const { data, error } = await supabase
        .from('cliente_beneficios_fiscais')
        .insert(insertData)
        .select(`
          *,
          beneficio:beneficios_fiscais (*)
        `)
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cliente-beneficios-fiscais', variables.company_id] });
      toast.success('Benefício fiscal vinculado ao cliente');
    },
    onError: (error: Error) => {
      console.error('Erro ao vincular benefício:', error);
      if (error.message.includes('unique_cliente_beneficio')) {
        toast.error('Este benefício já está vinculado ao cliente');
      } else {
        toast.error('Erro ao vincular benefício fiscal');
      }
    },
  });
}

export function useUpdateClienteBeneficio() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, company_id, ...updates }: Partial<ClienteBeneficioFiscal> & { id: string; company_id: string }) => {
      const { data, error } = await supabase
        .from('cliente_beneficios_fiscais')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return { ...data, company_id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['cliente-beneficios-fiscais', data.company_id] });
      toast.success('Vínculo atualizado com sucesso');
    },
    onError: (error) => {
      console.error('Erro ao atualizar vínculo:', error);
      toast.error('Erro ao atualizar vínculo');
    },
  });
}

export function useDesvincularBeneficioCliente() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, company_id }: { id: string; company_id: string }) => {
      const { error } = await supabase
        .from('cliente_beneficios_fiscais')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return { company_id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['cliente-beneficios-fiscais', data.company_id] });
      toast.success('Benefício fiscal desvinculado do cliente');
    },
    onError: (error) => {
      console.error('Erro ao desvincular benefício:', error);
      toast.error('Erro ao desvincular benefício fiscal');
    },
  });
}

// =============================================================================
// Hook para Benefícios Vigentes (filtro por data)
// =============================================================================

export function useBeneficiosFiscaisVigentes() {
  const hoje = new Date().toISOString().split('T')[0];
  
  return useQuery({
    queryKey: ['beneficios-fiscais-vigentes', hoje],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('beneficios_fiscais')
        .select('*')
        .eq('is_active', true)
        .lte('valid_from', hoje)
        .or(`valid_until.is.null,valid_until.gte.${hoje}`)
        .order('nome');
      
      if (error) throw error;
      return data as BeneficioFiscal[];
    },
  });
}
