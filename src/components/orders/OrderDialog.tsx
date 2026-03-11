import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
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
import { ShoppingCart, Plus, Trash2, CalendarIcon, DollarSign, Edit, Lock, CheckCircle2, History, Truck, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/formatters';
import { calculateIpiValue, calculateItemTotal } from '@/utils/pricing/ipiCalculations';
import { useDocumentItems } from '@/hooks/useDocumentItems';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { usePricingTables } from '@/hooks/usePricingTables';
import { calculatePackagingPrice } from '@/utils/pricing/packagingPricing';
import { useLegalEntities } from '@/hooks/useLegalEntities';
import { useAuth } from '@/hooks/useAuth';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import { PriceOverrideModal } from '@/components/proposals/PriceOverrideModal';
import { Order, OrderItem, OrderStatus, OrderType, IpiMode, ipiModeConfig, orderStatusConfig, orderTypeConfig } from '@/types/products';
import { OrderApprovalActions } from './OrderApprovalActions';
import { OrderApprovalTimeline } from './OrderApprovalTimeline';
import { OrderHistoryTab } from './OrderHistoryTab';
import { useCompanyFiscal } from '@/hooks/useCompanyFiscal';

interface OrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order?: Order | null; // If passed, it's edit mode; otherwise, create mode
  onSuccess?: () => void;
  preSelectedCompanyId?: string | null;
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
  calculated_price_source?: 'TABLE' | 'FACTOR_KG' | 'MANUAL';
}

