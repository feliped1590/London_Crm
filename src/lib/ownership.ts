import { supabase } from '@/integrations/supabase/client';

export type OwnershipSource = 'crm' | 'erp';

export const LEGACY_OWNER_COMMENT =
  'LEGACY: owner_id será removido futuramente. Não usar como fonte de ownership.';

export function shouldUseLegacyOwnerFallback(
  source: OwnershipSource,
  salesRepId?: string | null,
): boolean {
  return source === 'erp' || !salesRepId;
}

export function logOwnershipWarning(message: string, details?: Record<string, unknown>) {
  console.warn(message, details ?? {});
}

export async function resolveUserForSalesRep(
  salesRepId: string | null | undefined,
  operationContext?: string,
): Promise<string | null> {
  if (!salesRepId) return null;

  const { data, error } = await (supabase as any).rpc('resolve_user_for_sales_rep', {
    p_sales_rep_id: salesRepId,
    p_operation_context: operationContext ?? null,
  });

  if (error) {
    logOwnershipWarning('Falha ao resolver usuário para sales_rep', {
      salesRepId,
      operationContext,
      error: error.message,
    });
    return null;
  }

  if (!data) {
    logOwnershipWarning('Sales_rep sem usuário vinculado durante operação crítica', {
      salesRepId,
      operationContext,
    });
    return null;
  }

  return data;
}