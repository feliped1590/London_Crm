/**
 * Mapeamento simplificado CRM → ERP Projedata para produtos.
 *
 * Premissas (definidas pelo time + Projedata):
 *  - 1 versão fixa: { versao: "1", roteiro: 1, situacao: "A" }
 *  - 1 depósito fixo
 *  - conta_contabil = 142
 *  - familia / classe enviadas como STRING (label do lookup)
 *  - codigo controlado por erp_product_code (vazio = create)
 *
 * grupoComando atual: "IMP_ITEM_VERSAO_TESTE" (ajustável via env PROJEDATA_PRODUCT_COMMAND).
 */

import { buildEnvelope, serializeEnvelope } from './serializer.ts';

// ─── Configuráveis ────────────────────────────────────────────────
export const PRODUCT_GRUPO_COMANDO_DEFAULT = 'IMP_ITEM_VERSAO_TESTE';

export function getProductGrupoComando(): string {
  try {
    return Deno.env.get('PROJEDATA_PRODUCT_COMMAND') || PRODUCT_GRUPO_COMANDO_DEFAULT;
  } catch {
    return PRODUCT_GRUPO_COMANDO_DEFAULT;
  }
}

// ─── Constantes fixas do payload ──────────────────────────────────
export const PRODUCT_FIXED = {
  conta_contabil: 142,
  depositos: [
    {
      sequencia: 1,
      deposito: 1,
      operacao: 'A' as const,
      centro_custo: 1,
      contabil: 'N' as const,
      remove_deposito: 'N' as const,
    },
  ],
} as const;

// ─── Tipos ────────────────────────────────────────────────────────
export interface ProductForSync {
  id: string;
  name: string;
  nome_impresso?: string | null;
  erp_versao?: string | null;
  erp_product_code?: string | null;
  erp_empresa?: number | null;
  erp_grupo?: string | null;
  erp_subgrupo?: string | null;
  /** label de product_families (resolvido via JOIN). */
  familia_label?: string | null;
  /** label de product_classes (resolvido via JOIN). */
  classe_label?: string | null;
  tipo_item?: string | null;
  tipo_ficha?: number | null;
  unit_measure?: string | null;
  ncm_code?: string | null;
}

export interface ProductSyncContext {
  /** erp_user_code do executor da ação. */
  erp_usuario: number;
}

// ─── Mapper ───────────────────────────────────────────────────────
export function mapProductToProjedata(p: ProductForSync, ctx: ProductSyncContext): Record<string, unknown> {
  return {
    classe: (p.classe_label ?? '').trim(),
    codigo: (p.erp_product_code ?? '').trim(), // vazio = create
    conta_contabil: PRODUCT_FIXED.conta_contabil,
    descricao: (p.nome_impresso ?? '').trim(),
    empresa: p.erp_empresa ?? 1,
    familia: (p.familia_label ?? '').trim(),
    grupo: (p.erp_grupo ?? '').trim(),
    subgrupo: (p.erp_subgrupo ?? '').trim(),
    ncm: (p.ncm_code ?? '').replace(/\D/g, ''),
    tipo_ficha: p.tipo_ficha ?? 1,
    tipo_item: (p.tipo_item ?? '').trim(),
    unidade: (p.unit_measure ?? '').trim().toUpperCase(),
    usuario: ctx.erp_usuario,
    versoes: [
      {
        versao: '1',
        roteiro: 1,
        situacao: 'A' as const,
        detalhes: (p.erp_versao ?? '').trim(),
      },
    ],
    depositos: PRODUCT_FIXED.depositos,
  };
}

/**
 * Gera o payload final (envelope ASDCOMANDO) já serializado em string única,
 * com o JSON interno em "json" como STRING (aspas escapadas via JSON.stringify).
 */
export function buildProductPayloadV2(
  p: ProductForSync,
  ctx: ProductSyncContext,
  grupoComando: string = getProductGrupoComando(),
): string {
  const inner = mapProductToProjedata(p, ctx);
  const envelope = buildEnvelope(grupoComando, inner);
  return serializeEnvelope(envelope);
}

/** Detecta se o envio é update (codigo preenchido) ou create. */
export function isProductUpdate(p: ProductForSync): boolean {
  return !!(p.erp_product_code && String(p.erp_product_code).trim());
}
