// supabase/functions/_shared/accessControl.ts
//
// Helper para Edge Functions sensíveis (ERP, integrações, IA com escrita, etc.)
// Verifica se o usuário OU o tenant está dentro da janela de acesso configurada.
//
// MODOS DE FALHA (quando a RPC retorna erro de rede/banco):
//
//   mode: "lenient" (padrão)  → fail-OPEN: libera o acesso e loga warn.
//                              Use em integrações não-críticas (sync de cache,
//                              telemetria, IA somente-leitura).
//
//   mode: "strict"            → fail-CLOSED: bloqueia o acesso.
//                              Use em ERP, financeiro, escrita em pedidos,
//                              qualquer função que mute estado de negócio.
//
// Admin/desenvolvedor sempre passam (regra está dentro da RPC `is_within_access_window`).
// Tenant sem regras → libera (fail-safe).
//
// Para jobs SEM userId (cron, importações em massa), use `checkAccessWindowForTenant`
// com o tenant_id da execução.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type AccessCheckMode = "strict" | "lenient";

export class AccessWindowError extends Error {
  status = 403;
  code = "OUTSIDE_ALLOWED_HOURS";
  constructor(message = "Acesso fora do horário permitido") {
    super(message);
    this.name = "AccessWindowError";
  }
}

export class AccessCheckUnavailableError extends Error {
  status = 503;
  code = "ACCESS_CHECK_UNAVAILABLE";
  constructor(message = "Verificação de janela de acesso indisponível") {
    super(message);
    this.name = "AccessCheckUnavailableError";
  }
}

interface CheckOptions {
  /** "strict" para ERP/financeiro, "lenient" (default) para o resto. */
  mode?: AccessCheckMode;
  /** Identifica a função chamadora nos logs. */
  context?: string;
}

/**
 * Verifica se o user_id está dentro da janela de acesso. Lança em caso negativo.
 */
export async function checkAccessWindow(
  supabase: SupabaseClient,
  userId: string,
  opts: CheckOptions = {},
): Promise<void> {
  if (!userId) return;
  const mode: AccessCheckMode = opts.mode ?? "lenient";
  const ctx = opts.context ?? "edge_function";

  const { data, error } = await supabase.rpc("is_within_access_window", {
    p_user_id: userId,
  });

  if (error) {
    if (mode === "strict") {
      console.error(
        `[accessControl:${ctx}] RPC falhou em modo STRICT — bloqueando:`,
        error.message,
      );
      throw new AccessCheckUnavailableError();
    }
    console.warn(
      `[accessControl:${ctx}] RPC falhou em modo LENIENT — liberando:`,
      error.message,
    );
    return;
  }

  if (data === false) {
    throw new AccessWindowError();
  }
}

/**
 * Verifica a janela do TENANT (não depende de usuário).
 * Use em cron jobs, importações em massa do ERP e processamento de filas
 * em background, onde não há userId disponível.
 *
 * Diferença vs `checkAccessWindow`: ignora bypass de admin/dev (não faz sentido
 * em jobs de sistema) e não loga `admin_bypass`.
 */
export async function checkAccessWindowForTenant(
  supabase: SupabaseClient,
  tenantId: string | null | undefined,
  opts: CheckOptions = {},
): Promise<void> {
  if (!tenantId) return;
  const mode: AccessCheckMode = opts.mode ?? "lenient";
  const ctx = opts.context ?? "edge_function_tenant";

  const { data, error } = await supabase.rpc("is_tenant_within_access_window", {
    p_tenant_id: tenantId,
  });

  if (error) {
    if (mode === "strict") {
      console.error(
        `[accessControl:${ctx}] RPC tenant falhou em STRICT — bloqueando:`,
        error.message,
      );
      throw new AccessCheckUnavailableError();
    }
    console.warn(
      `[accessControl:${ctx}] RPC tenant falhou em LENIENT — liberando:`,
      error.message,
    );
    return;
  }

  if (data === false) {
    throw new AccessWindowError(
      "Janela de acesso da empresa fechada — job postergado",
    );
  }
}

/**
 * Versão non-throwing por usuário.
 */
export async function isWithinAccessWindow(
  supabase: SupabaseClient,
  userId: string,
  opts: CheckOptions = {},
): Promise<boolean> {
  if (!userId) return true;
  const mode: AccessCheckMode = opts.mode ?? "lenient";
  const ctx = opts.context ?? "edge_function";

  const { data, error } = await supabase.rpc("is_within_access_window", {
    p_user_id: userId,
  });

  if (error) {
    console.warn(
      `[accessControl:${ctx}] RPC falhou (mode=${mode}):`,
      error.message,
    );
    return mode === "lenient";
  }
  return data !== false;
}
