/**
 * Resolve a alíquota de IPI efetiva de um produto.
 *
 * Prioridade:
 *  1. `product.aliquota_ipi` (override do cadastro do produto, se preenchido).
 *  2. `product.ncm.aliquota_ipi_oficial` (TIPI vinculada ao NCM do produto).
 *  3. `0` (sem IPI).
 *
 * Aceita tanto a relação embutida via PostgREST (`ncm: { aliquota_ipi_oficial }`)
 * quanto o campo plano `ncm_aliquota_ipi_oficial` para flexibilidade.
 */
export function getEffectiveProductIpiRate(product: any): number {
  if (!product) return 0;

  const own = product.aliquota_ipi;
  if (own !== null && own !== undefined && Number(own) > 0) {
    return Number(own);
  }

  const ncmRate =
    product?.ncm?.aliquota_ipi_oficial ??
    product?.ncm_aliquota_ipi_oficial ??
    null;

  if (ncmRate !== null && ncmRate !== undefined) {
    return Number(ncmRate) || 0;
  }

  return 0;
}
