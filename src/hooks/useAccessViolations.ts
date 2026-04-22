import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useModulePermissions } from "@/hooks/useModulePermissions";

export interface AccessViolationsSummary {
  total: number;
  period_days: number;
  by_user: Array<{ user_id: string; user_name: string; total: number }>;
  by_day: Array<{ day: string; total: number }>;
  by_action: Array<{ action: string; total: number }>;
  recent: Array<{
    id: string;
    user_id: string;
    user_name: string;
    action: string;
    entity_type: string;
    attempted_at: string;
    details: Record<string, unknown>;
  }>;
  error?: string;
}

/**
 * Resumo consolidado de violações de janela de acesso. Admin-only.
 */
export function useAccessViolations(periodDays = 30) {
  const { isAdmin } = useModulePermissions();

  return useQuery({
    queryKey: ["access_violations_summary", periodDays],
    enabled: isAdmin,
    staleTime: 60_000,
    queryFn: async (): Promise<AccessViolationsSummary | null> => {
      const { data, error } = await supabase.rpc(
        "get_access_violations_summary",
        { p_days: periodDays },
      );
      if (error) throw error;
      return data as unknown as AccessViolationsSummary;
    },
  });
}
