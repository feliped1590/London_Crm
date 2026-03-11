import { IpiMode } from '@/types/products';
import { calculateIpiValue } from './ipiCalculations';

/**
 * Parâmetros genéricos para cálculo de totais de um documento (pedido ou proposta).
 * @param items - lista de itens do documento
 * @param ipiMode - modo de IPI do documento
 * @param getSubtotal - função que extrai o subtotal de cada item
 * @param getIpiRate - função que extrai a alíquota de IPI de cada item
 */
interface TotalsInput<T> {
  items: T[];
  ipiMode: IpiMode;
  getSubtotal: (item: T) => number;
  getIpiRate: (item: T) => number;
}

/**
 * Soma dos subtotais de todos os itens (sem IPI).
 */
export function calculateSubtotalProducts<T>(input: TotalsInput<T>): number {
  return input.items.reduce((sum, item) => sum + input.getSubtotal(item), 0);
}

/**
 * Soma do IPI de todos os itens.
 */
export function calculateTotalIpi<T>(input: TotalsInput<T>): number {
  let totalIpi = 0;
  input.items.forEach(item => {
    const ipiRate = input.ipiMode === 'isento' ? 0 : input.getIpiRate(item);
    totalIpi += calculateIpiValue(input.getSubtotal(item), ipiRate, input.ipiMode);
  });
  return totalIpi;
}

/**
 * Valor total do documento = subtotal + IPI (quando destacar).
 */
export function calculateTotal<T>(input: TotalsInput<T>): number {
  const subtotal = calculateSubtotalProducts(input);
  const totalIpi = calculateTotalIpi(input);
  return input.ipiMode === 'destacar' ? subtotal + totalIpi : subtotal;
}
