/**
 * Document Engine — composes useDocumentItems with price validation logic
 * shared between ProposalDialog and OrderDialog.
 */
export { useDocumentItems } from '@/hooks/useDocumentItems';
export { usePriceValidation } from './usePriceValidation';
export type { PendingPriceChange } from './usePriceValidation';
