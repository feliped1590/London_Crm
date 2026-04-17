import { useEffect, useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { ShoppingCart, Plus, Trash2, CalendarIcon, DollarSign, Edit, Lock, LockOpen, CheckCircle2, History, Search } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { OrderItemDetailModal } from './OrderItemDetailModal';
import type { OrderItemDraft, ProductLookup } from '@/types/documents';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/formatters';
import { calculateIpiValue, calculateItemTotal } from '@/utils/pricing/ipiCalculations';
import { useDocumentItems } from '@/hooks/useDocumentItems';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useLegalEntities } from '@/hooks/useLegalEntities';
import { useAuth } from '@/hooks/useAuth';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import { PriceOverrideModal } from '@/components/proposals/PriceOverrideModal';
import { Order, OrderStatus, OrderType, IpiMode, ipiModeConfig, orderStatusConfig, orderTypeConfig } from '@/types/products';
import { OrderApprovalActions } from './OrderApprovalActions';
import { OrderApprovalTimeline } from './OrderApprovalTimeline';
import { OrderHistoryTab } from './OrderHistoryTab';
import { DocumentTotals } from '@/components/documents/DocumentTotals';
import { DocumentLogisticsSection, EMPTY_DELIVERY_FIELDS, buildLogisticsPayload, extractLogisticsFromRecord } from '@/components/documents/DocumentLogisticsSection';
import { useProductAdd } from '@/components/documents/ProductSelector';
import { usePriceValidation } from '@/modules/documents/usePriceValidation';
import { usePortfolioProtection } from '@/hooks/usePortfolioProtection';
import { PortfolioProtectionModal } from '@/components/customers/PortfolioProtectionModal';
import { ProductSearchModal } from '@/components/products/ProductSearchModal';
import { useRecentProducts } from '@/hooks/useRecentProducts';
import { useProductSimpleSearch } from '@/hooks/useProductSearch';

interface OrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order?: Order | null;
  onSuccess?: () => void;
  preSelectedCompanyId?: string | null;
}


