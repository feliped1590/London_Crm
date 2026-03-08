import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useCompanyFiscal(companyId?: string | null) {
  const { data: companyFiscalData, isLoading } = useQuery({
    queryKey: ['company-fiscal', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('contribuinte_ipi')
        .eq('id', companyId!)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  return { companyFiscalData, isLoading };
}
