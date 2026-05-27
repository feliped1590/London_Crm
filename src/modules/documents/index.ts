/**
 * Documents Module — public API.
 *
 * Compartilhado entre Propostas e Pedidos.
 * Outros consumidores devem importar SOMENTE deste barrel:
 *   import { usePriceValidation } from '@/modules/documents';
 */
export { useDocumentItems } from '@/hooks/useDocumentItems';
export { usePriceValidation } from './usePriceValidation';
export type { PendingPriceChange } from './usePriceValidation';
