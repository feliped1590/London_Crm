import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { 
  TransicaoTributariaParametros, 
  ModeloTributario 
} from "@/types/fiscal-reforma";

/**
 * Hook para gerenciar parâmetros de transição tributária
 */
export function useTransicaoTributaria() {
  // Buscar todos os parâmetros de transição
  const { data: parametros, isLoading, error } = useQuery({
    queryKey: ["transicao-tributaria-parametros"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transicao_tributaria_parametros")
        .select("*")
        .eq("is_active", true)
        .order("ano_referencia", { ascending: true });

      if (error) throw error;
      return data as TransicaoTributariaParametros[];
    },
  });

  // Obter parâmetros para um ano específico
  const getParametrosAno = (ano: number): TransicaoTributariaParametros | undefined => {
    return parametros?.find(p => p.ano_referencia === ano);
  };

  // Determinar modelo tributário baseado na data
  const determinarModelo = (data: Date): {
    modelo: ModeloTributario;
    anoReferencia: number;
    parametros?: TransicaoTributariaParametros;
  } => {
    const ano = data.getFullYear();
    const params = getParametrosAno(ano);

    if (ano < 2026) {
      return { 
        modelo: 'legado', 
        anoReferencia: ano,
        parametros: params 
      };
    }

    if (ano === 2026) {
      return { 
        modelo: 'dual_teste', 
        anoReferencia: 2026,
        parametros: params 
      };
    }

    if (ano >= 2027 && ano <= 2032) {
      return { 
        modelo: 'dual_transicao', 
        anoReferencia: ano,
        parametros: params 
      };
    }

    return { 
      modelo: 'novo', 
      anoReferencia: ano,
      parametros: params 
    };
  };

  // Verificar se está em período de transição
  const isEmTransicao = (data: Date): boolean => {
    const ano = data.getFullYear();
    return ano >= 2026 && ano <= 2032;
  };

  // Obter percentuais de transição para um ano
  const getPercentuaisTransicao = (ano: number) => {
    const params = getParametrosAno(ano);
    if (!params) {
      // Fallback para valores padrão
      if (ano < 2026) {
        return { icms_iss: 100, ibs: 0, pis_cofins: 100, cbs: 0 };
      }
      if (ano >= 2033) {
        return { icms_iss: 0, ibs: 100, pis_cofins: 0, cbs: 100 };
      }
      // Interpolação linear para anos de transição
      const icms = Math.max(0, 100 - (ano - 2028) * 10);
      return { icms_iss: icms, ibs: 100 - icms, pis_cofins: 0, cbs: 100 };
    }

    return {
      icms_iss: params.percentual_icms_iss,
      ibs: params.percentual_ibs,
      pis_cofins: params.percentual_pis_cofins,
      cbs: params.percentual_cbs,
    };
  };

  // Obter alíquotas de referência
  const getAliquotasReferencia = (ano: number) => {
    const params = getParametrosAno(ano);
    return {
      cbs: params?.aliquota_cbs_referencia ?? 8.8,
      ibs: params?.aliquota_ibs_referencia ?? 17.7,
      ibs_estadual: params?.aliquota_ibs_estadual ?? 11.5,
      ibs_municipal: params?.aliquota_ibs_municipal ?? 6.2,
    };
  };

  return {
    parametros,
    isLoading,
    error,
    getParametrosAno,
    determinarModelo,
    isEmTransicao,
    getPercentuaisTransicao,
    getAliquotasReferencia,
  };
}
