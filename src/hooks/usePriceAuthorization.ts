import { useRef, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import { usePricingTables } from '@/hooks/usePricingTables';

export interface PriceChangeInfo {
  index: number;
  field?: 'unit_price' | 'discount_percent';
  value: number;
  itemDescription: string;
  currentPrice: number;
  proposedPrice: number;
  pricingTableName: string;
}

export interface ItemWithPricing {
  product_id?: string | null;
  description?: string;
  quantity?: number;
  unit_price?: number;
  discount_percent?: number;
  subtotal?: number;
}

interface Product {
  id: string;
  category?: string | null;
  unit_price?: number | null;
}

interface UsePriceAuthorizationOptions {
  entityType: 'company' | 'contact' | null;
  entityId: string | null;
  products: Product[] | undefined;
  dealId?: string | null;
  onItemRevert: (index: number, expectedPrice: number) => void;
}

export function usePriceAuthorization({
  entityType,
  entityId,
  products,
  dealId,
  onItemRevert,
}: UsePriceAuthorizationOptions) {
  const { user } = useAuth();
  const { isAdmin } = useModulePermissions();
  const { validatePriceAgainstTable } = usePricingTables();

  const [showPriceOverrideModal, setShowPriceOverrideModal] = useState(false);
  const [pendingPriceChange, setPendingPriceChange] = useState<PriceChangeInfo | null>(null);
  const [pendingSubmit, setPendingSubmit] = useState(false);
  const priceChangeConfirmedRef = useRef(false);

  /**
   * Validates a single item's price against the pricing table.
   * Returns validation result or null if no table applies.
   */
  const validateItemPrice = useCallback(
    (item: ItemWithPricing, index: number): PriceChangeInfo | null => {
      if (!item.product_id) return null;

      const product = products?.find((p) => p.id === item.product_id);
      if (!product) return null;

      const validation = validatePriceAgainstTable(
        entityType,
        entityId,
        product.id,
        product.category || null,
        item.quantity || 1,
        product.unit_price || 0,
        item.unit_price || 0
      );

      if (!validation || validation.isValid) return null;

      return {
        index,
        field: 'unit_price',
        value: item.unit_price || 0,
        itemDescription: item.description || 'Item',
        currentPrice: validation.expectedPrice,
        proposedPrice: item.unit_price || 0,
        pricingTableName: validation.tableName || 'Tabela de Preços',
      };
    },
    [entityType, entityId, products, validatePriceAgainstTable]
  );

  /**
   * Finds the next item that's out of pricing table range.
   */
  const findNextOutOfRangeItem = useCallback(
    (items: ItemWithPricing[], startIndex: number = 0): PriceChangeInfo | null => {
      for (let i = startIndex; i < items.length; i++) {
        const result = validateItemPrice(items[i], i);
        if (result) return result;
      }
      return null;
    },
    [validateItemPrice]
  );

  /**
   * Handles the blur event on a price field.
   * Non-admins: reverts to table price.
   * Admins: opens authorization modal.
   */
  const handlePriceBlur = useCallback(
    (items: ItemWithPricing[], index: number) => {
      const validationResult = validateItemPrice(items[index], index);
      
      if (!validationResult) return;

      if (!isAdmin) {
        toast.error('Preço revertido. Apenas administradores podem alterar preços fora da tabela.');
        onItemRevert(index, validationResult.currentPrice);
        return;
      }

      // Admin: show authorization modal
      priceChangeConfirmedRef.current = false;
      setPendingPriceChange(validationResult);
      setShowPriceOverrideModal(true);
    },
    [isAdmin, validateItemPrice, onItemRevert]
  );

  /**
   * Handles confirmation of price override from admin.
   * Records the override in audit log if dealId is provided.
   */
  const handlePriceOverrideConfirm = useCallback(
    async (
      justification: string,
      onNextItem: (nextItem: PriceChangeInfo) => void,
      onAllItemsAuthorized: () => void
    ) => {
      if (!pendingPriceChange) return;

      const { currentPrice, proposedPrice, itemDescription, index } = pendingPriceChange;

      // Record the override in deal_audit_log if dealId is present
      if (dealId) {
        try {
          await supabase.from('deal_audit_log').insert({
            deal_id: dealId,
            field_name: 'price_override',
            field_label: 'Override de Preço',
            old_value: `${itemDescription}: Preço Tabela = R$ ${currentPrice.toFixed(2)}`,
            new_value: `Novo Preço = R$ ${proposedPrice.toFixed(2)} | Justificativa: ${justification}`,
            changed_by: user?.id,
          });
          toast.success('Alteração de preço autorizada e registrada');
        } catch (error) {
          console.error('Error logging price override:', error);
          toast.error('Erro ao registrar alteração');
        }
      } else {
        toast.success(`Alteração de preço autorizada: ${justification}`);
      }

      priceChangeConfirmedRef.current = true;
      setPendingPriceChange(null);

      if (pendingSubmit) {
        // Will be handled by parent component's next step
        onNextItem({ ...pendingPriceChange, index: index + 1 } as PriceChangeInfo);
      }
    },
    [pendingPriceChange, pendingSubmit, dealId, user?.id]
  );

  /**
   * Handles cancellation of price override - reverts to table price.
   */
  const handlePriceOverrideCancel = useCallback(() => {
    if (!pendingPriceChange) return;

    const { index, currentPrice } = pendingPriceChange;

    onItemRevert(index, currentPrice);

    if (pendingSubmit) {
      setPendingSubmit(false);
      toast.info('Operação cancelada - preço fora do range não autorizado');
    } else {
      toast.info('Preço revertido para o valor da tabela');
    }

    setPendingPriceChange(null);
    setShowPriceOverrideModal(false);
  }, [pendingPriceChange, pendingSubmit, onItemRevert]);

  /**
   * Validates all items before submit.
   * Returns true if can proceed, false if modal was opened.
   */
  const validateBeforeSubmit = useCallback(
    (items: ItemWithPricing[]): boolean => {
      if (!isAdmin) return true;

      const outOfRange = findNextOutOfRangeItem(items, 0);

      if (outOfRange) {
        priceChangeConfirmedRef.current = false;
        setPendingPriceChange(outOfRange);
        setPendingSubmit(true);
        setShowPriceOverrideModal(true);
        return false;
      }

      return true;
    },
    [isAdmin, findNextOutOfRangeItem]
  );

  /**
   * Resets state when modal closes (if change was not confirmed).
   */
  const handleModalOpenChange = useCallback(
    (open: boolean) => {
      if (!open && !priceChangeConfirmedRef.current) {
        handlePriceOverrideCancel();
      }
      if (!open) {
        priceChangeConfirmedRef.current = false;
      }
      setShowPriceOverrideModal(open);
    },
    [handlePriceOverrideCancel]
  );

  return {
    // State
    showPriceOverrideModal,
    pendingPriceChange,
    pendingSubmit,
    isAdmin,

    // Actions
    handlePriceBlur,
    handlePriceOverrideConfirm,
    handlePriceOverrideCancel,
    validateBeforeSubmit,
    handleModalOpenChange,
    findNextOutOfRangeItem,
    setPendingPriceChange,
    setPendingSubmit,
    setShowPriceOverrideModal,
    priceChangeConfirmedRef,
  };
}
