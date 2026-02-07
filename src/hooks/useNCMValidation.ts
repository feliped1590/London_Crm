import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { NCMCode, NCMSemanticValidation } from '@/types/fiscal';
import { toast } from 'sonner';

interface UseNCMValidationOptions {
  onValidationComplete?: (result: NCMSemanticValidation) => void;
}

export function useNCMValidation(options?: UseNCMValidationOptions) {
  const [validationResult, setValidationResult] = useState<NCMSemanticValidation | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  // Buscar NCM por código ou descrição
  const searchNCM = useCallback(async (searchTerm: string): Promise<NCMCode[]> => {
    if (!searchTerm || searchTerm.length < 2) return [];

    const { data, error } = await supabase.rpc('search_ncm', {
      search_term: searchTerm,
      limit_rows: 20,
    });

    if (error) {
      console.error('Erro ao buscar NCM:', error);
      return [];
    }

    return (data || []).map((item: any) => ({
      id: item.id,
      codigo: item.codigo?.trim() || '',
      descricao: item.descricao || '',
      status: item.status || 'ativo',
      aliquota_ipi_oficial: item.aliquota_ipi_oficial,
      data_vigencia: '',
      created_at: '',
      updated_at: '',
    }));
  }, []);

  // Buscar NCM específico por código
  const fetchNCMByCode = useCallback(async (codigo: string): Promise<NCMCode | null> => {
    if (!codigo || codigo.length !== 8) return null;

    const { data, error } = await supabase
      .from('ncm_codes')
      .select('*')
      .eq('codigo', codigo)
      .single();

    if (error || !data) return null;
    
    return {
      ...data,
      codigo: data.codigo?.trim() || '',
    } as NCMCode;
  }, []);

  // Validação semântica com IA
  const validateSemantic = useMutation({
    mutationFn: async ({ 
      productDescription, 
      ncmCode, 
      ncmDescription 
    }: { 
      productDescription: string; 
      ncmCode: string; 
      ncmDescription: string;
    }): Promise<NCMSemanticValidation> => {
      const { data, error } = await supabase.functions.invoke('validate-ncm-semantic', {
        body: { productDescription, ncmCode, ncmDescription },
      });

      if (error) {
        console.error('Erro na validação semântica:', error);
        throw error;
      }

      return data as NCMSemanticValidation;
    },
    onSuccess: (result) => {
      setValidationResult(result);
      options?.onValidationComplete?.(result);
      
      if (result.risk_level === 'high') {
        toast.warning('Atenção: Possível divergência no NCM', {
          description: result.summary,
        });
      }
    },
    onError: (error) => {
      console.error('Erro na validação:', error);
      // Não mostrar erro, apenas fallback silencioso
      setValidationResult({
        compatible: true,
        confidence: 0.5,
        risk_level: 'medium',
        summary: 'Validação automática indisponível.',
      });
    },
  });

  // Função principal de validação
  const validateNCM = useCallback(async (
    productDescription: string,
    ncmCode: string,
    ncmDescription?: string
  ) => {
    if (!productDescription || !ncmCode) {
      setValidationResult(null);
      return null;
    }

    setIsValidating(true);

    try {
      // Se não temos a descrição do NCM, buscar
      let description = ncmDescription;
      if (!description) {
        const ncm = await fetchNCMByCode(ncmCode);
        description = ncm?.descricao || '';
      }

      if (!description) {
        setValidationResult({
          compatible: false,
          confidence: 0,
          risk_level: 'high',
          summary: 'NCM não encontrado na base oficial.',
        });
        return null;
      }

      const result = await validateSemantic.mutateAsync({
        productDescription,
        ncmCode,
        ncmDescription: description,
      });

      return result;
    } catch (error) {
      console.error('Erro na validação NCM:', error);
      return null;
    } finally {
      setIsValidating(false);
    }
  }, [fetchNCMByCode, validateSemantic]);

  // Verificar se NCM existe e está ativo
  const checkNCMValidity = useCallback(async (codigo: string): Promise<{
    exists: boolean;
    isActive: boolean;
    ncm?: NCMCode;
    message?: string;
  }> => {
    if (!codigo || codigo.length !== 8) {
      return { exists: false, isActive: false, message: 'NCM deve ter 8 dígitos' };
    }

    const ncm = await fetchNCMByCode(codigo);
    
    if (!ncm) {
      return { exists: false, isActive: false, message: 'NCM não encontrado na base oficial' };
    }

    if (ncm.status === 'inativo') {
      return { exists: true, isActive: false, ncm, message: 'NCM está inativo' };
    }

    if (ncm.status === 'obsoleto') {
      return { exists: true, isActive: false, ncm, message: 'NCM está obsoleto' };
    }

    return { exists: true, isActive: true, ncm };
  }, [fetchNCMByCode]);

  // Limpar estado
  const clearValidation = useCallback(() => {
    setValidationResult(null);
    setIsValidating(false);
  }, []);

  return {
    searchNCM,
    fetchNCMByCode,
    validateNCM,
    checkNCMValidity,
    clearValidation,
    validationResult,
    isValidating: isValidating || validateSemantic.isPending,
  };
}
