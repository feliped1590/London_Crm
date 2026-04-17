/**
 * Serialização de payload para ERP Projedata
 * 
 * O ERP recebe um JSON externo com campo "json" cujo valor
 * é um JSON SERIALIZADO como STRING com aspas escapadas.
 * 
 * Formato final:
 * {"tipoComando":"ASDCOMANDO","grupoComando":"IMP_ITEM_VERSAO_V3","#out#p_retorno":"T","json":"{\"codigo\":\"800432\", ...}"}
 */

import type { ProjedataEnvelope } from './types.ts';

/**
 * Monta o envelope completo para envio ao ERP.
 * 
 * @param grupoComando - Comando do ERP (ex: "IMP_ITEM_VERSAO_V3")
 * @param innerJson - Objeto com os dados do produto/versão (será serializado)
 * @returns ProjedataEnvelope pronto para envio
 */
export function buildEnvelope(
  grupoComando: string,
  innerJson: Record<string, unknown>,
): ProjedataEnvelope {
  // Serializa o JSON interno como string (aspas são escapadas automaticamente pelo JSON.stringify)
  const serializedInner = JSON.stringify(innerJson);

  return {
    tipoComando: 'ASDCOMANDO',
    grupoComando,
    '#out#p_retorno': 'T',
    json: serializedInner,
  };
}

/**
 * Serializa o envelope completo em uma ÚNICA LINHA para envio HTTP.
 * 
 * Garante que:
 * 1. O JSON interno está serializado como string dentro de "json"
 * 2. O resultado final é uma única linha (sem quebras)
 * 3. As aspas do JSON interno estão corretamente escapadas
 * 
 * @param envelope - Envelope já montado com buildEnvelope
 * @returns String JSON em linha única pronta para body do fetch
 */
export function serializeEnvelope(envelope: ProjedataEnvelope): string {
  // JSON.stringify sem indentação = linha única garantida
  return JSON.stringify(envelope);
}

/**
 * Atalho: monta e serializa em um único passo.
 */
export function buildAndSerialize(
  grupoComando: string,
  innerJson: Record<string, unknown>,
): string {
  const envelope = buildEnvelope(grupoComando, innerJson);
  return serializeEnvelope(envelope);
}
