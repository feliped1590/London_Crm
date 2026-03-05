import { useEffect, useRef, useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ShoppingCart, Plus, Trash2, CalendarIcon, DollarSign, Edit, Lock, CheckCircle2, History } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/formatters';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { usePricingTables } from '@/hooks/usePricingTables';
import { useLegalEntities } from '@/hooks/useLegalEntities';
import { useAuth } from '@/hooks/useAuth';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import { PriceOverrideModal } from '@/components/proposals/PriceOverrideModal';
import { Order, OrderItem, OrderStatus, IpiMode, ipiModeConfig, orderStatusConfig } from '@/types/products';
import { OrderApprovalActions } from './OrderApprovalActions';
import { OrderApprovalTimeline } from './OrderApprovalTimeline';
import { OrderHistoryTab } from './OrderHistoryTab';

interface OrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order?: Order | null; // If passed, it's edit mode; otherwise, create mode
  onSuccess?: () => void;
}

interface OrderItemDraft {
  id?: string; // For existing items
  product_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  discount_percent: number;
  ipi_rate: number;
  width?: number;
  length?: number;
  thickness?: number;
}

export function OrderDialog({ open, onOpenChange, order, onSuccess }: OrderDialogProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isAdmin } = useModulePermissions();
  const { getApplicableTable, calculatePrice, validatePriceAgainstTable, pricingTables } = usePricingTables();
  const { accessibleEntities, activeLegalEntityId, hasEntities: hasLegalEntities } = useLegalEntities();
  
  const isEditMode = !!order;
  
  // Check edit permission based on status and role
  const canEdit = useMemo(() => {
    if (!order) return true; // Creation always allowed
    if (order.status === 'pendente') return true; // Pending = everyone can edit
    return isAdmin; // Other statuses = admin only
  }, [order, isAdmin]);
  
  const [companyId, setCompanyId] = useState<string>('');
  const [contactId, setContactId] = useState<string>('');
  const [deliveryDate, setDeliveryDate] = useState<Date | undefined>();
  const [observations, setObservations] = useState('');
  const [items, setItems] = useState<OrderItemDraft[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [legalEntityId, setLegalEntityId] = useState<string>('');
  const [ipiMode, setIpiMode] = useState<IpiMode>('destacar');
  // Store original items for comparison (audit logging)
  const [originalItems, setOriginalItems] = useState<OrderItemDraft[]>([]);

  // Price override modal states
  const [showPriceOverrideModal, setShowPriceOverrideModal] = useState(false);
  const [priceChangeConfirmed, setPriceChangeConfirmed] = useState(false);
  // IMPORTANT: useRef to avoid race condition between onConfirm -> onOpenChange(false)
  // (state updates are async and could cause a false revert)
  const priceChangeConfirmedRef = useRef(false);
  const [pendingSubmit, setPendingSubmit] = useState(false);
  const [pendingPriceChange, setPendingPriceChange] = useState<{
    index: number;
    value: number;
    itemDescription: string;
    currentPrice: number;
    proposedPrice: number;
    pricingTableName: string;
  } | null>(null);

  // Fetch companies (limited to 500, but ensure order's company is always included)
  const { data: companiesRaw } = useQuery({
    queryKey: ['companies-list-orders'],
    queryFn: async (): Promise<Array<{ id: string; name: string }>> => {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name')
        .order('name')
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Ensure order's company is in the list
  const { data: orderCompanyData } = useQuery({
    queryKey: ['order-company', order?.company_id],
    queryFn: async () => {
      if (!order?.company_id) return null;
      const { data, error } = await supabase
        .from('companies')
        .select('id, name')
        .eq('id', order.company_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!order?.company_id,
  });

  const companies = useMemo(() => {
    const list = companiesRaw ?? [];
    if (orderCompanyData && !list.find(c => c.id === orderCompanyData.id)) {
      return [orderCompanyData, ...list];
    }
    return list;
  }, [companiesRaw, orderCompanyData]);

  // Fetch contacts (limited to 500, but ensure order's contact is always included)
  const { data: contactsRaw } = useQuery({
    queryKey: ['contacts-list-orders'],
    queryFn: async (): Promise<Array<{ id: string; first_name: string; last_name: string | null }>> => {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, first_name, last_name')
        .order('first_name')
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Ensure order's contact is in the list
  const { data: orderContactData } = useQuery({
    queryKey: ['order-contact', order?.contact_id],
    queryFn: async () => {
      if (!order?.contact_id) return null;
      const { data, error } = await supabase
        .from('contacts')
        .select('id, first_name, last_name')
        .eq('id', order.contact_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!order?.contact_id,
  });

  const contacts = useMemo(() => {
    const list = contactsRaw ?? [];
    if (orderContactData && !list.find(c => c.id === orderContactData.id)) {
      return [orderContactData, ...list];
    }
    return list;
  }, [contactsRaw, orderContactData]);

  // Fetch products
  type ProductItem = {
    id: string;
    sku: string;
    name: string;
    tipo_id: string | null;
    unit_price: number | null;
    width: number | null;
    length: number | null;
    thickness: number | null;
    aliquota_ipi: number | null;
  };
  
  const { data: products } = useQuery({
    queryKey: ['products-active'],
    queryFn: async (): Promise<ProductItem[]> => {
      const { data, error } = await supabase
        .from('products')
        .select('id, sku, name, tipo_id, unit_price, width, length, thickness, aliquota_ipi')
        .eq('active', true)
        .order('name');
      if (error) throw error;
      return (data ?? []) as unknown as ProductItem[];
    },
  });

  // Fetch order items when editing
  const { data: existingOrderItems } = useQuery({
    queryKey: ['order_items_for_edit', order?.id],
    queryFn: async (): Promise<OrderItemDraft[]> => {
      if (!order) return [];
      const { data, error } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', order.id)
        .order('sort_order');
      if (error) throw error;
      return (data ?? []).map((item: any) => ({
        id: item.id,
        product_id: item.product_id || '',
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.subtotal,
        discount_percent: item.discount_percent || 0,
        ipi_rate: item.ipi_rate || 0,
        width: item.width || undefined,
        length: item.length || undefined,
        thickness: item.thickness || undefined,
      }));
    },
    enabled: !!order?.id && open,
  });

  // Check linked pricing table
  const linkedPricingTable = companyId
    ? pricingTables?.find(t => t.id === getApplicableTable('company', companyId, null)?.id)
    : contactId
      ? pricingTables?.find(t => t.id === getApplicableTable('contact', contactId, null)?.id)
      : null;

  const hasPricingTable = !!linkedPricingTable;

  // Initialize form when dialog opens in edit mode
  useEffect(() => {
    if (open && order) {
      setCompanyId(order.company_id || '');
      setContactId(order.contact_id || '');
      setDeliveryDate(order.delivery_date ? new Date(order.delivery_date) : undefined);
      setObservations(order.observations || '');
      setLegalEntityId((order as any).legal_entity_id || activeLegalEntityId || '');
      setIpiMode((order as any).ipi_mode || 'destacar');
    } else if (open && !order) {
      setLegalEntityId(activeLegalEntityId || '');
    }
  }, [open, order, activeLegalEntityId]);

  // Set items when existingOrderItems are loaded
  useEffect(() => {
    if (existingOrderItems && existingOrderItems.length > 0) {
      setItems(existingOrderItems);
      setOriginalItems(existingOrderItems);
    }
  }, [existingOrderItems]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setCompanyId('');
      setContactId('');
      setDeliveryDate(undefined);
      setObservations('');
      setItems([]);
      setOriginalItems([]);
      setSelectedProductId('');
      setLegalEntityId('');
      setPendingPriceChange(null);
      setShowPriceOverrideModal(false);
    }
  }, [open]);

  // IPI calculation helpers
  const calculateIpiValue = (subtotalItem: number, ipiRate: number, mode: IpiMode) => {
    if (mode === 'isento' || ipiRate <= 0) return 0;
    if (mode === 'destacar') return subtotalItem * (ipiRate / 100);
    if (mode === 'incluso') return subtotalItem * (ipiRate / (100 + ipiRate));
    return 0;
  };

  const calculateItemTotal = (subtotalItem: number, ipiValue: number, mode: IpiMode) => {
    if (mode === 'destacar') return subtotalItem + ipiValue;
    return subtotalItem;
  };

  // Calculate total
  const calculateTotal = () => {
    let subtotalProducts = 0;
    let totalIpi = 0;
    items.forEach(item => {
      const ipiRate = ipiMode === 'isento' ? 0 : (item.ipi_rate || 0);
      const ipiVal = calculateIpiValue(item.subtotal, ipiRate, ipiMode);
      subtotalProducts += item.subtotal;
      totalIpi += ipiVal;
    });
    return ipiMode === 'destacar' ? subtotalProducts + totalIpi : subtotalProducts;
  };

  const calculateSubtotalProducts = () => items.reduce((sum, item) => sum + item.subtotal, 0);

  const calculateTotalIpi = () => {
    let totalIpi = 0;
    items.forEach(item => {
      const ipiRate = ipiMode === 'isento' ? 0 : (item.ipi_rate || 0);
      totalIpi += calculateIpiValue(item.subtotal, ipiRate, ipiMode);
    });
    return totalIpi;
  };

  // Add product to items
  const addProductToItems = () => {
    if (!selectedProductId) return;
    
    const product = products?.find(p => p.id === selectedProductId);
    if (!product) return;

    // Use pricing hierarchy to get the applicable price
    const applicableTable = getApplicableTable(
      companyId ? 'company' : contactId ? 'contact' : null,
      companyId || contactId || null,
      product.id
    );

    let unitPrice = product.unit_price || 0;
    let discountPercent = 0;

    if (applicableTable) {
      const { finalPrice, rule } = calculatePrice(
        applicableTable.id,
        product.id,
        product.tipo_id,
        1,
        product.unit_price || 0
      );
      unitPrice = finalPrice;
      if (rule?.discount_percent) {
        discountPercent = rule.discount_percent;
      }
    }

    const newItem: OrderItemDraft = {
      product_id: product.id,
      description: product.name,
      quantity: 1,
      unit_price: unitPrice,
      subtotal: unitPrice,
      discount_percent: discountPercent,
      ipi_rate: (product as any).aliquota_ipi || 0,
      width: product.width || undefined,
      length: product.length || undefined,
      thickness: product.thickness || undefined,
    };

    setItems([...items, newItem]);
    setSelectedProductId('');
  };

  // Handle price blur validation
  const handlePriceBlur = (index: number) => {
    const item = items[index];
    if (!item.product_id) return;

    const product = products?.find(p => p.id === item.product_id);
    if (!product) return;

    // Validate against pricing table
    const validation = validatePriceAgainstTable(
      companyId ? 'company' : contactId ? 'contact' : null,
      companyId || contactId || null,
      product.id,
        product.tipo_id || null,
      item.quantity || 1,
      product.unit_price || 0,
      item.unit_price || 0
    );

    // If no pricing table applies, no validation needed
    if (!validation) return;

    // If price matches table, no action needed
    if (validation.isValid) return;

    // Price differs from table - check if user is admin
    if (!isAdmin) {
      // Non-admin: revert to table price
      toast.error('Preço revertido. Apenas administradores podem alterar preços fora da tabela.');
      const updatedItems = [...items];
      updatedItems[index].unit_price = validation.expectedPrice;
      updatedItems[index].subtotal = updatedItems[index].quantity * validation.expectedPrice;
      setItems(updatedItems);
      return;
    }

    // Admin: show authorization modal
    priceChangeConfirmedRef.current = false;
    setPriceChangeConfirmed(false);
    setPendingPriceChange({
      index,
      value: item.unit_price || 0,
      itemDescription: item.description || 'Item',
      currentPrice: validation.expectedPrice,
      proposedPrice: item.unit_price || 0,
      pricingTableName: validation.tableName || 'Tabela de Preços',
    });
    setShowPriceOverrideModal(true);
  };

  // Find the next item that's out of pricing table range (starting from a given index)
  const findNextOutOfRangeItem = (startIndex: number = 0): typeof pendingPriceChange => {
    for (let i = startIndex; i < items.length; i++) {
      const item = items[i];
      if (!item.product_id) continue;
      
      const product = products?.find(p => p.id === item.product_id);
      if (!product) continue;
      
      const validation = validatePriceAgainstTable(
        companyId ? 'company' : contactId ? 'contact' : null,
        companyId || contactId || null,
        item.product_id,
        product.tipo_id || null,
        item.quantity || 1,
        product.unit_price || 0,
        item.unit_price || 0
      );
      
      // If validation exists and price differs from expected
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
  };

  // Handle price override confirmation
  const handlePriceOverrideConfirm = async (justification: string) => {
    if (!pendingPriceChange) return;

    // Mark that the change was confirmed so we don't revert on close
    priceChangeConfirmedRef.current = true;
    setPriceChangeConfirmed(true);
    
    // Log the override
    toast.success(`Alteração de preço autorizada: ${justification}`);
    setPendingPriceChange(null);
    
    // If there was a pending submit, check for more items or execute submit
    if (pendingSubmit) {
      const nextOutOfRange = findNextOutOfRangeItem(pendingPriceChange.index + 1);
      
      if (nextOutOfRange) {
        // There are more items pending authorization
        priceChangeConfirmedRef.current = false;
        setPendingPriceChange(nextOutOfRange);
        setShowPriceOverrideModal(true);
        setPriceChangeConfirmed(false);
      } else {
        // All items authorized, execute submit
        setPendingSubmit(false);
        if (isEditMode) {
          updateOrderMutation.mutate();
        } else {
          createOrderMutation.mutate();
        }
      }
    }
  };

  // Handle price override cancellation - revert to table price
  const handlePriceOverrideCancel = () => {
    if (!pendingPriceChange) return;
    
    const { index, currentPrice } = pendingPriceChange;
    const updatedItems = [...items];
    updatedItems[index].unit_price = currentPrice;
    updatedItems[index].subtotal = updatedItems[index].quantity * currentPrice;
    setItems(updatedItems);
    
    // If there was a pending submit, cancel it
    if (pendingSubmit) {
      setPendingSubmit(false);
      toast.info('Operação cancelada - preço fora do range não autorizado');
    } else {
      toast.info('Preço revertido para o valor da tabela');
    }
    
    setPendingPriceChange(null);
    setShowPriceOverrideModal(false);
  };

  // Update item
  const updateItem = (index: number, field: keyof OrderItemDraft, value: any) => {
    const updatedItems = [...items];
    const item = updatedItems[index];
    
    if (field === 'quantity') {
      item.quantity = Number(value) || 1;
      
      // Recalculate price based on new quantity using pricing hierarchy
      const product = products?.find(p => p.id === item.product_id);
      if (product) {
        const applicableTable = getApplicableTable(
          companyId ? 'company' : contactId ? 'contact' : null,
          companyId || contactId || null,
          product.id
        );

        if (applicableTable) {
          const { finalPrice, rule } = calculatePrice(
            applicableTable.id,
            product.id,
            product.tipo_id,
            item.quantity,
            product.unit_price || 0
          );
          item.unit_price = finalPrice;
          if (rule?.discount_percent) {
            item.discount_percent = rule.discount_percent;
          }
        }
      }
      
      item.subtotal = item.quantity * item.unit_price;
    } else if (field === 'unit_price') {
      item.unit_price = Number(value) || 0;
      item.subtotal = item.quantity * item.unit_price;
    } else {
      (item as any)[field] = value;
    }
    
    setItems(updatedItems);
  };

  // Remove item
  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Log item changes for audit
  const logItemChanges = async (orderId: string) => {
    if (!isEditMode || order?.status === 'pendente') return; // No audit for pending orders
    
    const auditLogs: Array<{
      order_id: string;
      field_name: string;
      field_label: string;
      old_value: string | null;
      new_value: string | null;
      changed_by: string;
    }> = [];

    // Items removed
    for (const original of originalItems) {
      if (!items.find(n => n.id === original.id)) {
        auditLogs.push({
          order_id: orderId,
          field_name: 'item_removed',
          field_label: 'Item Removido',
          old_value: `${original.description} (Qtd: ${original.quantity}, Preço: R$ ${original.unit_price.toFixed(2)})`,
          new_value: null,
          changed_by: user?.id || '',
        });
      }
    }

    // Items added
    for (const newItem of items) {
      if (!newItem.id || !originalItems.find(o => o.id === newItem.id)) {
        auditLogs.push({
          order_id: orderId,
          field_name: 'item_added',
          field_label: 'Item Adicionado',
          old_value: null,
          new_value: `${newItem.description} (Qtd: ${newItem.quantity}, Preço: R$ ${newItem.unit_price.toFixed(2)})`,
          changed_by: user?.id || '',
        });
      }
    }

    // Items modified
    for (const newItem of items) {
      if (!newItem.id) continue;
      const original = originalItems.find(o => o.id === newItem.id);
      if (original && (original.quantity !== newItem.quantity || original.unit_price !== newItem.unit_price)) {
        auditLogs.push({
          order_id: orderId,
          field_name: 'item_modified',
          field_label: 'Item Alterado',
          old_value: `${original.description}: Qtd=${original.quantity}, Preço=R$ ${original.unit_price.toFixed(2)}`,
          new_value: `${newItem.description}: Qtd=${newItem.quantity}, Preço=R$ ${newItem.unit_price.toFixed(2)}`,
          changed_by: user?.id || '',
        });
      }
    }

    if (auditLogs.length > 0) {
      await supabase.from('order_audit_log').insert(auditLogs);
    }
  };

  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: async () => {
      if (items.length === 0) {
        throw new Error('Adicione pelo menos um item ao pedido');
      }
      if (!companyId && !contactId) {
        throw new Error('Selecione uma empresa ou contato');
      }

      // Create order - number is auto-generated by database trigger
      const { data: newOrder, error: orderError } = await supabase
        .from('orders')
        .insert({
          number: '',
          company_id: companyId || null,
          contact_id: contactId || null,
          delivery_date: deliveryDate?.toISOString().split('T')[0] || null,
          observations,
          total_value: calculateTotal(),
          status: 'pendente',
          created_by: user?.id,
          legal_entity_id: legalEntityId || null,
          ipi_mode: ipiMode,
          subtotal_products: calculateSubtotalProducts(),
          total_ipi: calculateTotalIpi(),
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = items.map((item, index) => {
        const ipiRate = ipiMode === 'isento' ? 0 : (item.ipi_rate || 0);
        const ipiVal = calculateIpiValue(item.subtotal, ipiRate, ipiMode);
        const totalItem = calculateItemTotal(item.subtotal, ipiVal, ipiMode);
        return {
          order_id: newOrder.id,
          product_id: item.product_id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          subtotal: item.subtotal,
          discount_percent: item.discount_percent,
          ipi_rate: ipiRate,
          ipi_value: ipiVal,
          subtotal_item: item.subtotal,
          total_item: totalItem,
          width: item.width,
          length: item.length,
          thickness: item.thickness,
          sort_order: index,
        };
      });

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // Register creation in audit log
      await supabase.from('order_audit_log').insert({
        order_id: newOrder.id,
        field_name: 'created',
        field_label: 'Pedido criado',
        old_value: null,
        new_value: `Pedido ${newOrder.number} criado manualmente`,
        changed_by: user?.id || null,
      });

      return newOrder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Pedido criado com sucesso!');
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: Error) => {
      // Check if it's a portfolio governance error (trigger block)
      const message = error?.message || '';
      if (message.includes('Este cliente pertence ao vendedor')) {
        toast.error(message, { duration: 6000 });
      } else {
        toast.error(message || 'Erro ao criar pedido');
      }
    },
  });

  // Update order mutation
  const updateOrderMutation = useMutation({
    mutationFn: async () => {
      if (!order) throw new Error('Pedido não encontrado');
      if (items.length === 0) {
        throw new Error('Adicione pelo menos um item ao pedido');
      }
      if (!companyId && !contactId) {
        throw new Error('Selecione uma empresa ou contato');
      }

      // Update order
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          company_id: companyId || null,
          contact_id: contactId || null,
          delivery_date: deliveryDate?.toISOString().split('T')[0] || null,
          observations,
          total_value: calculateTotal(),
          legal_entity_id: legalEntityId || null,
          ipi_mode: ipiMode,
          subtotal_products: calculateSubtotalProducts(),
          total_ipi: calculateTotalIpi(),
        })
        .eq('id', order.id);

      if (orderError) throw orderError;

      // Log item changes for audit (only for non-pending orders)
      await logItemChanges(order.id);

      // Delete existing items and insert new ones
      const { error: deleteError } = await supabase
        .from('order_items')
        .delete()
        .eq('order_id', order.id);

      if (deleteError) throw deleteError;

      // Insert new items
      const orderItems = items.map((item, index) => ({
        order_id: order.id,
        product_id: item.product_id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.subtotal,
        discount_percent: item.discount_percent,
        width: item.width,
        length: item.length,
        thickness: item.thickness,
        sort_order: index,
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      return order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order_items'] });
      queryClient.invalidateQueries({ queryKey: ['order_audit_log'] });
      toast.success('Pedido atualizado com sucesso!');
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: Error) => {
      // Check if it's a portfolio governance error (trigger block)
      const message = error?.message || '';
      if (message.includes('Este cliente pertence ao vendedor')) {
        toast.error(message, { duration: 6000 });
      } else {
        toast.error(message || 'Erro ao atualizar pedido');
      }
    },
  });

  const handleSubmit = () => {
    // For admins: validate if there are prices out of range before submitting
    if (isAdmin) {
      const outOfRange = findNextOutOfRangeItem(0);
      
      if (outOfRange) {
        // Open authorization modal for this item
        priceChangeConfirmedRef.current = false;
        setPriceChangeConfirmed(false);
        setPendingPriceChange(outOfRange);
        setPendingSubmit(true);
        setShowPriceOverrideModal(true);
        return; // Interrupt submit until authorization
      }
    }
    
    if (isEditMode) {
      updateOrderMutation.mutate();
    } else {
      createOrderMutation.mutate();
    }
  };

  const isPending = createOrderMutation.isPending || updateOrderMutation.isPending;

  // Render the order form (extracted for use in tabs)
  const renderOrderForm = () => (
    <>
      {/* Legal Entity (CNPJ Emissor) */}
      {hasLegalEntities && (
        <div className="space-y-2">
          <Label>CNPJ Emissor</Label>
          <Select
            value={legalEntityId}
            onValueChange={setLegalEntityId}
            disabled={!canEdit}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o CNPJ emissor" />
            </SelectTrigger>
            <SelectContent>
              {accessibleEntities.map((entity) => (
                <SelectItem key={entity.id} value={entity.id}>
                  {entity.name} — {entity.cnpj}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Client Selection */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Empresa</Label>
          <Select 
            value={companyId} 
            onValueChange={(val) => setCompanyId(val === '__none__' ? '' : val)}
            disabled={!canEdit}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma empresa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Nenhuma</SelectItem>
              {companies?.map((company) => (
                <SelectItem key={company.id} value={company.id}>
                  {company.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Contato</Label>
          <Select 
            value={contactId} 
            onValueChange={(val) => setContactId(val === '__none__' ? '' : val)}
            disabled={!canEdit}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione um contato" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Nenhum</SelectItem>
              {contacts?.map((contact) => (
                <SelectItem key={contact.id} value={contact.id}>
                  {contact.first_name} {contact.last_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Pricing Table Indicator */}
      {linkedPricingTable && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <DollarSign className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <div className="flex-1">
            <span className="text-sm text-amber-700 dark:text-amber-300">
              Tabela de preços vinculada: <strong>{linkedPricingTable.name}</strong>
            </span>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
              {isAdmin 
                ? 'Você pode editar preços. Alterações fora da tabela requerem justificativa.'
                : 'Preços são ajustados automaticamente conforme a tabela.'
              }
            </p>
          </div>
        </div>
      )}

      {/* Delivery Date */}
      <div className="space-y-2">
        <Label>Data de Entrega</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'w-full justify-start text-left font-normal',
                !deliveryDate && 'text-muted-foreground'
              )}
              disabled={!canEdit}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {deliveryDate ? format(deliveryDate, 'PPP', { locale: ptBR }) : 'Selecione uma data'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={deliveryDate}
              onSelect={setDeliveryDate}
              locale={ptBR}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Add Product */}
      {canEdit && (
        <div className="space-y-2">
          <Label>Adicionar Produto</Label>
          <div className="flex gap-2">
            <Select value={selectedProductId} onValueChange={setSelectedProductId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Selecione um produto" />
              </SelectTrigger>
              <SelectContent>
                {products?.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.sku} - {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={addProductToItems} disabled={!selectedProductId}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar
            </Button>
          </div>
        </div>
      )}

      {/* Items Table */}
      {items.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead className="w-24">Qtd</TableHead>
                <TableHead className="w-32">Preço Unit.</TableHead>
                <TableHead className="w-24">Desc %</TableHead>
                <TableHead className="w-32 text-right">Subtotal</TableHead>
                {canEdit && <TableHead className="w-12"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, index) => {
                const product = products?.find(p => p.id === item.product_id);
                
                return (
                  <TableRow key={index}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{item.description}</p>
                        <p className="text-sm text-muted-foreground font-mono">
                          {product?.sku}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                        className="w-20"
                        disabled={!canEdit}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="relative">
                        <CurrencyInput
                          value={item.unit_price}
                          onChange={(val) => updateItem(index, 'unit_price', val)}
                          onBlur={() => handlePriceBlur(index)}
                          className={cn('w-28', hasPricingTable && !isAdmin && 'bg-muted')}
                          disabled={(hasPricingTable && !isAdmin) || !canEdit}
                        />
                        {hasPricingTable && (
                          <DollarSign className={cn(
                            'absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4',
                            isAdmin ? 'text-amber-500' : 'text-muted-foreground'
                          )} />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.discount_percent > 0 && (
                        <span className="text-primary font-medium">
                          {item.discount_percent}%
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(item.subtotal)}
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(index)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Total */}
      {items.length > 0 && (
        <div className="flex justify-end">
          <div className="text-right">
            <p className="text-muted-foreground">Valor Total</p>
            <p className="text-2xl font-bold">{formatCurrency(calculateTotal())}</p>
          </div>
        </div>
      )}

      {/* Observations */}
      <div className="space-y-2">
        <Label>Observações</Label>
        <Textarea
          value={observations}
          onChange={(e) => setObservations(e.target.value)}
          placeholder="Observações do pedido..."
          rows={3}
          disabled={!canEdit}
        />
      </div>
    </>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEditMode ? <Edit className="h-5 w-5" /> : <ShoppingCart className="h-5 w-5" />}
            {isEditMode ? `Editar Pedido ${order?.number}` : 'Novo Pedido'}
            {isEditMode && !canEdit && (
              <Badge variant="outline" className="ml-2 text-amber-600">
                <Lock className="h-3 w-3 mr-1" />
                Somente Leitura
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Tabs for Edit Mode */}
        {isEditMode ? (
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="details">Detalhes</TabsTrigger>
              <TabsTrigger value="approvals" className="flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" />
                Liberações
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-1">
                <History className="h-4 w-4" />
                Histórico
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-6 mt-4">
              {/* Permission warning */}
              {!canEdit && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    Este pedido está com status <strong>{orderStatusConfig[order?.status as OrderStatus]?.label}</strong> e só pode ser editado por administradores.
                  </p>
                </div>
              )}

              {/* Audit logging notice for non-pending orders */}
              {order?.status !== 'pendente' && canEdit && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Alterações neste pedido serão registradas no histórico de auditoria.
                  </p>
                </div>
              )}

              {renderOrderForm()}
            </TabsContent>

            <TabsContent value="approvals" className="space-y-4 mt-4">
              {/* Approval Actions */}
              <OrderApprovalActions 
                orderId={order!.id} 
                orderStatus={order!.status} 
                orderCreatedBy={order!.created_by}
              />
              
              {/* Approval Timeline */}
              <div className="border rounded-lg p-4">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  Histórico de Liberações
                </h4>
                <OrderApprovalTimeline orderId={order!.id} orderStatus={order!.status} />
              </div>
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              <OrderHistoryTab orderId={order!.id} />
            </TabsContent>
          </Tabs>
        ) : (
          <div className="space-y-6">
            {renderOrderForm()}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {canEdit ? 'Cancelar' : 'Fechar'}
          </Button>
          {canEdit && (
            <Button
              onClick={handleSubmit}
              disabled={isPending || items.length === 0 || (!companyId && !contactId)}
            >
              {isPending ? 'Salvando...' : isEditMode ? 'Salvar Alterações' : 'Criar Pedido'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>

      {/* Price Override Authorization Modal */}
      {pendingPriceChange && (
        <PriceOverrideModal
          open={showPriceOverrideModal}
          onOpenChange={(open) => {
            if (!open) {
              // Only revert if the change was NOT confirmed
              if (!priceChangeConfirmedRef.current) {
                handlePriceOverrideCancel();
              }
              // Reset the confirmation flag
              priceChangeConfirmedRef.current = false;
              setPriceChangeConfirmed(false);
            }
            setShowPriceOverrideModal(open);
          }}
          onConfirm={handlePriceOverrideConfirm}
          itemDescription={pendingPriceChange.itemDescription}
          currentPrice={pendingPriceChange.currentPrice}
          proposedPrice={pendingPriceChange.proposedPrice}
          pricingTableName={pendingPriceChange.pricingTableName}
        />
      )}
    </Dialog>
  );
}
