/**
 * Telemetria do parser de retornos ERP.
 *
 * Quando o parser encontra um retorno cujo formato NÃO casa com nenhum
 * padrão conhecido (matchedPattern === null), isso é um sinal forte de:
 *   - O ERP mudou o formato de resposta (precisamos adicionar padrão novo)
 *   - Ou um endpoint novo não foi mapeado
 *
 * Esta função:
 *   1. Loga em formato estruturado (fácil de filtrar nos edge logs)
 *   2. Grava em `audit_logs` com action='erp.parser.unknown_pattern'
 *      para permitir alertas e dashboards de "unknown rate"
 *
 * Use sempre logo após chamar parseCustomerRetorno/parseProductRetorno/parseOrderRetorno.
 */

import type { ErpIntegrationResult } from './integration-result.ts';

// deno-lint-ignore no-explicit-any
type SupabaseLike = { from: (table: string) => any };

export interface TelemetryContext {
  /** Nome da edge function de origem (para correlação). */
  source: string;
  /** ID da entidade que disparou o sync (companyId, productId, orderId). */
  entityId?: string | null;
  /** tenant_id se disponível. */
  tenantId?: string | null;
  /** user_id se disponível (caso contrário, usa null/system). */
  userId?: string | null;
}

/**
 * Inspeciona o resultado e, se for um padrão desconhecido, registra alerta.
 * Não-bloqueante: erros de logging nunca propagam.
 */
export async function trackParserResult(
  supabase: SupabaseLike,
  result: ErpIntegrationResult,
  ctx: TelemetryContext,
): Promise<void> {
  // Só nos importamos com unknowns aqui — sucessos e erros de ERP já vão p/ erp_sync_logs
  if (result.matchedPattern !== null) return;
  // Se a ação for 'error' (ERP devolveu #ERRO# reconhecido), também ignora
  if (result.action === 'error') return;

  // 1) Log estruturado (visível em supabase--edge_function_logs com search="ERP_PARSER_UNKNOWN")
  try {
    console.warn(
      'ERP_PARSER_UNKNOWN',
      JSON.stringify({
        source: ctx.source,
        entity: result.entity,
        action: result.action,
        raw: result.raw,
        errorType: result.errorType,
        errorMessage: result.errorMessage,
        warnings: result.warnings,
        metadata: result.metadata,
        entityId: ctx.entityId ?? null,
        tenantId: ctx.tenantId ?? null,
        timestamp: new Date().toISOString(),
      }),
    );
  } catch {
    // ignore
  }

  // 2) Persistir em audit_logs para queries históricas e dashboards
  try {
    await supabase.from('audit_logs').insert({
      user_id: ctx.userId ?? '00000000-0000-0000-0000-000000000000',
      action: 'erp.parser.unknown_pattern',
      entity_type: result.entity,
      entity_id: ctx.entityId ?? null,
      metadata: {
        source: ctx.source,
        raw: result.raw,
        action: result.action,
        errorType: result.errorType,
        errorMessage: result.errorMessage,
        warnings: result.warnings,
        parserMetadata: result.metadata,
        tenantId: ctx.tenantId ?? null,
      },
    });
  } catch (err) {
    console.error('ERP_PARSER_UNKNOWN_LOG_FAILED', err);
  }
}
