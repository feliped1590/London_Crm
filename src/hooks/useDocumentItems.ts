import { useState, useCallback, useMemo } from 'react';
import { IpiMode } from '@/types/products';
import { calculateIpiValue, calculateItemTotal } from '@/utils/pricing/ipiCalculations';
import {
  calculateSubtotalProducts,
  calculateTotalIpi,
  calculateTotal,
} from '@/utils/pricing/totalsCalculations';

/**
 * Configuração do hook useDocumentItems.
 * @template T - Tipo do item (OrderItemDraft ou Partial<ProposalItem>)
 */
interface UseDocumentItemsOptions<T> {
  /** Modo de IPI do documento (pode mudar ao longo do tempo) */
  ipiMode: IpiMode;
  /** Função que calcula o subtotal de um item individual */
  calculateItemSubtotal: (item: T) => number;
  /** Função que extrai a alíquota de IPI de um item */
  getIpiRate?: (item: T) => number;
}

/**
 * Hook compartilhado para gerenciamento de itens de documentos (pedidos e propostas).
 *
 * Centraliza:
 * - Estado dos itens
 * - Adição / remoção / atualização genérica
 * - Cálculos de totais usando as funções centralizadas de pricing
 *
 * NÃO centraliza (permanece no componente):
 * - Lógica de seleção de produto e pricing table
 * - Validação de preço contra tabela (handlePriceBlur)
 * - Lógica de price override / autorização
 */
export function useDocumentItems<T extends Record<string, any>>(
  options: UseDocumentItemsOptions<T>,
) {
  const { ipiMode, calculateItemSubtotal, getIpiRate = (item: T) => item.ipi_rate || 0 } = options;

  const [items, setItems] = useState<T[]>([]);

  // ── Mutações de itens ──────────────────────────────────────────────

  /** Adiciona um item já construído ao final da lista */
  const addItem = useCallback((item: T) => {
    setItems(prev => [...prev, item]);
  }, []);

  /** Remove o item no índice informado */
  const removeItem = useCallback((index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  }, []);

  /**
   * Atualiza um campo de um item e recalcula o subtotal.
   * Para lógica extra (ex: recalcular preço via pricing table ao mudar quantidade),
   * use `setItems` diretamente ou passe um `transform` opcional.
   */
  const updateItem = useCallback(
    (
      index: number,
      field: string,
      value: any,
      /** Transformação adicional após setar o campo (ex: recalcular preço) */
      transform?: (item: T) => T,
    ) => {
      setItems(prev => {
        const updated = [...prev];
        updated[index] = { ...updated[index], [field]: value };

        // Aplica transformação customizada (pricing recalc, etc.)
        if (transform) {
          updated[index] = transform(updated[index]);
        }

        // Recalcula subtotal
        updated[index] = {
          ...updated[index],
          subtotal: calculateItemSubtotal(updated[index]),
        };

        return updated;
      });
    },
    [calculateItemSubtotal],
  );

  // ── Totais (delegados às funções centralizadas) ────────────────────

  const totalsInput = useMemo(
    () => ({
      items,
      ipiMode,
      getSubtotal: calculateItemSubtotal,
      getIpiRate,
    }),
    [items, ipiMode, calculateItemSubtotal, getIpiRate],
  );

  const subtotalProducts = useMemo(
    () => calculateSubtotalProducts(totalsInput),
    [totalsInput],
  );

  const totalIpi = useMemo(
    () => calculateTotalIpi(totalsInput),
    [totalsInput],
  );

  const total = useMemo(
    () => calculateTotal(totalsInput),
    [totalsInput],
  );

  // ── Helpers de IPI por item (para uso no JSX) ──────────────────────

  /** Calcula o IPI de um item individual */
  const getItemIpiValue = useCallback(
    (item: T) => {
      const rate = ipiMode === 'isento' ? 0 : getIpiRate(item);
      return calculateIpiValue(calculateItemSubtotal(item), rate, ipiMode);
    },
    [ipiMode, calculateItemSubtotal, getIpiRate],
  );

  /** Calcula o total de um item individual (subtotal + IPI quando destacar) */
  const getItemTotal = useCallback(
    (item: T) => {
      const ipiVal = getItemIpiValue(item);
      return calculateItemTotal(calculateItemSubtotal(item), ipiVal, ipiMode);
    },
    [ipiMode, calculateItemSubtotal, getItemIpiValue],
  );

  return {
    // Estado
    items,
    setItems,

    // Mutações
    addItem,
    removeItem,
    updateItem,

    // Totais
    subtotalProducts,
    totalIpi,
    total,

    // Helpers por item
    getItemIpiValue,
    getItemTotal,
  };
}
