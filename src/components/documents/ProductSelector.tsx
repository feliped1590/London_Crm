import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePricingTables } from '@/hooks/usePricingTables';
import { useCompanyFiscal } from '@/hooks/useCompanyFiscal';
import { calculatePackagingPrice } from '@/utils/pricing/packagingPricing';
import { IpiMode } from '@/types/products';

interface UseProductAddOptions {
  companyId: string | null;
  contactId: string | null;
}

/**
 * Shared logic for adding a product to a document (order or proposal).
 * Resolves pricing table, packaging price, and IPI rate.
 */
export function useProductAdd({ companyId, contactId }: UseProductAddOptions) {
  const { getApplicableTable, calculatePrice, getTableForEntity, validatePriceAgainstTable, pricingTables } = usePricingTables();
  const { companyFiscalData } = useCompanyFiscal(companyId || undefined);

  const linkedPricingTable = companyId
    ? getTableForEntity('company', companyId)
    : contactId
      ? getTableForEntity('contact', contactId)
      : null;

  const hasPricingTable = linkedPricingTable !== null;

  /** Resolve unit price, discount, priceSource, and IPI rate for a product */
  const resolveProductPricing = useCallback((product: any, ipiMode: IpiMode) => {
    let unitPrice = product.unit_price || 0;
    let discountPercent = 0;
    let priceSource: 'TABLE' | 'FACTOR_KG' | 'MANUAL' = 'MANUAL';

    const applicableTable = getApplicableTable(
      companyId ? 'company' : contactId ? 'contact' : null,
      companyId || contactId || null,
      product.id,
    );

    if (applicableTable) {
      const { finalPrice, rule } = calculatePrice(
        applicableTable.id, product.id, product.tipo_id, 1, product.unit_price || 0,
      );
      unitPrice = finalPrice;
      priceSource = 'TABLE';
      if (rule?.discount_percent) discountPercent = rule.discount_percent;
    } else {
      const packagingPrice = calculatePackagingPrice(product);
      if (packagingPrice !== (product.unit_price || 0) && product.fator_kg) {
        priceSource = 'FACTOR_KG';
      }
      unitPrice = packagingPrice;
    }

    const isContribuinteIpi = companyId && companyFiscalData
      ? companyFiscalData.contribuinte_ipi
      : true;
    const ipiRate = (ipiMode === 'isento' || !isContribuinteIpi)
      ? 0
      : (product.aliquota_ipi || 0);

    return { unitPrice, discountPercent, priceSource, ipiRate };
  }, [companyId, contactId, companyFiscalData, getApplicableTable, calculatePrice]);

  /** Auto-fill carrier, freight, and IPI mode from company defaults */
  const autoFillFromCompany = useCallback(async (compId: string) => {
    if (!compId) return null;
    const { data } = await supabase
      .from('companies')
      .select('default_carrier_id, default_freight_type, contribuinte_ipi')
      .eq('id', compId)
      .maybeSingle();
    return data;
  }, []);

  return {
    resolveProductPricing,
    autoFillFromCompany,
    linkedPricingTable,
    hasPricingTable,
    companyFiscalData,
    validatePriceAgainstTable,
    getApplicableTable,
    calculatePrice,
    pricingTables,
  };
}
