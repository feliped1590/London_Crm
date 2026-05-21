import { calcularFatorMilheiro } from '@/types/products';
import { getEffectiveDimensions } from '@/utils/products/effectiveDimensions';

/**
 * Dados mínimos do produto necessários para o cálculo de preço por fator KG.
 *
 * `ficha_tecnica` é opcional: quando presente, a sanfona (Lateral/Fundo) é
 * somada às dimensões antes do cálculo do milheiro — espelhando o
 * comportamento do ERP, que considera as dimensões EFETIVAS do produto
 * acabado.
 *
 * Snapshots de itens (pedidos/propostas) já gravam as dimensões EFETIVAS
 * no momento da inclusão, então podem chamar sem `ficha_tecnica`.
 */
interface PackagingPricingInput {
  unit_measure?: string | null;
  unit_price?: number | null;
  fator_kg?: number | null;
  width?: number | null;
  length?: number | null;
  thickness?: number | null;
  ficha_tecnica?: any | null;
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
  const unit = (product.unit_measure || '').toString().trim().toUpperCase();

  // Venda por KG: preço = fator KG direto
  if (unit === 'KG') {
    return fatorKg || product.unit_price || 0;
  }

  // Venda por MILHEIRO: usa dimensões EFETIVAS (com sanfona, quando ficha_tecnica for fornecida)
  if (unit === 'MIL') {
    const { width, length, thickness } = getEffectiveDimensions(product);

    // Fallback de segurança: se faltar qualquer dimensão ou fator, usar unit_price
    if (!width || !length || !thickness || !fatorKg) {
      return product.unit_price || 0;
    }

    return calcularFatorMilheiro(fatorKg, width, length, thickness);
  }

  // Qualquer outra unidade: preço padrão
  return product.unit_price || 0;
}
