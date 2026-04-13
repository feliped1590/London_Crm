import type { IpiMode, PriceSource } from './products';

/**
 * Lightweight product shape used in document dialogs (orders / proposals).
 * Matches the SELECT columns used by product search queries.
 */
export interface ProductLookup {
  id: string;
  sku: string;
  name: string;
  tipo_id?: string | null;
  unit_price?: number | null;
  width?: number | null;
  length?: number | null;
  thickness?: number | null;
  aliquota_ipi?: number | null;
  fator_kg?: number | null;
}

/**
 * Draft item used while editing an order before persistence.
 */
export interface OrderItemDraft {
  id?: string;
  product_id: string;
  product_code?: string;
  description: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  discount_percent: number;
  ipi_rate: number;
  commission_pct: number;
  width?: number;
  length?: number;
  thickness?: number;
  calculated_price_source?: PriceSource;
}

/**
 * Generic document item with the minimum fields needed by shared
 * components (DocumentTotals, usePriceValidation, etc.).
 */
export interface DocumentItemBase {
  product_id?: string;
  description?: string;
  quantity?: number;
  unit_price?: number;
  subtotal?: number;
  discount_percent?: number;
  ipi_rate?: number;
  width?: number;
  length?: number;
  thickness?: number;
  calculated_price_source?: PriceSource;
}
