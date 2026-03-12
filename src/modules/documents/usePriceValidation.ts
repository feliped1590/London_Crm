import { useState, useRef, useCallback } from 'react';
import { usePricingTables } from '@/hooks/usePricingTables';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import { toast } from 'sonner';
import type { DocumentItemBase, ProductLookup } from '@/types/documents';

export interface PendingPriceChange {
  index: number;
  field?: string;
  value: number;
  itemDescription: string;
  currentPrice: number;
  proposedPrice: number;
  pricingTableName: string;
}

interface UsePriceValidationOptions<TItem extends DocumentItemBase, TProduct extends ProductLookup> {
  items: TItem[];
  setItems: React.Dispatch<React.SetStateAction<TItem[]>>;
  products: TProduct[] | undefined;
  companyId: string | null;
  contactId: string | null;
  calculateItemSubtotal: (item: TItem) => number;
  isEditMode: boolean;
  onSubmitCreate: () => void;
  onSubmitUpdate: () => void;
}

export function usePriceValidation<
  TItem extends DocumentItemBase = DocumentItemBase,
  TProduct extends ProductLookup = ProductLookup,
>(options: UsePriceValidationOptions<TItem, TProduct>) {
  const {
    items, setItems, products, companyId, contactId,
    calculateItemSubtotal, isEditMode, onSubmitCreate, onSubmitUpdate,
  } = options;

  const { isAdmin } = useModulePermissions();
  const { getApplicableTable, calculatePrice, validatePriceAgainstTable } = usePricingTables();

  const [showPriceOverrideModal, setShowPriceOverrideModal] = useState(false);
  const [priceChangeConfirmed, setPriceChangeConfirmed] = useState(false);
  const priceChangeConfirmedRef = useRef(false);
  const [pendingSubmit, setPendingSubmit] = useState(false);
  const [pendingPriceChange, setPendingPriceChange] = useState<PendingPriceChange | null>(null);

  const getEntityParams = useCallback((): { entityType: 'company' | 'contact' | null; entityId: string | null } => ({
    entityType: companyId ? 'company' : contactId ? 'contact' : null,
    entityId: companyId || contactId || null,
  }), [companyId, contactId]);

  const findNextOutOfRangeItem = useCallback((startIndex: number = 0): PendingPriceChange | null => {
    const { entityType, entityId } = getEntityParams();
    for (let i = startIndex; i < items.length; i++) {
      const item = items[i];
      if (!item.product_id) continue;
      const product = products?.find(p => p.id === item.product_id);
      if (!product) continue;
      const validation = validatePriceAgainstTable(
        entityType, entityId, item.product_id,
        product.tipo_id || null, item.quantity || 1,
        product.unit_price || 0, item.unit_price || 0,
      );
      if (validation && !validation.isValid) {
        return {
          index: i,
          value: item.unit_price || 0,
          itemDescription: item.description || 'Item',
          currentPrice: validation.expectedPrice,
          proposedPrice: item.unit_price || 0,
          pricingTableName: validation.tableName || 'Tabela de Preços',
        };
      }
    }
    return null;
  }, [items, products, getEntityParams, validatePriceAgainstTable]);

  const handlePriceBlur = useCallback((index: number, field?: string) => {
    const item = items[index];
    if (!item.product_id) return;
    const product = products?.find(p => p.id === item.product_id);
    if (!product) return;
    const { entityType, entityId } = getEntityParams();
    const validation = validatePriceAgainstTable(
      entityType, entityId, product.id,
      product.tipo_id || null, item.quantity || 1,
      product.unit_price || 0, item.unit_price || 0,
    );
    if (!validation || validation.isValid) return;

    if (!isAdmin) {
      toast.error('Preço revertido. Apenas administradores podem alterar preços fora da tabela.');
      const updatedItems = [...items];
      (updatedItems[index] as DocumentItemBase).unit_price = validation.expectedPrice;
      (updatedItems[index] as DocumentItemBase).subtotal = calculateItemSubtotal({ ...updatedItems[index], unit_price: validation.expectedPrice } as TItem);
      setItems(updatedItems);
      return;
    }

    priceChangeConfirmedRef.current = false;
    setPriceChangeConfirmed(false);
    setPendingPriceChange({
      index,
      field,
      value: item.unit_price || 0,
      itemDescription: item.description || 'Item',
      currentPrice: validation.expectedPrice,
      proposedPrice: item.unit_price || 0,
      pricingTableName: validation.tableName || 'Tabela de Preços',
    });
    setShowPriceOverrideModal(true);
  }, [items, products, getEntityParams, validatePriceAgainstTable, isAdmin, calculateItemSubtotal, setItems]);

  const handlePriceOverrideConfirm = useCallback(async (justification: string) => {
    if (!pendingPriceChange) return;
    priceChangeConfirmedRef.current = true;
    setPriceChangeConfirmed(true);
    setPendingPriceChange(null);

    if (pendingSubmit) {
      const nextOutOfRange = findNextOutOfRangeItem(pendingPriceChange.index + 1);
      if (nextOutOfRange) {
        priceChangeConfirmedRef.current = false;
        setPendingPriceChange(nextOutOfRange);
        setShowPriceOverrideModal(true);
        setPriceChangeConfirmed(false);
      } else {
        setPendingSubmit(false);
        if (isEditMode) onSubmitUpdate();
        else onSubmitCreate();
      }
    }
    return justification;
  }, [pendingPriceChange, pendingSubmit, findNextOutOfRangeItem, isEditMode, onSubmitCreate, onSubmitUpdate]);

  const handlePriceOverrideCancel = useCallback(() => {
    if (!pendingPriceChange) return;
    const { index, currentPrice } = pendingPriceChange;
    const updatedItems = [...items];
    (updatedItems[index] as DocumentItemBase).unit_price = currentPrice;
    (updatedItems[index] as DocumentItemBase).subtotal = calculateItemSubtotal({ ...updatedItems[index], unit_price: currentPrice } as TItem);
    setItems(updatedItems);

    if (pendingSubmit) {
      setPendingSubmit(false);
      toast.info('Operação cancelada - preço fora do range não autorizado');
    } else {
      toast.info('Preço revertido para o valor da tabela');
    }
    setPendingPriceChange(null);
    setShowPriceOverrideModal(false);
  }, [pendingPriceChange, items, calculateItemSubtotal, setItems, pendingSubmit]);

  /** Pre-submit validation: checks all items against pricing tables */
  const validateBeforeSubmit = useCallback((): boolean => {
    if (isAdmin) {
      const outOfRange = findNextOutOfRangeItem(0);
      if (outOfRange) {
        priceChangeConfirmedRef.current = false;
        setPriceChangeConfirmed(false);
        setPendingPriceChange(outOfRange);
        setPendingSubmit(true);
        setShowPriceOverrideModal(true);
        return false;
      }
    }
    return true;
  }, [isAdmin, findNextOutOfRangeItem]);

  const getPriceOverrideModalProps = useCallback(() => ({
    open: showPriceOverrideModal,
    onOpenChange: (open: boolean) => {
      if (!open) {
        if (!priceChangeConfirmedRef.current) handlePriceOverrideCancel();
        priceChangeConfirmedRef.current = false;
        setPriceChangeConfirmed(false);
      }
      setShowPriceOverrideModal(open);
    },
    onConfirm: handlePriceOverrideConfirm,
    itemDescription: pendingPriceChange?.itemDescription || '',
    currentPrice: pendingPriceChange?.currentPrice || 0,
    proposedPrice: pendingPriceChange?.proposedPrice || 0,
    pricingTableName: pendingPriceChange?.pricingTableName || '',
  }), [showPriceOverrideModal, pendingPriceChange, handlePriceOverrideConfirm, handlePriceOverrideCancel]);

  /** Recalculate price when quantity changes */
  const recalcPriceForQuantity = useCallback((productId: string, quantity: number, basePrice: number) => {
    const { entityType, entityId } = getEntityParams();
    const applicableTable = getApplicableTable(entityType, entityId, productId);
    if (!applicableTable) return null;
    const product = products?.find(p => p.id === productId);
    if (!product) return null;
    const { finalPrice, rule } = calculatePrice(
      applicableTable.id, product.id, product.tipo_id, quantity, basePrice,
    );
    return { finalPrice, discountPercent: rule?.discount_percent || 0 };
  }, [getEntityParams, getApplicableTable, calculatePrice, products]);

  return {
    handlePriceBlur,
    handlePriceOverrideConfirm,
    handlePriceOverrideCancel,
    validateBeforeSubmit,
    getPriceOverrideModalProps,
    pendingPriceChange,
    showPriceOverrideModal,
    recalcPriceForQuantity,
  };
}
