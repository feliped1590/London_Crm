import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { 
  CadastroImpostoSeletivo, 
  CategoriaImpostoSeletivo 
} from "@/types/fiscal-reforma";
import type { Json } from "@/integrations/supabase/types";

interface ImpostoSeletivoInput {
  codigo: string;
  descricao: string;
  categoria: CategoriaImpostoSeletivo;
  aliquota_padrao: number;
  aliquota_maxima?: number;
  ncms_aplicaveis?: string[];
  produtos_especificos?: string[];
  excecoes_legais?: string[];
  criterios_adicionais?: Json;
  incide_produto_final?: boolean;
  incide_importacao?: boolean;
  base_legal?: string;
  valid_from: string;
  valid_until?: string;
}

interface ContextoAplicacaoIS {
  categoria: CategoriaImpostoSeletivo;
  ncm?: string;
  produto_descricao?: string;
  produto_final?: boolean;
  importacao?: boolean;
}

/**
 * Hook para gerenciar cadastro do Imposto Seletivo
 */
export function useImpostoSeletivo() {
  const queryClient = useQueryClient();

  // Buscar todos os cadastros de IS
  const { data: cadastros, isLoading, error } = useQuery({
    queryKey: ["cadastro-imposto-seletivo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cadastro_imposto_seletivo")
        .select("*")
        .eq("is_active", true)
        .order("categoria", { ascending: true });

      if (error) throw error;
      return data as CadastroImpostoSeletivo[];
    },
  });

  // Criar novo cadastro
  const createMutation = useMutation({
    mutationFn: async (input: ImpostoSeletivoInput) => {
      const { data, error } = await supabase
        .from("cadastro_imposto_seletivo")
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cadastro-imposto-seletivo"] });
      toast.success("Cadastro de Imposto Seletivo criado com sucesso");
    },
    onError: (error) => {
      toast.error("Erro ao criar cadastro: " + error.message);
    },
  });

  // Atualizar cadastro
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...input }: ImpostoSeletivoInput & { id: string }) => {
      const { data, error } = await supabase
        .from("cadastro_imposto_seletivo")
        .update({
          ...input,
          criterios_adicionais: input.criterios_adicionais ?? null,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cadastro-imposto-seletivo"] });
      toast.success("Cadastro de Imposto Seletivo atualizado");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar cadastro: " + error.message);
    },
  });

  // Desativar cadastro
  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("cadastro_imposto_seletivo")
        .update({ is_active: false })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cadastro-imposto-seletivo"] });
      toast.success("Cadastro de Imposto Seletivo desativado");
    },
    onError: (error) => {
      toast.error("Erro ao desativar cadastro: " + error.message);
    },
  });

  // Verificar se IS é aplicável a um produto
  const verificarAplicabilidade = (contexto: ContextoAplicacaoIS): CadastroImpostoSeletivo | null => {
    if (!cadastros || contexto.categoria === 'nao_aplicavel') return null;

    // Buscar cadastro pela categoria
    const cadastro = cadastros.find(c => c.categoria === contexto.categoria);
    if (!cadastro) return null;

    // Verificar se é produto final (quando exigido)
    if (cadastro.incide_produto_final && !contexto.produto_final) {
      return null;
    }

    // Verificar se é importação (quando exigido)
    if (!cadastro.incide_importacao && contexto.importacao) {
      return null;
    }

    // Verificar exceções legais
    if (cadastro.excecoes_legais && contexto.produto_descricao) {
      const descricaoLower = contexto.produto_descricao.toLowerCase();
      const isExcecao = cadastro.excecoes_legais.some(
        exc => descricaoLower.includes(exc.toLowerCase())
      );
      if (isExcecao) return null;
    }

    // Verificar NCM (quando aplicável)
    if (cadastro.ncms_aplicaveis && cadastro.ncms_aplicaveis.length > 0 && contexto.ncm) {
      const ncmMatch = cadastro.ncms_aplicaveis.some(ncm => 
        contexto.ncm!.startsWith(ncm) || ncm.startsWith(contexto.ncm!)
      );
      if (!ncmMatch) return null;
    }

    return cadastro;
  };

  // Obter alíquota do IS para um contexto
  const getAliquotaIS = (contexto: ContextoAplicacaoIS): number => {
    const cadastro = verificarAplicabilidade(contexto);
    return cadastro?.aliquota_padrao ?? 0;
  };

  // Agrupar por categoria
  const cadastrosPorCategoria = cadastros?.reduce((acc, cadastro) => {
    if (!acc[cadastro.categoria]) {
      acc[cadastro.categoria] = [];
    }
    acc[cadastro.categoria].push(cadastro);
    return acc;
  }, {} as Record<CategoriaImpostoSeletivo, CadastroImpostoSeletivo[]>);

  return {
    cadastros,
    cadastrosPorCategoria,
    isLoading,
    error,
    createCadastro: createMutation.mutateAsync,
    updateCadastro: updateMutation.mutateAsync,
    deactivateCadastro: deactivateMutation.mutateAsync,
    verificarAplicabilidade,
    getAliquotaIS,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
  };
}
