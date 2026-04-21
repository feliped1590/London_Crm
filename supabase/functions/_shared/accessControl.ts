// supabase/functions/_shared/accessControl.ts
//
// Helper para Edge Functions sensíveis (ERP, integrações, IA com escrita, etc.)
// Verifica se o usuário está dentro da janela de acesso configurada para o tenant.
//
// Uso típico:
//   import { checkAccessWindow } from "../_shared/accessControl.ts";
//   await checkAccessWindow(supabase, userId); // lança AccessWindowError se fora
//
// Comportamento:
// - Admin/desenvolvedor sempre passam (regra está dentro da RPC)
// - Tenant sem regras → libera (fail-safe)
// - Em caso de erro de rede/RPC, NÃO bloqueia (fail-open) — evita derrubar
//   integração ERP por falha transitória. Logs são gerados via console.warn.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export class AccessWindowError extends Error {
  status = 403;
  code = "OUTSIDE_ALLOWED_HOURS";
  constructor(message = "Acesso fora do horário permitido") {
    super(message);
    this.name = "AccessWindowError";
  }
}

/**
 * Verifica se o user_id está dentro da janela de acesso. Lança em caso negativo.
 * @param supabase Cliente Supabase (preferir service_role para evitar RLS)
 * @param userId UUID do usuário
 */
export async function checkAccessWindow(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  if (!userId) return;

  const { data, error } = await supabase.rpc("is_within_access_window", {
    p_user_id: userId,
  });

  if (error) {
    console.warn(
      "[accessControl] is_within_access_window RPC falhou (fail-open):",
      error.message,
    );
    return;
  }

  if (data === false) {
    throw new AccessWindowError();
  }
}

/**
 * Versão non-throwing: devolve boolean. Útil quando a função quer registrar
 * a decisão antes de responder.
 */
export async function isWithinAccessWindow(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  if (!userId) return true;
  const { data, error } = await supabase.rpc("is_within_access_window", {
    p_user_id: userId,
  });
  if (error) {
    console.warn(
      "[accessControl] is_within_access_window RPC falhou (fail-open):",
      error.message,
    );
    return true;
  }
  return data !== false;
}
