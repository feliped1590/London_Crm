import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SearchFilters {
  cnpj?: string;
  razaoSocial?: string;
  cnae?: string;
  porte?: string;
  estado?: string;
  dataAberturaInicio?: string;
  dataAberturaFim?: string;
}

export interface ProspectingResult {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  cnae_principal: string;
  cnae_descricao: string;
  porte: string;
  estado: string;
  cidade: string;
  data_abertura: string;
  situacao_cadastral: string;
  already_exists: boolean;
  existing_company_id?: string;
}

export interface SearchResponse {
  success: boolean;
  search_id?: string;
  results: ProspectingResult[];
  message: string;
  error?: string;
}

export interface SaveLeadResponse {
  success: boolean;
  message: string;
  company?: {
    id: string;
    name: string;
    cnpj: string;
  };
  task_id?: string;
  error?: string;
  existing_company?: {
    id: string;
    name: string;
    owner_name?: string;
  };
}

export function useProspecting() {
  const queryClient = useQueryClient();
  const [currentSearch, setCurrentSearch] = useState<SearchResponse | null>(null);
  const [resultIdMap, setResultIdMap] = useState<Record<string, string>>({});
  const [isSearching, setIsSearching] = useState(false);

  // Buscar histórico de buscas
  const { data: searchHistory, isLoading: isLoadingHistory } = useQuery({
    queryKey: ['prospecting-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prospecting_searches')
        .select(`
          id,
          filters,
          results_count,
          created_at
        `)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data;
    },
  });

  // Buscar resultados salvos
  const { data: savedResults, isLoading: isLoadingSaved } = useQuery({
    queryKey: ['prospecting-saved-results'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prospecting_results')
        .select(`
          id,
          cnpj,
          razao_social,
          nome_fantasia,
          porte,
          estado,
          cidade,
          status,
          saved_as_company_id,
          saved_at,
          created_at
        `)
        .eq('status', 'saved')
        .order('saved_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
  });

  // Mutation para buscar empresas
  const searchMutation = useMutation({
    mutationFn: async (filters: SearchFilters): Promise<SearchResponse> => {
      setIsSearching(true);
      
      const { data, error } = await supabase.functions.invoke('prospecting-search', {
        body: { filters },
      });

      if (error) {
        throw new Error(error.message || 'Erro ao buscar empresas');
      }

      if (data.error) {
        throw new Error(data.error);
      }

      return data as SearchResponse;
    },
    onSuccess: async (data) => {
      setCurrentSearch(data);
      queryClient.invalidateQueries({ queryKey: ['prospecting-history'] });
      
      // Buscar IDs dos resultados imediatamente
      if (data.search_id && data.results.length > 0) {
        const { data: resultsData } = await supabase
          .from('prospecting_results')
          .select('id, cnpj')
          .eq('search_id', data.search_id);
        
        if (resultsData) {
          const idsMap: Record<string, string> = {};
          resultsData.forEach(r => {
            idsMap[r.cnpj] = r.id;
          });
          setResultIdMap(idsMap);
        }
      }
      
      if (data.results.length === 0) {
        toast.info('Nenhuma empresa encontrada');
      } else {
        toast.success(data.message);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
      setCurrentSearch(null);
      setResultIdMap({});
    },
    onSettled: () => {
      setIsSearching(false);
    },
  });

  // Mutation para salvar como lead
  const saveLeadMutation = useMutation({
    mutationFn: async (params: {
      resultId: string;
      ownerId?: string;
      createTask?: boolean;
      taskTitle?: string;
      taskDueDate?: string;
    }): Promise<SaveLeadResponse> => {
      const { data, error } = await supabase.functions.invoke('prospecting-save-lead', {
        body: params,
      });

      if (error) {
        throw new Error(error.message || 'Erro ao salvar lead');
      }

      return data as SaveLeadResponse;
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message);
        queryClient.invalidateQueries({ queryKey: ['prospecting-saved-results'] });
        queryClient.invalidateQueries({ queryKey: ['companies'] });
        
        // Atualizar resultado local
        if (currentSearch && data.company) {
          setCurrentSearch(prev => {
            if (!prev) return null;
            return {
              ...prev,
              results: prev.results.map(r => 
                r.cnpj === data.company!.cnpj
                  ? { ...r, already_exists: true, existing_company_id: data.company!.id }
                  : r
              ),
            };
          });
        }
      } else if (data.error) {
        if (data.existing_company) {
          toast.error(`${data.error}. Empresa: ${data.existing_company.name}${data.existing_company.owner_name ? ` (Responsável: ${data.existing_company.owner_name})` : ''}`);
        } else {
          toast.error(data.error);
        }
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Mutation para descartar resultado
  const discardMutation = useMutation({
    mutationFn: async (resultId: string) => {
      const { error } = await supabase
        .from('prospecting_results')
        .update({
          status: 'discarded',
          discarded_at: new Date().toISOString(),
        })
        .eq('id', resultId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Resultado descartado');
      queryClient.invalidateQueries({ queryKey: ['prospecting-saved-results'] });
    },
    onError: (error: Error) => {
      toast.error('Erro ao descartar: ' + error.message);
    },
  });

  return {
    // Estado
    currentSearch,
    resultIdMap,
    isSearching,
    searchHistory,
    savedResults,
    isLoadingHistory,
    isLoadingSaved,
    
    // Ações
    search: searchMutation.mutate,
    saveLead: saveLeadMutation.mutate,
    discardResult: discardMutation.mutate,
    clearSearch: () => { setCurrentSearch(null); setResultIdMap({}); },
    
    // Estados de loading
    isSavingLead: saveLeadMutation.isPending,
    isDiscarding: discardMutation.isPending,
  };
}