export function OrderDialog({ open, onOpenChange, order, onSuccess, preSelectedCompanyId }: OrderDialogProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isAdmin } = useModulePermissions();
  const { accessibleEntities, activeLegalEntityId, hasEntities: hasLegalEntities } = useLegalEntities();

  const isEditMode = !!order;

  // Entity-level lock is now the source of truth.
  // canEdit = false when the order is locked (only status changes via approval flow allowed)
  const isOrderLocked = !!order?.is_locked;
  const canEdit = useMemo(() => {
    if (!order) return true;
    if (isOrderLocked) return false; // Locked orders are read-only (status changes happen via approval actions)
    if (order.status === 'pendente') return true;
    return isAdmin;
  }, [order, isAdmin, isOrderLocked]);
  const canUnlock = isAdmin && isOrderLocked;

  const [companyId, setCompanyId] = useState('');
  const [contactId, setContactId] = useState('');
  const [deliveryDate, setDeliveryDate] = useState<Date | undefined>();
  const [observations, setObservations] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [legalEntityId, setLegalEntityId] = useState('');
  const [ipiMode, setIpiMode] = useState<IpiMode>('destacar');
  const [orderType, setOrderType] = useState<OrderType>('producao');
  const [originalItems, setOriginalItems] = useState<OrderItemDraft[]>([]);
  const [advancedSearchOpen, setAdvancedSearchOpen] = useState(false);
  const { addRecent } = useRecentProducts();
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailItemIndex, setDetailItemIndex] = useState<number>(-1);
  const [showExitAlert, setShowExitAlert] = useState(false);

  // Logistics state
  const [carrierId, setCarrierId] = useState('');
  const [freightType, setFreightType] = useState('');
  const [deliverySameAsCompany, setDeliverySameAsCompany] = useState(true);
  const [deliveryFields, setDeliveryFields] = useState(EMPTY_DELIVERY_FIELDS);

  // Shared hooks
  const {
    resolveProductPricing, autoFillFromCompany, linkedPricingTable,
    hasPricingTable, companyFiscalData, getApplicableTable, calculatePrice,
  } = useProductAdd({ companyId: companyId || null, contactId: contactId || null });

  const orderItemSubtotal = useCallback((item: OrderItemDraft) => item.subtotal, []);

  const {
    items, setItems, addItem, removeItem, updateItem: hookUpdateItem,
    subtotalProducts: orderSubtotalProducts,
    totalIpi: orderTotalIpi,
    total: orderTotal,
    getItemIpiValue, getItemTotal,
  } = useDocumentItems<OrderItemDraft>({ ipiMode, calculateItemSubtotal: orderItemSubtotal });

  // --- Queries ---
  const [orderCompanySearch, setOrderCompanySearch] = useState('');

  const { data: paymentMethods = [] } = useQuery({
    queryKey: ['payment-methods-mapping'],
    queryFn: async () => {
      const { data } = await supabase
        .from('payment_method_erp_mapping')
        .select('crm_payment_method, erp_payment_description')
        .eq('is_active', true)
        .order('crm_payment_method');
      return (data || []) as Array<{ crm_payment_method: string; erp_payment_description: string }>;
    },
  });

  const { data: companiesRaw } = useQuery({
    queryKey: ['companies-search-orders', orderCompanySearch],
    queryFn: async (): Promise<Array<{ id: string; name: string }>> => {
      let query = supabase.from('companies').select('id, name').order('name').limit(50);
      if (orderCompanySearch) query = query.or(`name.ilike.%${orderCompanySearch}%,fantasia.ilike.%${orderCompanySearch}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: orderCompanyData } = useQuery({
    queryKey: ['order-company', order?.company_id],
    queryFn: async () => {
      if (!order?.company_id) return null;
      const { data, error } = await supabase.from('companies').select('id, name').eq('id', order.company_id).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!order?.company_id,
  });

  const { data: selectedOrderCompany } = useQuery({
    queryKey: ['order-company-selected', companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data, error } = await supabase.from('companies').select('id, name').eq('id', companyId).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId && companyId !== order?.company_id,
  });

  const companies = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    if (orderCompanyData) map.set(orderCompanyData.id, orderCompanyData);
    if (selectedOrderCompany) map.set(selectedOrderCompany.id, selectedOrderCompany);
    (companiesRaw ?? []).forEach(c => map.set(c.id, c));
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [companiesRaw, orderCompanyData, selectedOrderCompany]);

  const [orderContactSearch, setOrderContactSearch] = useState('');
  const { data: contactsRaw } = useQuery({
    queryKey: ['contacts-search-orders', orderContactSearch, companyId],
    queryFn: async (): Promise<Array<{ id: string; first_name: string; last_name: string | null }>> => {
      let query = supabase.from('contacts').select('id, first_name, last_name').order('first_name').limit(50);
      if (companyId) query = query.eq('company_id', companyId);
      if (orderContactSearch) query = query.or(`first_name.ilike.%${orderContactSearch}%,last_name.ilike.%${orderContactSearch}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: orderContactData } = useQuery({
    queryKey: ['order-contact', order?.contact_id],
    queryFn: async () => {
      if (!order?.contact_id) return null;
      const { data, error } = await supabase.from('contacts').select('id, first_name, last_name').eq('id', order.contact_id).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!order?.contact_id,
  });

  const contacts = useMemo(() => {
    const map = new Map<string, { id: string; first_name: string; last_name: string | null }>();
    if (orderContactData) map.set(orderContactData.id, orderContactData);
    (contactsRaw ?? []).forEach(c => map.set(c.id, c));
    return Array.from(map.values()).sort((a, b) => a.first_name.localeCompare(b.first_name));
  }, [contactsRaw, orderContactData]);

  const [productSearch, setProductSearch] = useState('');
  const { products } = useProductSimpleSearch(productSearch);

  const { data: existingOrderItems } = useQuery({
    queryKey: ['order_items_for_edit', order?.id],
    queryFn: async (): Promise<OrderItemDraft[]> => {
      if (!order) return [];
      const { data, error } = await supabase
        .from('order_items')
        .select('*, product:products(sku, erp_product_code, fator_kg)')
        .eq('order_id', order.id)
        .order('sort_order');
      if (error) throw error;
      return (data ?? []).map((item: any) => ({
        id: item.id, product_id: item.product_id || '', product_code: item.product?.sku || item.product?.erp_product_code || '',
        description: item.description,
        quantity: item.quantity, unit_price: item.unit_price, subtotal: item.subtotal,
        discount_percent: item.discount_percent || 0, ipi_rate: item.ipi_rate || 0,
        commission_pct: item.commission_pct || 0,
        fator_kg: item.product?.fator_kg || 0,
        width: item.width || undefined, length: item.length || undefined, thickness: item.thickness || undefined,
        is_locked: item.is_locked || false,
      }));
    },
    enabled: !!order?.id && open,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // --- Mutations ---
  const createOrderMutation = useMutation({
    mutationFn: async () => {
      if (items.length === 0) throw new Error('Adicione pelo menos um item ao pedido');
      if (!companyId && !contactId) throw new Error('Selecione uma empresa ou contato');

      const { data: newOrder, error: orderError } = await supabase.from('orders').insert({
        number: '', company_id: companyId || null, contact_id: contactId || null,
        delivery_date: deliveryDate?.toISOString().split('T')[0] || null,
        observations, total_value: orderTotal, status: 'pendente', created_by: user?.id,
        legal_entity_id: legalEntityId || null, ipi_mode: ipiMode, order_type: orderType,
        subtotal_products: orderSubtotalProducts, total_ipi: orderTotalIpi,
        payment_method: paymentMethod || null, payment_terms: paymentTerms || null,
        ...buildLogisticsPayload(carrierId, freightType, deliverySameAsCompany, deliveryFields),
      }).select().single();
      if (orderError) throw orderError;

      // NOTE: order_items.is_locked is now LEGACY (kept for backward compat).
      // Lock is enforced at order level via orders.is_locked + DB triggers.
      const orderItems = items.map((item, index) => {
        const ipiRate = ipiMode === 'isento' ? 0 : (item.ipi_rate || 0);
        const ipiVal = calculateIpiValue(item.subtotal, ipiRate, ipiMode);
        const totalItem = calculateItemTotal(item.subtotal, ipiVal, ipiMode);
        return {
          order_id: newOrder.id, product_id: item.product_id, description: item.description,
          quantity: item.quantity, unit_price: item.unit_price, subtotal: item.subtotal,
          discount_percent: item.discount_percent, ipi_rate: ipiRate, ipi_value: ipiVal,
          subtotal_item: item.subtotal, total_item: totalItem, width: item.width,
          length: item.length, thickness: item.thickness, sort_order: index,
          calculated_price_source: item.calculated_price_source || 'MANUAL',
          commission_pct: item.commission_pct || 0,
          is_locked: false, // legacy field
        };
      });
      const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
      if (itemsError) throw itemsError;

      await supabase.from('order_audit_log').insert({
        order_id: newOrder.id, field_name: 'created', field_label: 'Pedido criado',
        old_value: null, new_value: `Pedido ${newOrder.number} criado manualmente`,
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
      const message = error?.message || '';
      if (message.includes('Este cliente pertence ao vendedor')) toast.error(message, { duration: 6000 });
      else toast.error(message || 'Erro ao criar pedido');
    },
  });

  const logItemChanges = async (orderId: string) => {
    if (!isEditMode || order?.status === 'pendente') return;
    const auditLogs: Array<{ order_id: string; field_name: string; field_label: string; old_value: string | null; new_value: string | null; changed_by: string }> = [];

    for (const original of originalItems) {
      if (!items.find(n => n.id === original.id)) {
        auditLogs.push({ order_id: orderId, field_name: 'item_removed', field_label: 'Item Removido', old_value: `${original.description} (Qtd: ${original.quantity}, Preço: R$ ${original.unit_price.toFixed(2)})`, new_value: null, changed_by: user?.id || '' });
      }
    }
    for (const newItem of items) {
      if (!newItem.id || !originalItems.find(o => o.id === newItem.id)) {
        auditLogs.push({ order_id: orderId, field_name: 'item_added', field_label: 'Item Adicionado', old_value: null, new_value: `${newItem.description} (Qtd: ${newItem.quantity}, Preço: R$ ${newItem.unit_price.toFixed(2)})`, changed_by: user?.id || '' });
      }
    }
    for (const newItem of items) {
      if (!newItem.id) continue;
      const original = originalItems.find(o => o.id === newItem.id);
      if (original && (original.quantity !== newItem.quantity || original.unit_price !== newItem.unit_price)) {
        auditLogs.push({ order_id: orderId, field_name: 'item_modified', field_label: 'Item Alterado', old_value: `${original.description}: Qtd=${original.quantity}, Preço=R$ ${original.unit_price.toFixed(2)}`, new_value: `${newItem.description}: Qtd=${newItem.quantity}, Preço=R$ ${newItem.unit_price.toFixed(2)}`, changed_by: user?.id || '' });
      }
    }
    if (auditLogs.length > 0) await supabase.from('order_audit_log').insert(auditLogs);
  };

  const updateOrderMutation = useMutation({
    mutationFn: async () => {
      if (!order) throw new Error('Pedido não encontrado');
      if (items.length === 0) throw new Error('Adicione pelo menos um item ao pedido');
      if (!companyId && !contactId) throw new Error('Selecione uma empresa ou contato');

      const { error: orderError } = await supabase.from('orders').update({
        company_id: companyId || null, contact_id: contactId || null,
        delivery_date: deliveryDate?.toISOString().split('T')[0] || null,
        observations, total_value: orderTotal, legal_entity_id: legalEntityId || null,
        ipi_mode: ipiMode, order_type: orderType,
        subtotal_products: orderSubtotalProducts, total_ipi: orderTotalIpi,
        payment_method: paymentMethod || null, payment_terms: paymentTerms || null,
        
        ...buildLogisticsPayload(carrierId, freightType, deliverySameAsCompany, deliveryFields),
      }).eq('id', order.id);
      if (orderError) throw orderError;

      await logItemChanges(order.id);
      await supabase.from('order_items').delete().eq('order_id', order.id);

      // NOTE: order_items.is_locked is now LEGACY. The lock is enforced at the order level
      // via orders.is_locked + DB triggers. We keep the column for backward compat but no
      // longer auto-lock items based on order status.
      const orderItems = items.map((item, index) => {
        const ipiRate = ipiMode === 'isento' ? 0 : (item.ipi_rate || 0);
        const ipiVal = calculateIpiValue(item.subtotal, ipiRate, ipiMode);
        const totalItem = calculateItemTotal(item.subtotal, ipiVal, ipiMode);
        return {
          order_id: order.id, product_id: item.product_id, description: item.description,
          quantity: item.quantity, unit_price: item.unit_price, subtotal: item.subtotal,
          discount_percent: item.discount_percent, ipi_rate: ipiRate, ipi_value: ipiVal,
          subtotal_item: item.subtotal, total_item: totalItem, width: item.width,
          length: item.length, thickness: item.thickness, sort_order: index,
          calculated_price_source: item.calculated_price_source || 'MANUAL',
          commission_pct: item.commission_pct || 0,
          is_locked: false, // legacy field — no longer used as business rule
        };
      });
      const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
      if (itemsError) throw itemsError;
      return order;
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order_items'] });
      queryClient.invalidateQueries({ queryKey: ['order_items_for_edit', order?.id] });
      queryClient.invalidateQueries({ queryKey: ['order_audit_log'] });

      // Auto re-sync if order was previously synced to ERP
      if (order && (order as any).erp_order_id) {
        try {
          const { data: existing } = await supabase
            .from('order_sync_queue')
            .select('id')
            .eq('order_id', order.id)
            .maybeSingle();

          if (existing) {
            await supabase.from('order_sync_queue')
              .update({ status: 'pending' as any, attempt_count: 0, error_message: null, next_retry_at: null })
              .eq('id', existing.id);
          }

          queryClient.invalidateQueries({ queryKey: ['order_sync_status', order.id] });

          // Fire-and-forget
          supabase.functions.invoke('process-order-sync', {
            body: { order_id: order.id },
          }).catch(() => {});
        } catch {}
      }

      toast.success('Pedido atualizado com sucesso!');
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: Error) => {
      const message = error?.message || '';
      if (message.includes('Este cliente pertence ao vendedor')) toast.error(message, { duration: 6000 });
      else toast.error(message || 'Erro ao atualizar pedido');
    },
  });

  // --- Lock / Unlock mutations (entity-level) ---
  const lockOrderMutation = useMutation({
    mutationFn: async () => {
      if (!order) throw new Error('Pedido não encontrado');
      const { data, error } = await supabase.rpc('lock_order', { p_order_id: order.id });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order_audit_log'] });
      toast.success('Pedido bloqueado com sucesso');
    },
    onError: (err: Error) => toast.error(err.message || 'Erro ao bloquear pedido'),
  });

  const unlockOrderMutation = useMutation({
    mutationFn: async () => {
      if (!order) throw new Error('Pedido não encontrado');
      const { data, error } = await supabase.rpc('unlock_order', { p_order_id: order.id });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order_audit_log'] });
      toast.success('Pedido desbloqueado');
    },
    onError: (err: Error) => toast.error(err.message || 'Erro ao desbloquear pedido'),
  });
  const priceValidation = usePriceValidation({
    items, setItems, products,
    companyId: companyId || null, contactId: contactId || null,
    calculateItemSubtotal: orderItemSubtotal, isEditMode,
    onSubmitCreate: () => createOrderMutation.mutate(),
    onSubmitUpdate: () => updateOrderMutation.mutate(),
  });

  // --- Effects ---
  useEffect(() => {
    if (open && order) {
      setCompanyId(order.company_id || '');
      setContactId(order.contact_id || '');
      setDeliveryDate(order.delivery_date ? new Date(order.delivery_date) : undefined);
      setObservations(order.observations || '');
      setLegalEntityId((order as any).legal_entity_id || activeLegalEntityId || '');
      setIpiMode((order as any).ipi_mode || 'destacar');
      setOrderType((order as any).order_type || 'producao');
      setPaymentMethod((order as any).payment_method || '');
      setPaymentTerms((order as any).payment_terms || '');
      const logistics = extractLogisticsFromRecord(order);
      setCarrierId(logistics.carrierId);
      setFreightType(logistics.freightType);
      setDeliverySameAsCompany(logistics.deliverySameAsCompany);
      setDeliveryFields(logistics.deliveryFields);
    } else if (open && !order) {
      setLegalEntityId(activeLegalEntityId || '');
      if (preSelectedCompanyId) {
        setCompanyId(preSelectedCompanyId);
        autoFillFromCompany(preSelectedCompanyId).then(data => {
          if (data?.default_carrier_id) setCarrierId(data.default_carrier_id);
          if (data?.default_freight_type) setFreightType(data.default_freight_type);
          if (data?.contribuinte_ipi === false) setIpiMode('isento');
          else if (data?.contribuinte_ipi === true) setIpiMode('destacar');
        });
      }
    }
    if (open && !order && companyId && !preSelectedCompanyId) {
      autoFillFromCompany(companyId).then(data => {
        if (data?.default_carrier_id) setCarrierId(data.default_carrier_id);
        if (data?.default_freight_type) setFreightType(data.default_freight_type);
        if (data?.contribuinte_ipi === false) setIpiMode('isento');
        else if (data?.contribuinte_ipi === true) setIpiMode('destacar');
      });
    }
  }, [open, order, activeLegalEntityId, preSelectedCompanyId]);

  useEffect(() => {
    if (!open || !order?.id) return;
    setItems(existingOrderItems ?? []);
    setOriginalItems(existingOrderItems ?? []);
  }, [open, order?.id, existingOrderItems]);

  useEffect(() => {
    if (!open) {
      setCompanyId(''); setContactId(''); setDeliveryDate(undefined); setObservations('');
      setItems([]); setOriginalItems([]); setSelectedProductId('');
      setLegalEntityId(''); setOrderType('producao');
      setCarrierId(''); setFreightType('');
      setDeliverySameAsCompany(true); setDeliveryFields(EMPTY_DELIVERY_FIELDS);
      setPaymentMethod(''); setPaymentTerms('');
      setDetailModalOpen(false); setDetailItemIndex(-1); setShowExitAlert(false);
    }
  }, [open]);

  useEffect(() => {
    if (!companyFiscalData || items.length === 0) return;
    setItems(prev => prev.map(item => {
      if (!item.product_id) return item;
      const product = products?.find(p => p.id === item.product_id);
      if (!product) return item;
      return { ...item, ipi_rate: companyFiscalData.contribuinte_ipi ? (product.aliquota_ipi || 0) : 0 };
    }));
  }, [companyFiscalData]);

  // --- Handlers ---
  const addProductById = useCallback((productId: string, productData?: any) => {
    const product = productData || products?.find(p => p.id === productId);
    if (!product) return;
    const { unitPrice, discountPercent, priceSource, ipiRate } = resolveProductPricing(product, ipiMode);
    addItem({
      product_id: product.id, product_code: product.sku || product.erp_code || '', description: product.name, quantity: 1,
      unit_price: unitPrice, subtotal: unitPrice, discount_percent: discountPercent,
      ipi_rate: ipiRate, commission_pct: 0, fator_kg: product.fator_kg || 0, width: product.width || undefined,
      length: product.length || undefined, thickness: product.thickness || undefined,
      calculated_price_source: priceSource, is_locked: false,
    });
    addRecent(product.id);
    setSelectedProductId('');
  }, [products, ipiMode, resolveProductPricing, addItem, addRecent]);

  const addProductToItems = () => {
    if (!selectedProductId) return;
    addProductById(selectedProductId);
  };

  // F9 shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F9' && open && !advancedSearchOpen) {
        e.preventDefault();
        setAdvancedSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, advancedSearchOpen]);

  // NOTE: order_items.is_locked is now LEGACY (not a business rule).
  // Edit/remove/lock at the item level is no longer enforced — the parent
  // order's is_locked is the single source of truth.
  const handleItemDetailUpdate = useCallback((index: number, updatedItem: OrderItemDraft) => {
    if (!canEdit) return;
    setItems(prev => prev.map((item, i) => i === index ? updatedItem : item));
  }, [setItems, canEdit]);

  const updateItem = (index: number, field: keyof OrderItemDraft, value: any) => {
    if (!canEdit) return;

    if (field === 'quantity') {
      hookUpdateItem(index, field, value, (item: OrderItemDraft): OrderItemDraft => {
        item.quantity = Number(value) || 1;
        const product = products?.find(p => p.id === item.product_id);
        if (product) {
          const applicableTable = getApplicableTable(
            companyId ? 'company' : contactId ? 'contact' : null,
            companyId || contactId || null, product.id,
          );
          if (applicableTable) {
            const { finalPrice, rule } = calculatePrice(applicableTable.id, product.id, product.tipo_id, item.quantity, product.unit_price || 0);
            item.unit_price = finalPrice;
            if (rule?.discount_percent) item.discount_percent = rule.discount_percent;
          }
        }
        item.subtotal = item.quantity * item.unit_price;
        return item;
      });
    } else if (field === 'unit_price') {
      hookUpdateItem(index, field, value, (item: OrderItemDraft): OrderItemDraft => {
        item.unit_price = Number(value) || 0;
        item.subtotal = item.quantity * item.unit_price;
        return item;
      });
    } else {
      hookUpdateItem(index, field, value);
    }
  };

  const handleRemoveItem = useCallback((index: number) => {
    if (!canEdit) return;
    removeItem(index);
  }, [canEdit, removeItem]);

  // Dialog close handler. Radix calls onOpenChange(false) when the user clicks
  // the X, the overlay, or presses Escape. We must respect that signal: if the
  // order is editable (unsaved changes possible) we show the exit alert;
  // otherwise we close normally.
  const handleDialogClose = useCallback((nextOpen: boolean) => {
    if (nextOpen) {
      onOpenChange(true);
      return;
    }
    if (isEditMode && !isOrderLocked && canEdit && items.length > 0) {
      setShowExitAlert(true);
      return;
    }
    onOpenChange(false);
  }, [isEditMode, isOrderLocked, canEdit, items.length, onOpenChange]);

  // Portfolio protection
  const {
    isBlocked: isPortfolioBlocked,
    protectionInfo,
    showProtectionModal,
    setShowProtectionModal,
    checkAccess,
    isLoaded: protectionLoaded,
  } = usePortfolioProtection(companyId || undefined);

  const handleSubmit = () => {
    if ((freightType === 'CIF' || freightType === 'FOB') && !carrierId) {
      toast.error('Transportadora é obrigatória quando o tipo de frete é CIF ou FOB');
      return;
    }
    // Check portfolio protection before submitting
    if (!checkAccess()) return;
    if (!priceValidation.validateBeforeSubmit()) return;
    if (isEditMode) updateOrderMutation.mutate();
    else createOrderMutation.mutate();
  };

  const isPending = createOrderMutation.isPending || updateOrderMutation.isPending;
  const priceOverrideProps = priceValidation.getPriceOverrideModalProps();

  // --- Render ---
  const renderOrderForm = () => (
    <>
      {hasLegalEntities && (
        <div className="space-y-2">
          <Label>CNPJ Emissor</Label>
          <Select value={legalEntityId} onValueChange={setLegalEntityId} disabled={!canEdit}>
            <SelectTrigger><SelectValue placeholder="Selecione o CNPJ emissor" /></SelectTrigger>
            <SelectContent>
              {accessibleEntities.map((entity) => (
                <SelectItem key={entity.id} value={entity.id}>{entity.name} — {entity.cnpj}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Empresa</Label>
          <SearchableSelect
            options={(companies || []).map(c => ({ value: c.id, label: c.name }))}
            value={companyId || null}
            onChange={(v) => { setCompanyId(v || ''); if (v && !order) autoFillFromCompany(v).then(data => { if (data?.default_carrier_id) setCarrierId(data.default_carrier_id); if (data?.default_freight_type) setFreightType(data.default_freight_type); }); }}
            placeholder="Selecione uma empresa" searchPlaceholder="Buscar empresa..."
            disabled={!canEdit} onSearchChange={setOrderCompanySearch}
          />
        </div>
        <div className="space-y-2">
          <Label>Contato</Label>
          <SearchableSelect
            options={(contacts || []).map(c => ({ value: c.id, label: `${c.first_name} ${c.last_name || ''}`.trim() }))}
            value={contactId || null} onChange={(v) => setContactId(v || '')}
            placeholder="Selecione um contato" searchPlaceholder="Buscar contato..."
            disabled={!canEdit} onSearchChange={setOrderContactSearch}
          />
        </div>
      </div>

      {linkedPricingTable && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <DollarSign className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <div className="flex-1">
            <span className="text-sm text-amber-700 dark:text-amber-300">
              Tabela de preços vinculada: <strong>{linkedPricingTable.name}</strong>
            </span>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
              {isAdmin ? 'Você pode editar preços. Alterações fora da tabela requerem justificativa.' : 'Preços são ajustados automaticamente conforme a tabela.'}
            </p>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label>Data de Entrega</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !deliveryDate && 'text-muted-foreground')} disabled={!canEdit}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {deliveryDate ? format(deliveryDate, 'PPP', { locale: ptBR }) : 'Selecione uma data'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar mode="single" selected={deliveryDate} onSelect={setDeliveryDate} locale={ptBR} initialFocus />
          </PopoverContent>
        </Popover>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Tipo do Pedido</Label>
          <Select value={orderType} onValueChange={(v) => setOrderType(v as OrderType)} disabled={!canEdit}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(orderTypeConfig).map(([value, config]) => (
                <SelectItem key={value} value={value}>{config.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Modo IPI</Label>
          <Select value={ipiMode} onValueChange={(v) => setIpiMode(v as IpiMode)} disabled={!canEdit}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(ipiModeConfig).map(([value, config]) => (
                <SelectItem key={value} value={value}>{config.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{ipiModeConfig[ipiMode].description}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Forma de Pagamento</Label>
          <Select value={paymentMethod} onValueChange={setPaymentMethod} disabled={!canEdit}>
            <SelectTrigger><SelectValue placeholder="Selecione a forma de pagamento" /></SelectTrigger>
            <SelectContent>
              {paymentMethods.map((pm) => (
                <SelectItem key={pm.crm_payment_method} value={pm.crm_payment_method}>
                  {pm.erp_payment_description}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Condições de Pagamento (dias)</Label>
          <Input
            value={paymentTerms}
            onChange={(e) => setPaymentTerms(e.target.value)}
            placeholder="Ex: 28/35/42"
            disabled={!canEdit}
          />
          <p className="text-xs text-muted-foreground">Separe os dias de cada parcela com /</p>
        </div>
      </div>
      {canEdit && (

        <div className="space-y-2">
          <Label>Adicionar Produto</Label>
          <div className="flex gap-2">
            <SearchableSelect
              value={selectedProductId} onChange={(v) => setSelectedProductId(v || '')}
              placeholder="Buscar produto por nome ou SKU..." searchPlaceholder="Digite para buscar..."
              emptyMessage="Nenhum produto encontrado" className="flex-1" onSearchChange={setProductSearch}
              options={(products ?? []).map((p) => ({ value: p.id, label: `${p.sku} - ${p.name}` }))}
            />
            <Button variant="outline" size="icon" onClick={() => setAdvancedSearchOpen(true)} title="Pesquisa Avançada (F9)">
              <Search className="h-4 w-4" />
            </Button>
            <Button onClick={addProductToItems} disabled={!selectedProductId}>
              <Plus className="h-4 w-4 mr-2" />Adicionar
            </Button>
          </div>
        </div>
      )}

      {items.length > 0 && (
        <TooltipProvider>
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead className="w-24">Qtd</TableHead>
                <TableHead className="w-32">Preço Unit.</TableHead>
                <TableHead className="w-28">Fator KG</TableHead>
                <TableHead className="w-28 text-right">Subtotal</TableHead>
                {ipiMode !== 'isento' && (
                  <>
                    <TableHead className="w-20 text-right">IPI %</TableHead>
                    <TableHead className="w-28 text-right">IPI R$</TableHead>
                  </>
                )}
                <TableHead className="w-20 text-right">Com %</TableHead>
                <TableHead className="w-32 text-right">Total</TableHead>
                {canEdit && <TableHead className="w-12"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, index) => {
                const product = products?.find(p => p.id === item.product_id);
                const ipiRate = ipiMode === 'isento' ? 0 : (item.ipi_rate || 0);
                const ipiVal = getItemIpiValue(item);
                const totalItem = getItemTotal(item);
                return (
                  <TableRow key={index}>
                    <TableCell>
                      <div
                        className="cursor-pointer hover:underline"
                        onClick={() => { setDetailItemIndex(index); setDetailModalOpen(true); }}
                      >
                        <p className="text-xs text-muted-foreground font-mono">{item.product_code || product?.sku || ''}</p>
                        <p className="font-medium">{item.description}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Input type="number" min="1" value={item.quantity} onChange={(e) => updateItem(index, 'quantity', e.target.value)} className="w-20" disabled={!canEdit} />
                    </TableCell>
                    <TableCell>
                      <div className="relative">
                        <CurrencyInput value={item.unit_price} onChange={(val) => updateItem(index, 'unit_price', val)} onBlur={() => priceValidation.handlePriceBlur(index)} className={cn('w-28', hasPricingTable && !isAdmin && 'bg-muted')} disabled={(hasPricingTable && !isAdmin) || !canEdit} />
                        {hasPricingTable && (<DollarSign className={cn('absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4', isAdmin ? 'text-amber-500' : 'text-muted-foreground')} />)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {(item.fator_kg || 0) > 0 ? formatCurrency(item.fator_kg!) : '—'}
                    </TableCell>
                    <TableCell className="text-right font-medium text-sm">{formatCurrency(item.subtotal)}</TableCell>
                    {ipiMode !== 'isento' && (
                      <>
                        <TableCell className="text-right text-sm">{ipiRate.toFixed(2)}%</TableCell>
                        <TableCell className="text-right text-sm">{formatCurrency(ipiVal)}</TableCell>
                      </>
                    )}
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={0.01}
                        value={item.commission_pct || ''}
                        onChange={(e) => updateItem(index, 'commission_pct', Number(e.target.value) || 0)}
                        className="w-16 text-right text-sm"
                        placeholder="0"
                        disabled={!canEdit}
                      />
                    </TableCell>
                    <TableCell className="text-right font-bold text-sm">{formatCurrency(totalItem)}</TableCell>
                    {canEdit && (
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(index)}>
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
        </TooltipProvider>
      )}

      {items.length > 0 && (
        <DocumentTotals subtotalProducts={orderSubtotalProducts} totalIpi={orderTotalIpi} total={orderTotal} ipiMode={ipiMode} />
      )}


      <DocumentLogisticsSection
        carrierId={carrierId} setCarrierId={setCarrierId}
        freightType={freightType} setFreightType={setFreightType}
        deliverySameAsCompany={deliverySameAsCompany} setDeliverySameAsCompany={setDeliverySameAsCompany}
        deliveryFields={deliveryFields} setDeliveryFields={setDeliveryFields}
        disabled={!canEdit}
      />

      <div className="space-y-2">
        <Label>Observações</Label>
        <Textarea value={observations} onChange={(e) => setObservations(e.target.value)} placeholder="Observações do pedido..." rows={3} disabled={!canEdit} />
      </div>
    </>
  );

  return (
    <>
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogContent className="max-w-[80vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEditMode ? <Edit className="h-5 w-5" /> : <ShoppingCart className="h-5 w-5" />}
            {isEditMode ? `Editar Pedido ${order?.number}` : 'Novo Pedido'}
            {isOrderLocked && (
              <Badge variant="outline" className="ml-2 text-amber-600 border-amber-300">
                <Lock className="h-3 w-3 mr-1" />Bloqueado
              </Badge>
            )}
            {isEditMode && !canEdit && !isOrderLocked && (
              <Badge variant="outline" className="ml-2 text-amber-600">
                <Lock className="h-3 w-3 mr-1" />Somente Leitura
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {isEditMode ? (
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="details">Detalhes</TabsTrigger>
              <TabsTrigger value="approvals" className="flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" />Liberações
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-1">
                <History className="h-4 w-4" />Histórico
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-6 mt-4">
              {isOrderLocked && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-amber-700 dark:text-amber-300">Pedido bloqueado</p>
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                        Nenhum campo pode ser alterado. Apenas mudanças de status (via Liberações) são permitidas.
                        {!canUnlock && ' Apenas administradores podem desbloquear.'}
                      </p>
                    </div>
                  </div>
                  {canUnlock && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => unlockOrderMutation.mutate()}
                      disabled={unlockOrderMutation.isPending}
                      className="flex-shrink-0"
                    >
                      <LockOpen className="h-3.5 w-3.5 mr-1.5" />
                      Desbloquear
                    </Button>
                  )}
                </div>
              )}
              {!isOrderLocked && !canEdit && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    Este pedido está com status <strong>{orderStatusConfig[order?.status as OrderStatus]?.label}</strong> e só pode ser editado por administradores.
                  </p>
                </div>
              )}
              {order?.status !== 'pendente' && canEdit && !isOrderLocked && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Alterações neste pedido serão registradas no histórico de auditoria.
                  </p>
                </div>
              )}
              {renderOrderForm()}
            </TabsContent>

            <TabsContent value="approvals" className="space-y-4 mt-4">
              <OrderApprovalActions orderId={order!.id} orderStatus={order!.status} orderCreatedBy={order!.created_by} orderType={(order!.order_type as OrderType) || 'producao'} />
              <div className="border rounded-lg p-4">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />Histórico de Liberações
                </h4>
                <OrderApprovalTimeline orderId={order!.id} orderStatus={order!.status} />
              </div>
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              <OrderHistoryTab orderId={order!.id} />
            </TabsContent>
          </Tabs>
        ) : (
          <div className="space-y-6">{renderOrderForm()}</div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleDialogClose(true)}>
            {canEdit ? 'Cancelar' : 'Fechar'}
          </Button>
          {isEditMode && !isOrderLocked && canEdit && items.length > 0 && (
            <Button
              variant="outline"
              onClick={() => lockOrderMutation.mutate()}
              disabled={lockOrderMutation.isPending}
              className="border-amber-300 text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20"
            >
              <Lock className="h-4 w-4 mr-2" />
              {lockOrderMutation.isPending ? 'Bloqueando...' : 'Bloquear Pedido'}
            </Button>
          )}
          {canEdit && (
            <Button onClick={handleSubmit} disabled={isPending || items.length === 0 || (!companyId && !contactId)}>
              {isPending ? 'Salvando...' : isEditMode ? 'Salvar Alterações' : 'Criar Pedido'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>

      <PriceOverrideModal {...priceOverrideProps} />

      <PortfolioProtectionModal
        open={showProtectionModal}
        onOpenChange={setShowProtectionModal}
        info={protectionInfo}
      />

      <ProductSearchModal
        open={advancedSearchOpen}
        onOpenChange={setAdvancedSearchOpen}
        onSelect={(product) => addProductById(product.id, product)}
      />
    </Dialog>

    <OrderItemDetailModal
      open={detailModalOpen}
      onOpenChange={setDetailModalOpen}
      item={detailItemIndex >= 0 ? items[detailItemIndex] : null}
      index={detailItemIndex}
      onUpdate={handleItemDetailUpdate}
      canEdit={canEdit}
    />

    <AlertDialog open={showExitAlert} onOpenChange={setShowExitAlert}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Sair sem bloquear?</AlertDialogTitle>
          <AlertDialogDescription>
            Este pedido está editável. Você pode bloqueá-lo agora para impedir alterações futuras
            (apenas administradores poderão desbloquear), ou sair mantendo-o aberto para edição.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel>Continuar editando</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => { setShowExitAlert(false); onOpenChange(false); }}
            className="bg-secondary text-secondary-foreground hover:bg-secondary/80"
          >
            Sair sem bloquear
          </AlertDialogAction>
          <AlertDialogAction
            onClick={async () => {
              setShowExitAlert(false);
              try {
                await lockOrderMutation.mutateAsync();
                onOpenChange(false);
              } catch { /* toast already shown */ }
            }}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            <Lock className="h-4 w-4 mr-2" />
            Bloquear e sair
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
