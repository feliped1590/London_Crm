/**
 * Dimensões efetivas — base + sanfona (quando ativa).
 *
 * Por que existe:
 * - `products.width/length/thickness` permanecem PUROS no banco (imutáveis,
 *   usados como referência estrutural).
 * - A sanfona é uma dimensão real do produto acabado e deve entrar em:
 *     1) cálculos comerciais (fator milheiro)
 *     2) valores numéricos enviados aos atributos da ficha no ERP
 * - A string visual `erp_versao` continua sendo `LxC+Sx0,EEE` (composição
 *   literal), separada deste cálculo.
 *
 * Regras:
 * - Sanfona `Lateral` soma na LARGURA.
 * - Sanfona `Fundo`   soma no COMPRIMENTO.
 * - Sanfonas nunca são simultâneas (uma OU outra).
 * - Espessura nunca recebe sanfona.
 */

export interface EffectiveDimensionsInput {
  width?: number | null;
  length?: number | null;
  thickness?: number | null;
  ficha_tecnica?: any | null;
}

export interface EffectiveDimensions {
  width: number;
  length: number;
  thickness: number;
}

export function getEffectiveDimensions(p: EffectiveDimensionsInput | null | undefined): EffectiveDimensions {
  const width = Number(p?.width) || 0;
  const length = Number(p?.length) || 0;
  const thickness = Number(p?.thickness) || 0;

  const sanfona = p?.ficha_tecnica?.sanfona;
  const ativa = !!sanfona?.ativa;
  const valor = Number(sanfona?.valor);
  const local = sanfona?.local;

  if (!ativa || !Number.isFinite(valor) || valor <= 0) {
    return { width, length, thickness };
  }

  return {
    width: width + (local === 'Lateral' ? valor : 0),
    length: length + (local === 'Fundo' ? valor : 0),
    thickness,
  };
}
