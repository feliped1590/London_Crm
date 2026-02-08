import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { CreditoPresumidoRegra } from "@/types/fiscal-reforma";

interface CreditoPresumidoInput {
  codigo: string;
  nome: string;
  descricao?: string;
  tributo: 'cbs' | 'ibs' | 'ambos';
  aplica_por_adquirente?: boolean;
  tipos_adquirente?: string[];
  aplica_por_operacao?: boolean;
  tipos_operacao?: string[];
  aplica_por_ncm?: boolean;
  ncms_aplicaveis?: string[];
  aplica_por_regiao?: boolean;
  ufs_aplicaveis?: string[];
  percentual_credito: number;
  base_legal?: string;
  valid_from: string;
  valid_until?: string;
}

interface ContextoAplicacao {
  tributo: 'cbs' | 'ibs';
  ncm?: string;
  tipo_adquirente?: string;
  tipo_operacao?: string;
  uf?: string;
}

/**
 * Hook para gerenciar regras de crédito presumido
 */
export function useCreditoPresumido() {
  const queryClient = useQueryClient();

  // Buscar todas as regras de crédito presumido
  const { data: regras, isLoading, error } = useQuery({
    queryKey: ["credito-presumido-regras"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credito_presumido_regras")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as CreditoPresumidoRegra[];
    },
  });

  // Criar nova regra
  const createMutation = useMutation({
    mutationFn: async (input: CreditoPresumidoInput) => {
      const { data, error } = await supabase
        .from("credito_presumido_regras")
        .insert({
          ...input,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credito-presumido-regras"] });
      toast.success("Regra de crédito presumido criada com sucesso");
    },
    onError: (error) => {
      toast.error("Erro ao criar regra: " + error.message);
    },
  });

  // Atualizar regra
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...input }: CreditoPresumidoInput & { id: string }) => {
      const { data, error } = await supabase
        .from("credito_presumido_regras")
        .update(input)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credito-presumido-regras"] });
      toast.success("Regra de crédito presumido atualizada");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar regra: " + error.message);
    },
  });

  // Desativar regra
  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("credito_presumido_regras")
        .update({ is_active: false })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credito-presumido-regras"] });
      toast.success("Regra de crédito presumido desativada");
    },
    onError: (error) => {
      toast.error("Erro ao desativar regra: " + error.message);
    },
  });

  // Buscar crédito presumido aplicável via função RPC
  const buscarCreditoAplicavel = async (contexto: ContextoAplicacao): Promise<CreditoPresumidoRegra | null> => {
    const { data, error } = await supabase.rpc("get_credito_presumido_aplicavel", {
      p_tributo: contexto.tributo,
      p_ncm: contexto.ncm || null,
      p_tipo_adquirente: contexto.tipo_adquirente || null,
      p_tipo_operacao: contexto.tipo_operacao || null,
      p_uf: contexto.uf || null,
    });

    if (error) {
      console.error("Erro ao buscar crédito presumido:", error);
      return null;
    }

    if (!data || data.length === 0) return null;

    // Buscar regra completa pelo ID retornado
    const regra = regras?.find(r => r.id === data[0].id);
    return regra || null;
  };

  return {
    regras,
    isLoading,
    error,
    createRegra: createMutation.mutateAsync,
    updateRegra: updateMutation.mutateAsync,
    deactivateRegra: deactivateMutation.mutateAsync,
    buscarCreditoAplicavel,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
  };
}