export function OrderDialog({ open, onOpenChange, order, onSuccess, preSelectedCompanyId }: OrderDialogProps) {
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
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [legalEntityId, setLegalEntityId] = useState<string>('');
  const [ipiMode, setIpiMode] = useState<IpiMode>('destacar');
  const [orderType, setOrderType] = useState<OrderType>('producao');

  const orderItemSubtotal = useCallback((item: OrderItemDraft) => item.subtotal, []);

  const {
    items, setItems, addItem, removeItem, updateItem: hookUpdateItem,
    subtotalProducts: orderSubtotalProducts,
    totalIpi: orderTotalIpi,
    total: orderTotal,
    getItemIpiValue, getItemTotal,
  } = useDocumentItems<OrderItemDraft>({
    ipiMode,
    calculateItemSubtotal: orderItemSubtotal,
  });
  // Store original items for comparison (audit logging)
  const [originalItems, setOriginalItems] = useState<OrderItemDraft[]>([]);

  // Logistics state
  const [carrierId, setCarrierId] = useState('');
  const [freightType, setFreightType] = useState('');
  const [deliverySameAsCompany, setDeliverySameAsCompany] = useState(true);
  const [deliveryFields, setDeliveryFields] = useState({
    name: '', address: '', number: '', neighborhood: '', city: '', state: '', zip_code: '', contact: '',
  });

  const { companyFiscalData } = useCompanyFiscal(companyId || undefined);


  // Price override modal states
  const [showPriceOverrideModal, setShowPriceOverrideModal] = useState(false);

  // Carrier search for logistics
  const [carrierSearch, setCarrierSearch] = useState('');
  const { data: carriersRaw } = useQuery({
    queryKey: ['carriers-search-dialog', carrierSearch],
    queryFn: async () => {
      let query = supabase.from('carriers').select('id, name, trade_name').eq('active', true).order('name').limit(50);
      if (carrierSearch) query = query.ilike('name', `%${carrierSearch}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const carrierOptions = useMemo(() => {
    return (carriersRaw || []).map(c => ({ value: c.id, label: c.trade_name ? `${c.trade_name} (${c.name})` : c.name }));
  }, [carriersRaw]);

  // Auto-fill carrier, freight type and IPI mode from company defaults
  const autoFillFromCompany = useCallback(async (compId: string) => {
    if (!compId) return;
    const { data } = await supabase.from('companies').select('default_carrier_id, default_freight_type, contribuinte_ipi').eq('id', compId).maybeSingle();
    if (data?.default_carrier_id) {
      setCarrierId(data.default_carrier_id);
    }
    if (data?.default_freight_type) {
      setFreightType(data.default_freight_type);
    }
    // Set IPI mode based on customer's contribuinte_ipi flag
    if (data && data.contribuinte_ipi === false) {
      setIpiMode('isento');
    } else if (data && data.contribuinte_ipi === true) {
      setIpiMode('destacar');
    }
  }, []);

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

  // Search-based company loading (on-demand)
  const [orderCompanySearch, setOrderCompanySearch] = useState('');
  const { data: companiesRaw } = useQuery({
    queryKey: ['companies-search-orders', orderCompanySearch],
    queryFn: async (): Promise<Array<{ id: string; name: string }>> => {
      let query = supabase.from('companies').select('id, name').order('name').limit(50);
      if (orderCompanySearch) {
        query = query.or(`name.ilike.%${orderCompanySearch}%,fantasia.ilike.%${orderCompanySearch}%`);
      }
      const { data, error } = await query;
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

  // Also fetch the currently selected company (for new orders)
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

  // Search-based contact loading (on-demand)
  const [orderContactSearch, setOrderContactSearch] = useState('');
  const { data: contactsRaw } = useQuery({
    queryKey: ['contacts-search-orders', orderContactSearch, companyId],
    queryFn: async (): Promise<Array<{ id: string; first_name: string; last_name: string | null }>> => {
      let query = supabase.from('contacts').select('id, first_name, last_name').order('first_name').limit(50);
      if (companyId) query = query.eq('company_id', companyId);
      if (orderContactSearch) {
        query = query.or(`first_name.ilike.%${orderContactSearch}%,last_name.ilike.%${orderContactSearch}%`);
      }
      const { data, error } = await query;
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
    const map = new Map<string, { id: string; first_name: string; last_name: string | null }>();
    if (orderContactData) map.set(orderContactData.id, orderContactData);
    (contactsRaw ?? []).forEach(c => map.set(c.id, c));
    return Array.from(map.values()).sort((a, b) => a.first_name.localeCompare(b.first_name));
  }, [contactsRaw, orderContactData]);

  // Fetch products with server-side search
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

  const [productSearch, setProductSearch] = useState('');
  
  const { data: products } = useQuery({
    queryKey: ['products-active-search', productSearch],
    queryFn: async (): Promise<ProductItem[]> => {
      let query = supabase
        .from('products')
        .select('id, sku, name, tipo_id, unit_price, width, length, thickness, aliquota_ipi')
        .eq('active', true)
        .order('name')
        .limit(50);

      if (productSearch.trim()) {
        query = query.or(`name.ilike.%${productSearch.trim()}%,sku.ilike.%${productSearch.trim()}%`);
      }

      const { data, error } = await query;
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
      setOrderType((order as any).order_type || 'producao');
      // Logistics
      setCarrierId((order as any).carrier_id || '');
      setFreightType((order as any).freight_type || '');
      setDeliverySameAsCompany((order as any).delivery_same_as_company !== false);
      setDeliveryFields({
        name: (order as any).delivery_name || '',
        address: (order as any).delivery_address || '',
        number: (order as any).delivery_number || '',
        neighborhood: (order as any).delivery_neighborhood || '',
        city: (order as any).delivery_city || '',
        state: (order as any).delivery_state || '',
        zip_code: (order as any).delivery_zip_code || '',
        contact: (order as any).delivery_contact || '',
      });
    } else if (open && !order) {
      setLegalEntityId(activeLegalEntityId || '');
      if (preSelectedCompanyId) {
        setCompanyId(preSelectedCompanyId);
        autoFillFromCompany(preSelectedCompanyId);
      }
    }
    // Auto-fill carrier for new orders when company changes (no preselect)
    if (open && !order && companyId && !preSelectedCompanyId) {
      autoFillFromCompany(companyId);
    }
  }, [open, order, activeLegalEntityId, preSelectedCompanyId]);

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
      setOrderType('producao');
      setPendingPriceChange(null);
      setShowPriceOverrideModal(false);
      setCarrierId('');
      setFreightType('');
      setDeliverySameAsCompany(true);
      setDeliveryFields({ name: '', address: '', number: '', neighborhood: '', city: '', state: '', zip_code: '', contact: '' });
    }
  }, [open]);

  // Recalculate IPI rates when company fiscal data changes
  useEffect(() => {
    if (!companyFiscalData || items.length === 0) return;
    setItems(prev =>
      prev.map(item => {
        if (!item.product_id) return item;
        const product = products?.find(p => p.id === item.product_id);
        if (!product) return item;
        return {
          ...item,
          ipi_rate: companyFiscalData.contribuinte_ipi
            ? (product as any).aliquota_ipi || 0
            : 0,
        };
      })
    );
  }, [companyFiscalData]);


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
    let priceSource: 'TABLE' | 'FACTOR_KG' | 'MANUAL' = 'MANUAL';

    if (applicableTable) {
      const { finalPrice, rule } = calculatePrice(
        applicableTable.id,
        product.id,
        product.tipo_id,
        1,
        product.unit_price || 0
      );
      unitPrice = finalPrice;
      priceSource = 'TABLE';
      if (rule?.discount_percent) {
        discountPercent = rule.discount_percent;
      }
    } else {
      // Sem tabela de preço: aplicar cálculo por fator KG (embalagens)
      const packagingPrice = calculatePackagingPrice(product);
      if (packagingPrice !== (product.unit_price || 0) && (product as any).fator_kg) {
        priceSource = 'FACTOR_KG';
      }
      unitPrice = packagingPrice;
    }

    const newItem: OrderItemDraft = {
      product_id: product.id,
      description: product.name,
      quantity: 1,
      unit_price: unitPrice,
      subtotal: unitPrice,
      discount_percent: discountPercent,
      ipi_rate: (companyId && companyFiscalData)
        ? (companyFiscalData.contribuinte_ipi ? ((product as any).aliquota_ipi || 0) : 0)
        : ((product as any).aliquota_ipi || 0),
      width: product.width || undefined,
      length: product.length || undefined,
      thickness: product.thickness || undefined,
      calculated_price_source: priceSource,
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

  // Update item with pricing recalculation
  const updateItem = (index: number, field: keyof OrderItemDraft, value: any) => {
    if (field === 'quantity') {
      const quantityTransform = (item: OrderItemDraft): OrderItemDraft => {
        item.quantity = Number(value) || 1;
        const product = products?.find(p => p.id === item.product_id);
        if (product) {
          const applicableTable = getApplicableTable(
            companyId ? 'company' : contactId ? 'contact' : null,
            companyId || contactId || null,
            product.id
          );
          if (applicableTable) {
            const { finalPrice, rule } = calculatePrice(
              applicableTable.id, product.id, product.tipo_id,
              item.quantity, product.unit_price || 0
            );
            item.unit_price = finalPrice;
            if (rule?.discount_percent) item.discount_percent = rule.discount_percent;
          }
        }
        item.subtotal = item.quantity * item.unit_price;
        return item;
      };
      hookUpdateItem(index, field, value, quantityTransform);
    } else if (field === 'unit_price') {
      const priceTransform = (item: OrderItemDraft): OrderItemDraft => {
        item.unit_price = Number(value) || 0;
        item.subtotal = item.quantity * item.unit_price;
        return item;
      };
      hookUpdateItem(index, field, value, priceTransform);
    } else {
      hookUpdateItem(index, field, value);
    }
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
          total_value: orderTotal,
          status: 'pendente',
          created_by: user?.id,
          legal_entity_id: legalEntityId || null,
          ipi_mode: ipiMode,
          order_type: orderType,
          subtotal_products: orderSubtotalProducts,
          total_ipi: orderTotalIpi,
          carrier_id: carrierId || null,
          freight_type: freightType || null,
          delivery_same_as_company: deliverySameAsCompany,
          delivery_name: !deliverySameAsCompany ? deliveryFields.name || null : null,
          delivery_address: !deliverySameAsCompany ? deliveryFields.address || null : null,
          delivery_number: !deliverySameAsCompany ? deliveryFields.number || null : null,
          delivery_neighborhood: !deliverySameAsCompany ? deliveryFields.neighborhood || null : null,
          delivery_city: !deliverySameAsCompany ? deliveryFields.city || null : null,
          delivery_state: !deliverySameAsCompany ? deliveryFields.state || null : null,
          delivery_zip_code: !deliverySameAsCompany ? deliveryFields.zip_code || null : null,
          delivery_contact: !deliverySameAsCompany ? deliveryFields.contact || null : null,
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
          calculated_price_source: item.calculated_price_source || 'MANUAL',
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
          total_value: orderTotal,
          legal_entity_id: legalEntityId || null,
          ipi_mode: ipiMode,
          order_type: orderType,
          subtotal_products: orderSubtotalProducts,
          total_ipi: orderTotalIpi,
          carrier_id: carrierId || null,
          freight_type: freightType || null,
          delivery_same_as_company: deliverySameAsCompany,
          delivery_name: !deliverySameAsCompany ? deliveryFields.name || null : null,
          delivery_address: !deliverySameAsCompany ? deliveryFields.address || null : null,
          delivery_number: !deliverySameAsCompany ? deliveryFields.number || null : null,
          delivery_neighborhood: !deliverySameAsCompany ? deliveryFields.neighborhood || null : null,
          delivery_city: !deliverySameAsCompany ? deliveryFields.city || null : null,
          delivery_state: !deliverySameAsCompany ? deliveryFields.state || null : null,
          delivery_zip_code: !deliverySameAsCompany ? deliveryFields.zip_code || null : null,
          delivery_contact: !deliverySameAsCompany ? deliveryFields.contact || null : null,
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
      const orderItems = items.map((item, index) => {
        const ipiRate = ipiMode === 'isento' ? 0 : (item.ipi_rate || 0);
        const ipiVal = calculateIpiValue(item.subtotal, ipiRate, ipiMode);
        const totalItem = calculateItemTotal(item.subtotal, ipiVal, ipiMode);
        return {
          order_id: order.id,
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
          calculated_price_source: item.calculated_price_source || 'MANUAL',
        };
      });

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
    // Validate carrier is required when freight type is CIF or FOB
    if ((freightType === 'CIF' || freightType === 'FOB') && !carrierId) {
      toast.error('Transportadora é obrigatória quando o tipo de frete é CIF ou FOB');
      return;
    }

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
          <SearchableSelect
            options={(companies || []).map(c => ({ value: c.id, label: c.name }))}
            value={companyId || null}
            onChange={(v) => { setCompanyId(v || ''); if (v && !order) autoFillFromCompany(v); }}
            placeholder="Selecione uma empresa"
            searchPlaceholder="Buscar empresa..."
            disabled={!canEdit}
            onSearchChange={setOrderCompanySearch}
          />
        </div>
        <div className="space-y-2">
          <Label>Contato</Label>
          <SearchableSelect
            options={(contacts || []).map(c => ({ value: c.id, label: `${c.first_name} ${c.last_name || ''}`.trim() }))}
            value={contactId || null}
            onChange={(v) => setContactId(v || '')}
            placeholder="Selecione um contato"
            searchPlaceholder="Buscar contato..."
            disabled={!canEdit}
            onSearchChange={setOrderContactSearch}
          />
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

      {/* Tipo do Pedido */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Tipo do Pedido</Label>
          <Select value={orderType} onValueChange={(v) => setOrderType(v as OrderType)} disabled={!canEdit}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(orderTypeConfig).map(([value, config]) => (
                <SelectItem key={value} value={value}>{config.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* IPI Mode Selector */}
        <div className="space-y-2">
          <Label>Modo IPI</Label>
          <Select value={ipiMode} onValueChange={(v) => setIpiMode(v as IpiMode)} disabled={!canEdit}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ipiModeConfig).map(([value, config]) => (
                <SelectItem key={value} value={value}>{config.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{ipiModeConfig[ipiMode].description}</p>
        </div>
      </div>

      {canEdit && (
        <div className="space-y-2">
          <Label>Adicionar Produto</Label>
          <div className="flex gap-2">
            <SearchableSelect
              value={selectedProductId}
              onChange={(v) => setSelectedProductId(v || '')}
              placeholder="Buscar produto por nome ou SKU..."
              searchPlaceholder="Digite para buscar..."
              emptyMessage="Nenhum produto encontrado"
              className="flex-1"
              onSearchChange={setProductSearch}
              options={(products ?? []).map((product) => ({
                value: product.id,
                label: `${product.sku} - ${product.name}`,
              }))}
            />
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
                <TableHead className="w-28 text-right">Subtotal</TableHead>
                {ipiMode !== 'isento' && (
                  <>
                    <TableHead className="w-20 text-right">IPI %</TableHead>
                    <TableHead className="w-28 text-right">IPI R$</TableHead>
                  </>
                )}
                <TableHead className="w-32 text-right">Total</TableHead>
                {canEdit && <TableHead className="w-12"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, index) => {
                const product = products?.find(p => p.id === item.product_id);
                const ipiRate = ipiMode === 'isento' ? 0 : (item.ipi_rate || 0);
                const ipiVal = calculateIpiValue(item.subtotal, ipiRate, ipiMode);
                const totalItem = calculateItemTotal(item.subtotal, ipiVal, ipiMode);
                
                return (
                  <TableRow key={index}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{item.description}</p>
                        <p className="text-sm text-muted-foreground font-mono">{product?.sku}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Input type="number" min="1" value={item.quantity} onChange={(e) => updateItem(index, 'quantity', e.target.value)} className="w-20" disabled={!canEdit} />
                    </TableCell>
                    <TableCell>
                      <div className="relative">
                        <CurrencyInput value={item.unit_price} onChange={(val) => updateItem(index, 'unit_price', val)} onBlur={() => handlePriceBlur(index)} className={cn('w-28', hasPricingTable && !isAdmin && 'bg-muted')} disabled={(hasPricingTable && !isAdmin) || !canEdit} />
                        {hasPricingTable && (<DollarSign className={cn('absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4', isAdmin ? 'text-amber-500' : 'text-muted-foreground')} />)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.discount_percent > 0 && (<span className="text-primary font-medium">{item.discount_percent}%</span>)}
                    </TableCell>
                    <TableCell className="text-right font-medium text-sm">{formatCurrency(item.subtotal)}</TableCell>
                    {ipiMode !== 'isento' && (
                      <>
                        <TableCell className="text-right text-sm">{ipiRate.toFixed(2)}%</TableCell>
                        <TableCell className="text-right text-sm">{formatCurrency(ipiVal)}</TableCell>
                      </>
                    )}
                    <TableCell className="text-right font-bold text-sm">{formatCurrency(totalItem)}</TableCell>
                    {canEdit && (
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => removeItem(index)}>
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

      {/* Totals */}
      {items.length > 0 && (
        <div className="flex justify-end">
          <div className="text-right p-4 bg-muted rounded-lg space-y-1">
            <div className="flex justify-between gap-8 text-sm">
              <span className="text-muted-foreground">Subtotal Produtos:</span>
              <span>{formatCurrency(orderCalculateSubtotalProducts())}</span>
            </div>
            {ipiMode !== 'isento' && (
              <div className="flex justify-between gap-8 text-sm">
                <span className="text-muted-foreground">IPI Total {ipiMode === 'incluso' ? '(informativo)' : ''}:</span>
                <span>{formatCurrency(orderCalculateTotalIpi())}</span>
              </div>
            )}
            <div className="flex justify-between gap-8 pt-1 border-t">
              <span className="text-muted-foreground font-medium">Valor Total:</span>
              <span className="text-2xl font-bold">{formatCurrency(orderCalculateTotal())}</span>
            </div>
          </div>
        </div>
      )}

      {/* ===== LOGÍSTICA ===== */}
      <div className="space-y-4 border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <Truck className="h-4 w-4 text-muted-foreground" />
          <Label className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Logística</Label>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Transportadora</Label>
            <SearchableSelect
              options={carrierOptions}
              value={carrierId || null}
              onChange={(v) => setCarrierId(v || '')}
              placeholder="Selecione uma transportadora"
              searchPlaceholder="Buscar transportadora..."
              disabled={!canEdit}
              onSearchChange={setCarrierSearch}
            />
          </div>
          <div className="space-y-2">
            <Label>Tipo de Frete</Label>
            <Select value={freightType} onValueChange={setFreightType} disabled={!canEdit}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo de frete" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CIF">CIF — Frete por conta do vendedor</SelectItem>
                <SelectItem value="FOB">FOB — Frete por conta do cliente</SelectItem>
                <SelectItem value="REDESPACHO">Redespacho</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Delivery Address */}
        <div className="space-y-3 pt-2 border-t">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <Label className="text-sm font-semibold">Endereço de Entrega</Label>
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" checked={deliverySameAsCompany} onChange={() => setDeliverySameAsCompany(true)} disabled={!canEdit} />
              <span className="text-sm">Mesmo endereço do cliente</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" checked={!deliverySameAsCompany} onChange={() => setDeliverySameAsCompany(false)} disabled={!canEdit} />
              <span className="text-sm">Outro endereço</span>
            </label>
          </div>
          {!deliverySameAsCompany && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Nome do Local</Label>
                <Input value={deliveryFields.name} onChange={(e) => setDeliveryFields(f => ({ ...f, name: e.target.value }))} placeholder="Ex: CD São Paulo" disabled={!canEdit} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Endereço</Label>
                <Input value={deliveryFields.address} onChange={(e) => setDeliveryFields(f => ({ ...f, address: e.target.value }))} disabled={!canEdit} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Número</Label>
                <Input value={deliveryFields.number} onChange={(e) => setDeliveryFields(f => ({ ...f, number: e.target.value }))} disabled={!canEdit} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Bairro</Label>
                <Input value={deliveryFields.neighborhood} onChange={(e) => setDeliveryFields(f => ({ ...f, neighborhood: e.target.value }))} disabled={!canEdit} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cidade</Label>
                <Input value={deliveryFields.city} onChange={(e) => setDeliveryFields(f => ({ ...f, city: e.target.value }))} disabled={!canEdit} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Estado</Label>
                <Input value={deliveryFields.state} onChange={(e) => setDeliveryFields(f => ({ ...f, state: e.target.value }))} maxLength={2} disabled={!canEdit} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">CEP</Label>
                <Input value={deliveryFields.zip_code} onChange={(e) => setDeliveryFields(f => ({ ...f, zip_code: e.target.value }))} disabled={!canEdit} />
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Contato no Local</Label>
                <Input value={deliveryFields.contact} onChange={(e) => setDeliveryFields(f => ({ ...f, contact: e.target.value }))} placeholder="Nome e telefone do contato" disabled={!canEdit} />
              </div>
            </div>
          )}
        </div>
      </div>

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
      <DialogContent className="max-w-[80vw] max-h-[90vh] overflow-y-auto">
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
                orderType={(order!.order_type as OrderType) || 'producao'}
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
