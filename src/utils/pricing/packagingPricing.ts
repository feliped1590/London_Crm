import { calcularFatorMilheiro } from '@/types/products';

/**
 * Dados mínimos do produto necessários para o cálculo de preço por fator KG.
 */
interface PackagingPricingInput {
  unit_measure?: string | null;
  unit_price?: number | null;
  fator_kg?: number | null;
  width?: number | null;
  length?: number | null;
  thickness?: number | null;
}

/**
 * Calcula o preço base de um produto de embalagem usando fator KG.
 * Aplicado apenas quando NÃO existe tabela de preços aplicável.
 *
 * Hierarquia: Tabela de preço → Fator KG → unit_price padrão
 */
export function calculatePackagingPrice(product: PackagingPricingInput): number {
  if (!product) return 0;

  const fatorKg = product.fator_kg || 0;

  // Venda por KG: preço = fator KG direto
  if (product.unit_measure === 'KG') {
    return fatorKg || product.unit_price || 0;
  }

  // Venda por MILHEIRO: preço = (fatorKg × largura × comprimento × espessura) / 1.000.000
  if (product.unit_measure === 'MIL') {
    const width = product.width || 0;
    const length = product.length || 0;
    const thickness = product.thickness || 0;

    // Fallback de segurança: se faltar qualquer dimensão ou fator, usar unit_price
    if (!width || !length || !thickness || !fatorKg) {
      return product.unit_price || 0;
    }

    // Reutiliza a função existente em types/products.ts
    return calcularFatorMilheiro(fatorKg, width, length, thickness);
  }

  // Qualquer outra unidade: preço padrão
  return product.unit_price || 0;
}
