import { IpiMode } from '@/types/products';

/**
 * Calcula o valor de IPI de um item com base no subtotal, alíquota e modo.
 * - isento: retorna 0
 * - destacar: IPI = subtotal × (alíquota / 100)
 * - incluso: IPI = subtotal × (alíquota / (100 + alíquota))
 */
export function calculateIpiValue(subtotalItem: number, ipiRate: number, mode: IpiMode): number {
  if (mode === 'isento' || ipiRate <= 0) return 0;
  if (mode === 'destacar') return subtotalItem * (ipiRate / 100);
  if (mode === 'incluso') return subtotalItem * (ipiRate / (100 + ipiRate));
  return 0;
}

/**
 * Calcula o total de um item considerando o IPI.
 * - destacar: total = subtotal + IPI
 * - incluso / isento: total = subtotal (IPI já está embutido ou não existe)
 */
export function calculateItemTotal(subtotalItem: number, ipiValue: number, mode: IpiMode): number {
  if (mode === 'destacar') return subtotalItem + ipiValue;
  return subtotalItem;
}
