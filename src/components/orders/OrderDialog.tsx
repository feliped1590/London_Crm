import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { NumberInput } from '@/components/ui/NumberInput';
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

import { ShoppingCart, Plus, Trash2, CalendarIcon, DollarSign, Edit, Lock, LockOpen, CheckCircle2, History, Search, Copy, Paperclip } from 'lucide-react';
import { AttachmentManager } from '@/components/attachments/AttachmentManager';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { OrderItemDetailModal } from './OrderItemDetailModal';
import { InlineCustomerEditSheet } from './InlineCustomerEditSheet';
import type { OrderItemDraft, ProductLookup } from '@/types/documents';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/formatters';
import { formatCNPJ } from '@/lib/cpfCnpjMask';
import { calculateIpiValue, calculateItemTotal } from '@/utils/pricing/ipiCalculations';
import { calculatePackagingPrice } from '@/utils/pricing/packagingPricing';
import { getEffectiveDimensions } from '@/utils/products/effectiveDimensions';
import { useDocumentItems } from '@/hooks/useDocumentItems';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useLegalEntities } from '@/hooks/useLegalEntities';
import { useAuth } from '@/hooks/useAuth';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import { PriceOverrideModal } from '@/components/proposals/PriceOverrideModal';
import { Order, OrderStatus, OrderType, IpiMode, ipiModeConfig, orderStatusConfig, orderTypeConfig } from '@/types/products';
import { getEffectiveProductIpiRate } from '@/utils/pricing/ipiRate';
import { OrderApprovalActions } from './OrderApprovalActions';
import { OrderApprovalTimeline } from './OrderApprovalTimeline';
import { OrderHistoryTab } from './OrderHistoryTab';
import { DocumentTotals } from '@/components/documents/DocumentTotals';
import { DocumentLogisticsSection, EMPTY_DELIVERY_FIELDS, buildLogisticsPayload, extractLogisticsFromRecord } from '@/components/documents/DocumentLogisticsSection';
import { useProductAdd } from '@/components/documents/ProductSelector';
import { usePriceValidation } from '@/modules/documents';
import { usePortfolioProtection } from '@/hooks/usePortfolioProtection';
import { PortfolioProtectionModal } from '@/components/customers/PortfolioProtectionModal';
import { ProductSearchModal } from '@/components/products/ProductSearchModal';
import { useRecentProducts } from '@/hooks/useRecentProducts';
import { useProductSimpleSearch } from '@/hooks/useProductSearch';
import { PaymentConditionsEditor, validatePaymentConditions, type PaymentConditionDraft } from './PaymentConditionsEditor';
import { loadPaymentConditions, persistPaymentConditions } from '@/hooks/usePaymentConditions';
import { OrderGovernanceBanner } from './OrderGovernanceBanner';
import { GovernancePreflightModal } from './GovernancePreflightModal';
import { useActiveTenantId } from '@/hooks/useActiveTenantId';
import { runGovernancePreflight, useGovernanceFlags, type PreflightResult } from '@/hooks/useCommercialGovernance';
import { useFormDraft } from '@/workspace/useFormDraft';
import { DraftRestoreDialog } from '@/workspace/DraftRestoreDialog';




const MAX_ITEM_OBSERVATION_LENGTH = 1000;

const normalizeItemObservation = (value?: string | null) => {
  const normalized = (value || '').replace(/[<>]/g, '').trim();
  return normalized ? normalized.slice(0, MAX_ITEM_OBSERVATION_LENGTH) : null;
};

const relationshipLabels: Record<string, string> = {
  INTEREST: 'Interesse',
  HOMOLOGATED: 'Homologado',
  RECURRENT: 'Recorrente',
  STRATEGIC: 'Estratégico',
  BLACKLIST: 'Bloqueado',
};

type LinkedCompanyProduct = ProductLookup & {
  relationship_type?: string | null;
  is_preferred?: boolean | null;
  last_interaction_at?: string | null;
};

const ORDER_TYPE_OPTIONS: OrderType[] = ['Novo/Alteração', 'Repeticao', 'Pronto Entrega'];

const SALE_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'venda_tributada', label: 'Venda Tributada' },
  { value: 'bonificacao', label: 'Bonificação' },
  { value: 'remessa_amostra', label: 'Remessa de Amostra' },
];

interface OrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order?: Order | null;
  onSuccess?: () => void;
  preSelectedCompanyId?: string | null;
  canClone?: boolean;
}


export function OrderDialog({ open, onOpenChange, order, onSuccess, preSelectedCompanyId, canClone = false }: OrderDialogProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isAdmin, hasFullAccess } = useModulePermissions();
  const hasOrdersFullAccess = isAdmin || hasFullAccess('orders');
  const { accessibleEntities, activeLegalEntityId, hasEntities: hasLegalEntities } = useLegalEntities();

  const isEditMode = !!order;
  const [customerEditOpen, setCustomerEditOpen] = useState(false);

  // Entity-level lock is now the source of truth.
  // canEdit = false when the order is locked (only status changes via approval flow allowed)
  const isOrderLocked = !!order?.is_locked;
  const canEdit = useMemo(() => {
    if (!order) return true;
    if (isOrderLocked) return false; // Locked orders are read-only (status changes happen via approval actions)
    if (order.status === 'pendente') return true;
    return hasOrdersFullAccess;
  }, [order, hasOrdersFullAccess, isOrderLocked]);
  // canUnlock is computed later (depends on portfolio protection hook)

  const [companyId, setCompanyId] = useState('');
  const [contactId, setContactId] = useState('');
  const [deliveryDate, setDeliveryDate] = useState<Date | undefined>();
  const [deliveryDateOpen, setDeliveryDateOpen] = useState(false);
  const [observations, setObservations] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [legalEntityId, setLegalEntityId] = useState('');
  const [ipiMode, setIpiMode] = useState<IpiMode>('destacar');
  const [orderType, setOrderType] = useState<OrderType>('Novo/Alteração');
  const [originalItems, setOriginalItems] = useState<OrderItemDraft[]>([]);
  const [advancedSearchOpen, setAdvancedSearchOpen] = useState(false);
  const { addRecent } = useRecentProducts();
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [paymentConditions, setPaymentConditions] = useState<PaymentConditionDraft[]>([]);
  const [originalPaymentConditions, setOriginalPaymentConditions] = useState<PaymentConditionDraft[]>([]);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailItemIndex, setDetailItemIndex] = useState<number>(-1);
  const [showExitAlert, setShowExitAlert] = useState(false);
  const [showLockUnsavedAlert, setShowLockUnsavedAlert] = useState(false);
  const [showCloneAlert, setShowCloneAlert] = useState(false);
  // Vínculo opcional ao negócio (Fase 2)
  const [dealId, setDealId] = useState<string>('');

  // Snapshot do estado original (para detectar alterações pendentes)
  interface OrderSnapshot {
    companyId: string; contactId: string; deliveryDate: string; observations: string;
    legalEntityId: string; ipiMode: string; orderType: string;
    paymentMethod: string; paymentTerms: string; dealId: string;
    carrierId: string; freightType: string; deliverySameAsCompany: boolean;
    deliveryFields: typeof EMPTY_DELIVERY_FIELDS;
    saleType: string; redespachoCarrierId: string;
  }
  const [originalSnapshot, setOriginalSnapshot] = useState<OrderSnapshot | null>(null);

  // Logistics state
  const [carrierId, setCarrierId] = useState('');
  const [freightType, setFreightType] = useState('');
  const [deliverySameAsCompany, setDeliverySameAsCompany] = useState(true);
  const [deliveryFields, setDeliveryFields] = useState(EMPTY_DELIVERY_FIELDS);
  const [redespachoCarrierId, setRedespachoCarrierId] = useState('');

  // Tipo de Venda (header sovereign — propagado a todos os itens)
  const [saleType, setSaleType] = useState<string>('venda_tributada');

  // Follow-up modal (somente em criação manual)
  const [followupOpen, setFollowupOpen] = useState(false);
  const [followupText, setFollowupText] = useState('');
  const [carrierSearchOrder, setCarrierSearchOrder] = useState('');

  // Preflight de governança comercial
  const { data: tenantId } = useActiveTenantId();
  const { flags: governanceFlags } = useGovernanceFlags();
  const [preflightOpen, setPreflightOpen] = useState(false);
  const [preflightResult, setPreflightResult] = useState<PreflightResult | null>(null);
  const [preflightSubmitting, setPreflightSubmitting] = useState(false);


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

  // Peso previsto por item: (largura × comprimento × espessura) / 1000 × quantidade
  const getItemWeight = useCallback((item: OrderItemDraft) => {
    const w = Number(item.width) || 0;
    const l = Number(item.length) || 0;
    const t = Number(item.thickness) || 0;
    const qty = Number(item.quantity) || 0;
    if (w <= 0 || l <= 0 || t <= 0 || qty <= 0) return 0;
    return ((w * l * t) / 1000) * qty;
  }, []);
  const orderTotalWeight = useMemo(
    () => items.reduce((sum, it) => sum + getItemWeight(it), 0),
    [items, getItemWeight],
  );

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

  const { data: carriersList = [] } = useQuery({
    queryKey: ['carriers-order-dialog', carrierSearchOrder],
    queryFn: async () => {
      let q = supabase.from('carriers').select('id, name, trade_name, erp_code').eq('active', true).order('name').limit(50);
      if (carrierSearchOrder) q = q.ilike('name', `%${carrierSearchOrder}%`);
      const { data } = await q;
      return (data || []) as Array<{ id: string; name: string; trade_name: string | null; erp_code: number | null }>;
    },
  });

  const { data: selectedCarriers = [] } = useQuery({
    queryKey: ['carriers-order-dialog-selected', carrierId, redespachoCarrierId],
    queryFn: async () => {
      const ids = [carrierId, redespachoCarrierId].filter(Boolean) as string[];
      if (ids.length === 0) return [];
      const { data } = await supabase.from('carriers').select('id, name, trade_name, erp_code').in('id', ids);
      return (data || []) as Array<{ id: string; name: string; trade_name: string | null; erp_code: number | null }>;
    },
    enabled: !!(carrierId || redespachoCarrierId),
  });

  const carrierOptionsOrder = useMemo(() => {
    const map = new Map<string, { id: string; name: string; trade_name: string | null; erp_code: number | null }>();
    [...carriersList, ...selectedCarriers].forEach(c => map.set(c.id, c));
    return Array.from(map.values()).map(c => ({
      value: c.id,
      label: (c.trade_name ? `${c.trade_name} (${c.name})` : c.name) + (c.erp_code != null ? ` — ERP ${c.erp_code}` : ' — sem ERP'),
    }));
  }, [carriersList, selectedCarriers]);


  const { data: companiesRaw } = useQuery({
    queryKey: ['companies-search-orders', orderCompanySearch],
    queryFn: async (): Promise<Array<{ id: string; name: string; cnpj: string | null }>> => {
      let query = supabase.from('companies').select('id, name, cnpj').order('name').limit(50);
      if (orderCompanySearch) query = query.or(`name.ilike.%${orderCompanySearch}%,fantasia.ilike.%${orderCompanySearch}%,cnpj.ilike.%${orderCompanySearch}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: orderCompanyData } = useQuery({
    queryKey: ['order-company', order?.company_id],
    queryFn: async () => {
      if (!order?.company_id) return null;
      const { data, error } = await supabase.from('companies').select('id, name, cnpj').eq('id', order.company_id).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!order?.company_id,
  });

  const { data: selectedOrderCompany } = useQuery({
    queryKey: ['order-company-selected', companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data, error } = await supabase.from('companies').select('id, name, cnpj').eq('id', companyId).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId && companyId !== order?.company_id,
  });

  const companies = useMemo(() => {
    const map = new Map<string, { id: string; name: string; cnpj: string | null }>();
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

  const { data: linkedCompanyProducts = [], isLoading: isLoadingLinkedProducts } = useQuery({
    queryKey: ['order-linked-company-products', companyId, productSearch],
    queryFn: async (): Promise<LinkedCompanyProduct[]> => {
      if (!companyId) return [];
      const search = productSearch.trim();

      let query = supabase
        .from('company_products')
        .select(`
          relationship_type,
          is_preferred,
          last_interaction_at,
          product:products(
            id,
            sku,
            name,
            tipo_id,
            unit_price,
            width,
            length,
            thickness,
            aliquota_ipi,
            ncm:ncm_codes(aliquota_ipi_oficial),
            fator_kg,
            unit_measure,
            ficha_tecnica,
            active
          )
        `)
        .eq('company_id', companyId)
        .is('archived_at', null)
        .order('is_preferred', { ascending: false })
        .order('last_interaction_at', { ascending: false, nullsFirst: false });

      const { data, error } = await query;
      if (error) throw error;

      const normalizedSearch = search.toLowerCase();

      return (data ?? [])
        .map((link: any) => ({
          ...(link.product ?? {}),
          relationship_type: link.relationship_type,
          is_preferred: link.is_preferred,
          last_interaction_at: link.last_interaction_at,
        }))
        .filter((product: any) => product.id && product.active !== false)
        .filter((product: any) => !normalizedSearch || product.name?.toLowerCase().includes(normalizedSearch) || product.sku?.toLowerCase().includes(normalizedSearch)) as LinkedCompanyProduct[];
    },
    enabled: !!companyId,
  });

  const productOptions = useMemo(() => {
    const source = companyId ? linkedCompanyProducts : products;
    return (source ?? []).map((p: LinkedCompanyProduct) => {
      const relationship = p.relationship_type ? relationshipLabels[p.relationship_type] || p.relationship_type : null;
      const details = [p.is_preferred ? 'Preferencial' : null, relationship].filter(Boolean).join(' • ');
      return {
        value: p.id,
        label: `${p.sku} - ${p.name}`,
        searchTerms: details || undefined,
      };
    });
  }, [companyId, linkedCompanyProducts, products]);

  const productEmptyMessage = companyId
    ? isLoadingLinkedProducts
      ? 'Carregando produtos vinculados...'
      : 'Nenhum produto vinculado ao cliente. Use a pesquisa avançada para buscar na lista geral.'
    : 'Nenhum produto encontrado';

  // Deals da empresa selecionada (vínculo opcional Fase 2)
  // Filtra também por legal_entity_id ativo para evitar cruzamento entre CNPJs.
  const { data: companyDeals = [] } = useQuery({
    queryKey: ['order-deals-by-company', companyId, activeLegalEntityId],
    queryFn: async (): Promise<Array<{ id: string; name: string }>> => {
      if (!companyId) return [];
      let query = supabase
        .from('deals')
        .select('id, name, legal_entity_id')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (activeLegalEntityId) {
        // Aceita deals da legal entity ativa OU sem vínculo (NULL = global).
        query = query.or(`legal_entity_id.eq.${activeLegalEntityId},legal_entity_id.is.null`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map((d) => ({ id: d.id, name: d.name }));
    },
    enabled: !!companyId,
  });

  const { data: existingOrderItems } = useQuery({
    queryKey: ['order_items_for_edit', order?.id],
    queryFn: async (): Promise<OrderItemDraft[]> => {
      if (!order) return [];
      const { data, error } = await supabase
        .from('order_items')
        .select('*, product:products(id, sku, erp_product_code, name, tipo_id, unit_price, width, length, thickness, aliquota_ipi, fator_kg, unit_measure, ficha_tecnica, ncm:ncm_codes(aliquota_ipi_oficial))')
        .eq('order_id', order.id)
        .order('sort_order');
      if (error) throw error;
      return (data ?? []).map((item: any) => ({
        id: item.id, product_id: item.product_id || '', product_code: item.product?.sku || item.product?.erp_product_code || '',
        description: item.description,
        observations: item.observations || '',
        observations_pcp: item.observations_pcp || '',
        ordem_compra: item.ordem_compra || '',
        quantity: item.quantity, unit_price: item.unit_price, subtotal: item.subtotal,
        discount_percent: item.discount_percent || 0, ipi_rate: item.ipi_rate || 0,
        commission_pct: item.commission_pct || 0,
        fator_kg: item.fator_kg ?? item.product?.fator_kg ?? 0,
        unit_measure: item.unit_measure ?? item.product?.unit_measure ?? '',
        width: item.width || undefined, length: item.length || undefined, thickness: item.thickness || undefined,
        is_locked: item.is_locked || false,
        product: item.product || null,
      }));
    },
    enabled: !!order?.id && open,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const { data: existingPaymentConditions } = useQuery({
    queryKey: ['order_payment_conditions', order?.id],
    queryFn: async () => order?.id ? loadPaymentConditions('order', order.id) : [],
    enabled: !!order?.id && open,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // --- Mutations ---
  const createOrderMutation = useMutation<any, Error, { skipAutoSync?: boolean } | void>({
    mutationFn: async () => {
      if (items.length === 0) throw new Error('Adicione pelo menos um item ao pedido');
      if (!companyId && !contactId) throw new Error('Selecione uma empresa ou contato');

      const condErr = validatePaymentConditions(paymentConditions, orderTotal);
      if (condErr) throw new Error(condErr);

      // Sincroniza os campos legados com a 1ª condição (manter compat com fallback do mapper)
      const firstCond = paymentConditions[0];
      const legacyMethod = firstCond?.payment_method || paymentMethod || null;
      const legacyTerms = paymentConditions.length > 0
        ? paymentConditions.map(c => c.dias).join('/')
        : (paymentTerms || null);

      const { data: newOrder, error: orderError } = await supabase.from('orders').insert({
        number: '', company_id: companyId || null, contact_id: contactId || null,
        deal_id: dealId || null, // Vínculo opcional Fase 2
        delivery_date: deliveryDate?.toISOString().split('T')[0] || null,
        observations, total_value: orderTotal, status: 'pendente', created_by: user?.id,
        legal_entity_id: legalEntityId || null, ipi_mode: ipiMode, order_type: orderType,
        subtotal_products: orderSubtotalProducts, total_ipi: orderTotalIpi,
        payment_method: legacyMethod, payment_terms: legacyTerms,
        sale_type: saleType || 'venda_tributada',
        redespacho_carrier_id: redespachoCarrierId || null,
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
          observations: normalizeItemObservation(item.observations),
          observations_pcp: normalizeItemObservation(item.observations_pcp),
          ordem_compra: (item.ordem_compra || '').trim() || null,
          quantity: item.quantity, unit_price: item.unit_price, subtotal: item.subtotal,
          discount_percent: item.discount_percent, ipi_rate: ipiRate, ipi_value: ipiVal,
          subtotal_item: item.subtotal, total_item: totalItem, width: item.width,
          length: item.length, thickness: item.thickness, sort_order: index,
          calculated_price_source: item.calculated_price_source || 'MANUAL',
          commission_pct: item.commission_pct || 0,
          fator_kg: Math.max(0, Number(item.fator_kg) || 0),
          is_locked: false, // legacy field
        };
      });
      const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
      if (itemsError) throw itemsError;

      // Persiste condições de pagamento (multi-formas)
      if (paymentConditions.length > 0) {
        await persistPaymentConditions('order', newOrder.id, paymentConditions);
      }

      // Persiste Follow-up para Faturamento (entrado via modal antes do submit)
      const followupTrim = (followupText || '').trim();
      if (followupTrim) {
        let erpUserCode: number | null = null;
        if (user?.id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('erp_user_code')
            .eq('user_id', user.id)
            .maybeSingle();
          erpUserCode = profile?.erp_user_code ? Number(profile.erp_user_code) : null;
        }
        await (supabase as any).from('order_followups').insert({
          order_id: newOrder.id,
          tenant_id: (newOrder as any).tenant_id ?? null,
          sequencia: 1,
          tipo: 1,
          texto: followupTrim,
          created_by: user?.id || null,
          erp_user_code: erpUserCode,
        });
      }


      await supabase.from('order_audit_log').insert({
        order_id: newOrder.id, field_name: 'created', field_label: 'Pedido criado',
        old_value: null, new_value: `Pedido ${newOrder.number} criado manualmente`,
        changed_by: user?.id || null,
      });
      return newOrder;
    },
    onSuccess: async (newOrder: any, variables) => {
      const skipAutoSync = !!(variables && (variables as any).skipAutoSync);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      if (skipAutoSync) {
        toast.success('Pedido criado — aguardando aprovação de governança');
      } else {
        toast.success('Pedido criado — enviando ao ERP em segundo plano');
        // Auto-disparo de sincronização (igual aos produtos)
        try {
          await (supabase as any).from('order_sync_queue').insert({
            order_id: newOrder.id,
            status: 'pending',
            attempt_count: 0,
            error_message: null,
            next_retry_at: null,
            validation_errors: null,
            validation_fields: null,
          });
          queryClient.invalidateQueries({ queryKey: ['order_sync_status', newOrder.id] });
          supabase.functions.invoke('process-order-sync', { body: { order_id: newOrder.id } }).catch(() => {});
        } catch {}
      }

      if (!skipAutoSync) {
        orderDraft.clear();
        onOpenChange(false);
        onSuccess?.();
      } else {
        orderDraft.clear();
      }
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

  const updateOrderMutation = useMutation<unknown, Error, { silent?: boolean; keepOpen?: boolean; skipAutoSync?: boolean } | void>({
    mutationFn: async () => {
      if (!order) throw new Error('Pedido não encontrado');
      if (items.length === 0) throw new Error('Adicione pelo menos um item ao pedido');
      if (!companyId && !contactId) throw new Error('Selecione uma empresa ou contato');

      const condErr = validatePaymentConditions(paymentConditions, orderTotal);
      if (condErr) throw new Error(condErr);

      const firstCond = paymentConditions[0];
      const legacyMethod = firstCond?.payment_method || paymentMethod || null;
      const legacyTerms = paymentConditions.length > 0
        ? paymentConditions.map(c => c.dias).join('/')
        : (paymentTerms || null);

      const { error: orderError } = await supabase.from('orders').update({
        company_id: companyId || null, contact_id: contactId || null,
        deal_id: dealId || null, // Vínculo opcional Fase 2
        delivery_date: deliveryDate?.toISOString().split('T')[0] || null,
        observations, total_value: orderTotal, legal_entity_id: legalEntityId || null,
        ipi_mode: ipiMode, order_type: orderType,
        subtotal_products: orderSubtotalProducts, total_ipi: orderTotalIpi,
        payment_method: legacyMethod, payment_terms: legacyTerms,
        sale_type: saleType || 'venda_tributada',
        redespacho_carrier_id: redespachoCarrierId || null,
        ...buildLogisticsPayload(carrierId, freightType, deliverySameAsCompany, deliveryFields),
      }).eq('id', order.id);
      if (orderError) throw orderError;

      await persistPaymentConditions('order', order.id, paymentConditions);

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
          observations: normalizeItemObservation(item.observations),
          observations_pcp: normalizeItemObservation(item.observations_pcp),
          ordem_compra: (item.ordem_compra || '').trim() || null,
          quantity: item.quantity, unit_price: item.unit_price, subtotal: item.subtotal,
          discount_percent: item.discount_percent, ipi_rate: ipiRate, ipi_value: ipiVal,
          subtotal_item: item.subtotal, total_item: totalItem, width: item.width,
          length: item.length, thickness: item.thickness, sort_order: index,
          calculated_price_source: item.calculated_price_source || 'MANUAL',
          commission_pct: item.commission_pct || 0,
          fator_kg: Math.max(0, Number(item.fator_kg) || 0),
          is_locked: false, // legacy field — no longer used as business rule
        };
      });
      const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
      if (itemsError) throw itemsError;
      return order;
    },
    onSuccess: async (_data, variables) => {
      const opts = variables || {};
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order_items'] });
      queryClient.invalidateQueries({ queryKey: ['order_items_for_edit', order?.id] });
      queryClient.invalidateQueries({ queryKey: ['order_audit_log'] });

      // Auto re-sync em TODA atualização (igual produtos) — salvo skipAutoSync
      if (order && !opts.skipAutoSync) {
        try {
          const { data: existing } = await supabase
            .from('order_sync_queue')
            .select('id')
            .eq('order_id', order.id)
            .maybeSingle();

          if (existing) {
            await supabase.from('order_sync_queue')
              .update({ status: 'pending' as any, attempt_count: 0, error_message: null, next_retry_at: null, validation_errors: null, validation_fields: null })
              .eq('id', existing.id);
          } else {
            await (supabase as any).from('order_sync_queue').insert({
              order_id: order.id,
              status: 'pending',
              attempt_count: 0,
              error_message: null,
              next_retry_at: null,
            });
          }

          queryClient.invalidateQueries({ queryKey: ['order_sync_status', order.id] });
          queryClient.invalidateQueries({ queryKey: ['order_sync_status_btn', order.id] });

          // Fire-and-forget
          supabase.functions.invoke('process-order-sync', {
            body: { order_id: order.id },
          }).catch(() => {});
        } catch {}
      }

      // Atualiza o snapshot para refletir o estado salvo (evita falso "alterações pendentes")
      setOriginalSnapshot(buildCurrentSnapshot());
      setOriginalItems([...items]);

      if (!opts.silent) toast.success('Pedido salvo — enviando ao ERP em segundo plano');
      if (!opts.keepOpen) {
        orderDraft.clear();
        onOpenChange(false);
        onSuccess?.();
      } else {
        orderDraft.clear();
      }
    },
    onError: (error: Error) => {
      const message = error?.message || '';
      if (message.includes('Este cliente pertence ao vendedor')) toast.error(message, { duration: 6000 });
      else toast.error(message || 'Erro ao atualizar pedido');
    },
  });

  // --- Lock / Unlock mutations (entity-level) ---
  // Quando chamado com { skipSave: true } pula o save (já foi salvo) e aplica o lock direto.
  const lockOrderMutation = useMutation<unknown, Error, { skipSave?: boolean } | void>({
    mutationFn: async (variables) => {
      const opts = variables || {};
      if (!order) throw new Error('Pedido não encontrado');
      if (items.length === 0) throw new Error('Adicione pelo menos um item ao pedido antes de bloquear');
      if (!companyId && !contactId) throw new Error('Selecione uma empresa ou contato');

      // 1) Persiste alterações pendentes (a menos que já tenham sido salvas)
      if (!opts.skipSave) {
        const toastId = toast.loading('Salvando alterações...');
        try {
          await updateOrderMutation.mutateAsync({ keepOpen: true, silent: true });
          toast.success('Alterações salvas. Aplicando bloqueio...', { id: toastId });
        } catch (err) {
          toast.dismiss(toastId);
          throw err;
        }
      }

      // 2) Aplica o lock no banco
      const { data, error } = await supabase.rpc('lock_order', { p_order_id: order.id });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order_audit_log'] });
      toast.success('Pedido bloqueado com sucesso');
      orderDraft.clear();
      onOpenChange(false);
      onSuccess?.();
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

  const cloneOrderMutation = useMutation({
    mutationFn: async () => {
      if (!order) throw new Error('Pedido não encontrado');
      if (!user?.id) throw new Error('Usuário não autenticado');
      if (items.length === 0) throw new Error('Pedido sem itens para clonar');

      const { data: newOrder, error: orderError } = await supabase.from('orders').insert({
        number: '',
        company_id: companyId || null,
        contact_id: contactId || null,
        deal_id: dealId || null,
        delivery_date: deliveryDate?.toISOString().split('T')[0] || null,
        observations,
        total_value: orderTotal,
        status: 'pendente',
        created_by: user.id,
        legal_entity_id: legalEntityId || null,
        ipi_mode: ipiMode,
        order_type: orderType,
        subtotal_products: orderSubtotalProducts,
        total_ipi: orderTotalIpi,
        payment_method: paymentMethod || null,
        payment_terms: paymentTerms || null,
        sale_type: saleType || 'venda_tributada',
        redespacho_carrier_id: redespachoCarrierId || null,
        ...buildLogisticsPayload(carrierId, freightType, deliverySameAsCompany, deliveryFields),
      }).select().single();
      if (orderError) throw orderError;

      const clonedItems = items.map((item, index) => {
        const ipiRate = ipiMode === 'isento' ? 0 : (item.ipi_rate || 0);
        const ipiVal = calculateIpiValue(item.subtotal, ipiRate, ipiMode);
        const totalItem = calculateItemTotal(item.subtotal, ipiVal, ipiMode);
        return {
          order_id: newOrder.id,
          product_id: item.product_id,
          description: item.description,
          observations: normalizeItemObservation(item.observations),
          observations_pcp: normalizeItemObservation(item.observations_pcp),
          ordem_compra: (item.ordem_compra || '').trim() || null,
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
          commission_pct: item.commission_pct || 0,
          fator_kg: Math.max(0, Number(item.fator_kg) || 0),
          is_locked: false,
        };
      });

      const { error: itemsError } = await supabase.from('order_items').insert(clonedItems);
      if (itemsError) throw itemsError;

      // Clona condições de pagamento
      if (paymentConditions.length > 0) {
        await persistPaymentConditions('order', newOrder.id, paymentConditions);
      }

      await supabase.from('order_audit_log').insert({
        order_id: newOrder.id,
        field_name: 'cloned',
        field_label: 'Pedido clonado',
        old_value: order.number,
        new_value: `Pedido ${newOrder.number} clonado a partir do pedido ${order.number}`,
        changed_by: user.id,
      });

      return newOrder;
    },
    onSuccess: (newOrder: any) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order_items'] });
      queryClient.invalidateQueries({ queryKey: ['order_audit_log'] });
      toast.success(`Pedido ${newOrder?.number || ''} clonado com sucesso!`);
      setShowCloneAlert(false);
      onSuccess?.();
    },
    onError: (err: Error) => toast.error(err.message || 'Erro ao clonar pedido'),
  });

  // --- Snapshot helpers (detecção de alterações pendentes) ---
  const buildCurrentSnapshot = useCallback((): OrderSnapshot => ({
    companyId, contactId,
    deliveryDate: deliveryDate?.toISOString().split('T')[0] || '',
    observations: observations || '',
    legalEntityId: legalEntityId || '',
    ipiMode, orderType,
    paymentMethod: paymentMethod || '',
    paymentTerms: paymentTerms || '',
    dealId: dealId || '',
    carrierId: carrierId || '',
    freightType: freightType || '',
    deliverySameAsCompany,
    deliveryFields,
    saleType: saleType || 'venda_tributada',
    redespachoCarrierId: redespachoCarrierId || '',
  }), [companyId, contactId, deliveryDate, observations, legalEntityId, ipiMode, orderType, paymentMethod, paymentTerms, dealId, carrierId, freightType, deliverySameAsCompany, deliveryFields, saleType, redespachoCarrierId]);

  const itemsChanged = useCallback((): boolean => {
    if (items.length !== originalItems.length) return true;
    const norm = (it: OrderItemDraft) => ({
      id: it.id || '', product_id: it.product_id, quantity: it.quantity,
      unit_price: it.unit_price, discount_percent: it.discount_percent || 0,
      ipi_rate: it.ipi_rate || 0, commission_pct: it.commission_pct || 0,
      fator_kg: it.fator_kg || 0,
      description: it.description,
      observations: it.observations || '',
      observations_pcp: it.observations_pcp || '',
      ordem_compra: it.ordem_compra || '',
    });
    const origMap = new Map(originalItems.map(o => [o.id || '', norm(o)]));
    for (const it of items) {
      const orig = origMap.get(it.id || '');
      if (!orig) return true;
      const cur = norm(it);
      if (JSON.stringify(orig) !== JSON.stringify(cur)) return true;
    }
    return false;
  }, [items, originalItems]);

  const hasUnsavedChanges = useCallback((): boolean => {
    if (!originalSnapshot) return items.length > 0;
    const cur = buildCurrentSnapshot();
    if (JSON.stringify(cur) !== JSON.stringify(originalSnapshot)) return true;
    return itemsChanged();
  }, [originalSnapshot, buildCurrentSnapshot, itemsChanged, items.length]);

  // -------- Workspace v1: rascunho persistido --------
  type OrderDraftData = {
    snap: OrderSnapshot;
    items: OrderItemDraft[];
    paymentConditions: PaymentConditionDraft[];
  };
  const draftContext = open
    ? (isEditMode && order ? `orders:${order.id}` : 'orders:new')
    : null;
  const currentDraftData = useMemo<OrderDraftData>(() => ({
    snap: buildCurrentSnapshot(),
    items,
    paymentConditions,
  }), [buildCurrentSnapshot, items, paymentConditions]);
  const draftEnabled = open && !isOrderLocked && canEdit && (!isEditMode || existingOrderItems !== undefined);
  const orderDraft = useFormDraft<OrderDraftData>({
    context: draftContext,
    enabled: draftEnabled,
    baseline: order?.updated_at ? { updatedAt: order.updated_at } : null,
    title: isEditMode ? `Pedido ${order?.number ?? ''}` : 'Novo pedido',
    buildSnapshot: () => currentDraftData,
    applyDraft: (data) => {
      try {
        const s = data?.snap;
        if (s) {
          setCompanyId(s.companyId || '');
          setContactId(s.contactId || '');
          setDeliveryDate(s.deliveryDate ? new Date(`${s.deliveryDate}T00:00:00`) : undefined);
          setObservations(s.observations || '');
          setLegalEntityId(s.legalEntityId || '');
          setIpiMode((s.ipiMode as IpiMode) || 'destacar');
          setOrderType((s.orderType as OrderType) || 'Novo/Alteração');
          setPaymentMethod(s.paymentMethod || '');
          setPaymentTerms(s.paymentTerms || '');
          setDealId(s.dealId || '');
          setCarrierId(s.carrierId || '');
          setFreightType(s.freightType || '');
          setDeliverySameAsCompany(!!s.deliverySameAsCompany);
          setDeliveryFields(s.deliveryFields || EMPTY_DELIVERY_FIELDS);
          setSaleType(s.saleType || 'venda_tributada');
          setRedespachoCarrierId(s.redespachoCarrierId || '');
        }
        if (Array.isArray(data?.items)) setItems(data.items);
        if (Array.isArray(data?.paymentConditions)) setPaymentConditions(data.paymentConditions);
      } catch (err) {
        console.warn('[OrderDialog] applyDraft falhou', err);
      }
    },
  });
  const draftDataJson = JSON.stringify(currentDraftData);
  const prevDraftJsonRef = useRef<string | null>(null);
  useEffect(() => {
    if (!open) { prevDraftJsonRef.current = null; return; }
    if (!orderDraft.decided) return;
    if (prevDraftJsonRef.current === null) { prevDraftJsonRef.current = draftDataJson; return; }
    if (prevDraftJsonRef.current !== draftDataJson) {
      prevDraftJsonRef.current = draftDataJson;
      orderDraft.markDirty();
    }
  }, [open, orderDraft.decided, draftDataJson, orderDraft]);

  const handleLockClick = useCallback(() => {
    if (hasUnsavedChanges()) {
      setShowLockUnsavedAlert(true);
      return;
    }
    lockOrderMutation.mutate({ skipSave: true });
  }, [hasUnsavedChanges, lockOrderMutation]);

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
      setOrderType((order as any).order_type || 'Novo/Alteração');
      setPaymentMethod((order as any).payment_method || '');
      setPaymentTerms((order as any).payment_terms || '');
      const logistics = extractLogisticsFromRecord(order);
      setCarrierId(logistics.carrierId);
      setFreightType(logistics.freightType);
      setDeliverySameAsCompany(logistics.deliverySameAsCompany);
      setDeliveryFields(logistics.deliveryFields);
      setDealId((order as any).deal_id || '');
      setSaleType((order as any).sale_type || 'venda_tributada');
      setRedespachoCarrierId((order as any).redespacho_carrier_id || '');
    } else if (open && !order) {
      setSaleType('venda_tributada');
      setRedespachoCarrierId('');
      setLegalEntityId(activeLegalEntityId || '');
      setDealId('');
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
    if (!open || !order?.id) return;
    if (existingPaymentConditions === undefined) return;
    setPaymentConditions(existingPaymentConditions);
    setOriginalPaymentConditions(existingPaymentConditions);
  }, [open, order?.id, existingPaymentConditions]);

  // Captura snapshot do estado original assim que o pedido carrega (após hidratação dos campos).
  useEffect(() => {
    if (!open || !order?.id) return;
    if (existingOrderItems === undefined) return; // aguarda items carregarem
    setOriginalSnapshot({
      companyId: order.company_id || '',
      contactId: order.contact_id || '',
      deliveryDate: order.delivery_date ? new Date(order.delivery_date).toISOString().split('T')[0] : '',
      observations: order.observations || '',
      legalEntityId: (order as any).legal_entity_id || activeLegalEntityId || '',
      ipiMode: (order as any).ipi_mode || 'destacar',
      orderType: (order as any).order_type || 'Novo/Alteração',
      paymentMethod: (order as any).payment_method || '',
      paymentTerms: (order as any).payment_terms || '',
      dealId: (order as any).deal_id || '',
      saleType: (order as any).sale_type || 'venda_tributada',
      redespachoCarrierId: (order as any).redespacho_carrier_id || '',
      ...extractLogisticsFromRecord(order),
    });
  }, [open, order, existingOrderItems, activeLegalEntityId]);

  useEffect(() => {
    if (!open) {
      setCompanyId(''); setContactId(''); setDeliveryDate(undefined); setObservations('');
      setItems([]); setOriginalItems([]); setSelectedProductId('');
      setLegalEntityId(''); setOrderType('Novo/Alteração');
      setCarrierId(''); setFreightType('');
      setRedespachoCarrierId(''); setSaleType('venda_tributada');
      setFollowupOpen(false); setFollowupText('');
      setDeliverySameAsCompany(true); setDeliveryFields(EMPTY_DELIVERY_FIELDS);
      setPaymentMethod(''); setPaymentTerms('');
      setPaymentConditions([]); setOriginalPaymentConditions([]);
      setDealId('');
      setOriginalSnapshot(null);
      setDetailModalOpen(false); setDetailItemIndex(-1);
      setShowExitAlert(false); setShowLockUnsavedAlert(false);
    }
  }, [open]);

  useEffect(() => {
    if (!companyFiscalData || items.length === 0) return;
    setItems(prev => {
      let changed = false;
      const next = prev.map(item => {
      if (!item.product_id) return item;
      const product =
        linkedCompanyProducts.find(p => p.id === item.product_id) ||
        products?.find(p => p.id === item.product_id) ||
        item.product;
      if (!product) return item;
      const nextIpiRate = companyFiscalData.contribuinte_ipi ? getEffectiveProductIpiRate(product) : 0;
      if ((item.ipi_rate || 0) === nextIpiRate && item.product === product) return item;
      changed = true;
      return { ...item, product, ipi_rate: nextIpiRate };
      });
      return changed ? next : prev;
    });
  }, [companyFiscalData, linkedCompanyProducts, products, items.length, setItems]);

  // --- Handlers ---
  const addProductById = useCallback((productId: string, productData?: any) => {
    const product = productData || linkedCompanyProducts.find(p => p.id === productId) || products?.find(p => p.id === productId);
    if (!product) return;
    const { unitPrice, discountPercent, priceSource, ipiRate } = resolveProductPricing(product, ipiMode);
    // Snapshot armazena as dimensões EFETIVAS (base + sanfona) para que cálculos
    // posteriores no item permaneçam coerentes mesmo sem a ficha técnica disponível.
    const eff = getEffectiveDimensions(product);
    addItem({
      product_id: product.id, product_code: product.sku || product.erp_code || '', description: product.name, quantity: 1,
      observations: '', observations_pcp: '',
      unit_price: unitPrice, subtotal: unitPrice, discount_percent: discountPercent,
      ipi_rate: ipiRate, commission_pct: 0, fator_kg: product.fator_kg || 0, unit_measure: product.unit_measure || '',
      width: eff.width || undefined,
      length: eff.length || undefined,
      thickness: eff.thickness || undefined,
      calculated_price_source: priceSource, is_locked: false, product,
    });
    addRecent(product.id);
    setSelectedProductId('');
  }, [linkedCompanyProducts, products, ipiMode, resolveProductPricing, addItem, addRecent]);

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
    } else if (field === 'fator_kg') {
      hookUpdateItem(index, field, value, (item: OrderItemDraft): OrderItemDraft => {
        item.fator_kg = Math.max(0, Number(value) || 0);
        const calc = calculatePackagingPrice({
          unit_measure: item.unit_measure,
          unit_price: item.unit_price,
          fator_kg: item.fator_kg,
          width: item.width,
          length: item.length,
          thickness: item.thickness,
        });
        if (calc > 0) {
          item.unit_price = calc;
          item.subtotal = item.quantity * item.unit_price;
        }
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
  } = usePortfolioProtection(order?.company_id || companyId || undefined);

  // Pode desbloquear: admin OU (acesso total ao módulo Pedidos + cliente da carteira/delegado)
  const canUnlock = isOrderLocked && hasOrdersFullAccess && (isAdmin || !isPortfolioBlocked);

  // Follow-up é persistido dentro da própria mutation (antes da fila de sync).
  const performCreate = useCallback(async () => {
    await createOrderMutation.mutateAsync();
  }, [createOrderMutation]);

  // Continuação do submit após validação de governança
  const proceedAfterPreflight = useCallback(() => {
    if (isEditMode) {
      updateOrderMutation.mutate();
    } else {
      setFollowupText('');
      setFollowupOpen(true);
    }
  }, [isEditMode, updateOrderMutation]);

  // Cria solicitações de aprovação para as exceções detectadas
  const createApprovalRequestsForOrder = useCallback(async (
    orderId: string,
    pre: PreflightResult,
    justification: string,
  ) => {
    const calls: Array<PromiseLike<any>> = [];
    if (pre.commissionExceptions.length > 0) {
      const requested = { items: pre.commissionExceptions.map((s) => ({ id: s.order_item_id, product_id: s.product_id, applied_pct: s.applied_pct, max_pct: s.max_pct })) };
      const max = { items: pre.commissionExceptions.map((s) => ({ id: s.order_item_id, product_id: s.product_id, max_pct: s.max_pct })) };
      calls.push(supabase.rpc('create_commercial_approval_request', {
        _order_id: orderId,
        _order_item_id: null,
        _request_type: 'commission',
        _justification: justification,
        _requested_value: requested as any,
        _max_allowed: max as any,
        _rule_id: pre.commissionExceptions[0].rule_id,
      }));
    }
    if (pre.paymentException) {
      calls.push(supabase.rpc('create_commercial_approval_request', {
        _order_id: orderId,
        _order_item_id: null,
        _request_type: 'payment_terms',
        _justification: justification,
        _requested_value: {
          applied_template_id: pre.paymentException.applied_template_id,
          applied_template_name: pre.paymentException.applied_template_name,
          applied_rank: pre.paymentException.applied_rank,
          current_max_dias: pre.paymentException.current_max_dias,
        } as any,
        _max_allowed: { max_rank: pre.paymentException.max_template_rank } as any,
        _rule_id: pre.paymentException.rule_id,
      }));
    }
    await Promise.all(calls);

  }, []);

  const handleRequestAuthorization = useCallback(async (justification: string) => {
    if (!preflightResult) return;
    setPreflightSubmitting(true);
    try {
      let orderId: string | null = null;
      if (isEditMode && order) {
        await updateOrderMutation.mutateAsync({ keepOpen: true, silent: true, skipAutoSync: true });
        orderId = order.id;
      } else {
        const created: any = await createOrderMutation.mutateAsync({ skipAutoSync: true });
        orderId = created?.id ?? null;
      }
      if (orderId) {
        await createApprovalRequestsForOrder(orderId, preflightResult, justification);
        // Safety net: bloqueia qualquer entrada residual da fila enquanto aprovação está pendente
        try {
          await (supabase as any).from('order_sync_queue')
            .update({
              status: 'permanent_failure',
              error_message: 'Aguardando aprovação de governança',
              next_retry_at: null,
              updated_at: new Date().toISOString(),
            })
            .eq('order_id', orderId)
            .in('status', ['pending','blocked_validation','processing','error','failed']);
        } catch {}
        toast.success('Pedido salvo e enviado para aprovação');
        queryClient.invalidateQueries({ queryKey: ['governance', 'pending_requests'] });
        queryClient.invalidateQueries({ queryKey: ['order_sync_status', orderId] });
        queryClient.invalidateQueries({ queryKey: ['orders'] });
      }
      setPreflightOpen(false);
      setPreflightResult(null);
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao solicitar autorização');
    } finally {
      setPreflightSubmitting(false);
    }
  }, [preflightResult, isEditMode, order, updateOrderMutation, createOrderMutation, createApprovalRequestsForOrder, queryClient, onOpenChange, onSuccess]);

  const handleSubmit = async () => {
    // Check portfolio protection before submitting
    if (!checkAccess()) return;
    if (!priceValidation.validateBeforeSubmit()) return;

    // Preflight de governança comercial (comissão + parcelamento)
    if (tenantId) {
      try {
        // Sales rep efetivo: pedido > empresa
        let salesRepId: string | null = (order as any)?.sales_rep_id ?? null;
        if (!salesRepId && companyId) {
          const { data: comp } = await supabase
            .from('companies')
            .select('sales_rep_id')
            .eq('id', companyId)
            .maybeSingle();
          salesRepId = (comp as any)?.sales_rep_id ?? null;
        }
        const pre = await runGovernancePreflight({
          tenantId,
          salesRepId,
          companyId: companyId || null,
          legalEntityId: legalEntityId || null,
          items: items
            .filter((i) => i.product_id)
            .map((i) => ({
              order_item_id: i.id ?? null,
              product_id: i.product_id!,
              description: i.description ?? null,
              commission_pct: Number(i.commission_pct || 0),
            })),
          totalAmount: orderTotal,
          paymentConditions: paymentConditions.map((c) => ({
            dias: Number(c.dias) || 0,
            tipo: c.tipo,
            percentual: c.percentual ?? null,
            valor: c.valor ?? null,
            payment_method: c.payment_method ?? null,
          })),
        });
        if (pre.hasAny) {
          // Se já existem aprovações para este pedido, suprimir exceções já aprovadas
          let filtered = pre;
          if (isEditMode && (order as any)?.id) {
            const { data: approved } = await supabase
              .from('order_approval_requests')
              .select('request_type')
              .eq('order_id', (order as any).id)
              .eq('status', 'approved');
            const approvedKinds = new Set((approved ?? []).map((a: any) => a.request_type));
            filtered = {
              ...pre,
              commissionExceptions: approvedKinds.has('commission') ? [] : pre.commissionExceptions,
              paymentException: approvedKinds.has('payment_terms') ? null : pre.paymentException,
            } as PreflightResult;
            filtered.hasAny = filtered.commissionExceptions.length > 0 || !!filtered.paymentException;
          }
          if (filtered.hasAny) {
            setPreflightResult(filtered);
            setPreflightOpen(true);
            return;
          }
        }
      } catch (err) {
        // Preflight não deve bloquear o fluxo em caso de erro de rede; loga e segue.
        // eslint-disable-next-line no-console
        console.warn('[governance preflight]', err);
      }
    }

    proceedAfterPreflight();
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

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Empresa</Label>
          {companyId && (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={() => setCustomerEditOpen(true)}
            >
              <Edit className="h-3 w-3 mr-1" /> Editar cliente
            </Button>
          )}
        </div>
        <SearchableSelect
          options={(companies || []).map(c => ({ value: c.id, label: c.cnpj ? `${c.name} — ${formatCNPJ(c.cnpj)}` : c.name }))}
          value={companyId || null}
          onChange={(v) => { setCompanyId(v || ''); if (v && !order) autoFillFromCompany(v).then(data => { if (data?.default_carrier_id) setCarrierId(data.default_carrier_id); if (data?.default_freight_type) setFreightType(data.default_freight_type); }); }}
          placeholder="Selecione uma empresa" searchPlaceholder="Buscar empresa..."
          disabled={!canEdit} onSearchChange={setOrderCompanySearch}
        />
      </div>
      <InlineCustomerEditSheet
        companyId={companyId}
        open={customerEditOpen}
        onOpenChange={setCustomerEditOpen}
      />


      {/* Vínculo opcional ao negócio (Fase 2) + Data de Entrega lado a lado */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Vincular ao Negócio (opcional)</Label>
          <SearchableSelect
            options={[
              { value: '__NONE__', label: 'Sem vínculo' },
              ...companyDeals.map(d => ({ value: d.id, label: d.name })),
            ]}
            value={dealId || '__NONE__'}
            onChange={(v) => setDealId(v === '__NONE__' ? '' : (v || ''))}
            placeholder={companyId ? 'Selecione um negócio' : 'Selecione uma empresa primeiro'}
            searchPlaceholder="Buscar negócio..."
            disabled={!canEdit || !companyId}
          />
          <p className="text-xs text-muted-foreground">
            Vincular ao negócio permite que o pipeline controle o status deste pedido (quando configurado).
          </p>
        </div>

        <div className="space-y-2">
          <Label>Data de Entrega</Label>
          <Popover open={deliveryDateOpen} onOpenChange={setDeliveryDateOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !deliveryDate && 'text-muted-foreground')} disabled={!canEdit}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {deliveryDate ? format(deliveryDate, 'PPP', { locale: ptBR }) : 'Selecione uma data'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={deliveryDate}
                onSelect={(date) => { setDeliveryDate(date); setDeliveryDateOpen(false); }}
                locale={ptBR}
                initialFocus
                className={cn('p-3 pointer-events-auto')}
              />
            </PopoverContent>
          </Popover>
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

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Tipo do Pedido</Label>
          <Select value={orderType} onValueChange={(v) => setOrderType(v as OrderType)} disabled={!canEdit}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ORDER_TYPE_OPTIONS.map((value) => {
                const config = orderTypeConfig[value];
                return (
                <SelectItem key={value} value={value}>{config.label}</SelectItem>
                );
              })}
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

      <PaymentConditionsEditor
        value={paymentConditions}
        onChange={setPaymentConditions}
        totalAmount={orderTotal}
        disabled={!canEdit}
        companyId={companyId || null}
        salesRepId={(order as any)?.sales_rep_id ?? null}
        legalEntityId={legalEntityId || null}
      />

      {canEdit && (

        <div className="space-y-2">
          <Label>Adicionar Produto</Label>
          <div className="flex gap-2">
            <SearchableSelect
              value={selectedProductId} onChange={(v) => setSelectedProductId(v || '')}
              placeholder={companyId ? 'Produtos vinculados ao cliente...' : 'Buscar produto por nome ou SKU...'} searchPlaceholder="Digite para buscar..."
              emptyMessage={productEmptyMessage} className="flex-1" onSearchChange={setProductSearch}
              options={productOptions}
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
                <TableHead className="w-32">Qtd</TableHead>
                <TableHead className="w-32">Preço Unit.</TableHead>
                <TableHead className="w-28">Fator KG</TableHead>
                <TableHead className="w-24 text-right">Peso (kg)</TableHead>
                <TableHead className="w-28 text-right">Subtotal</TableHead>
                {ipiMode !== 'isento' && (
                  <>
                    <TableHead className="w-20 text-right">IPI %</TableHead>
                    <TableHead className="w-28 text-right">IPI R$</TableHead>
                  </>
                )}
                <TableHead className="w-24 text-right">Com %</TableHead>
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
                const itemWeight = getItemWeight(item);
                return (
                  <TableRow key={index}>
                    <TableCell>
                      <div
                        className="cursor-pointer hover:underline"
                        onClick={() => { setDetailItemIndex(index); setDetailModalOpen(true); }}
                      >
                        <p className="text-xs text-muted-foreground font-mono">{item.product_code || product?.sku || ''}</p>
                        <p className="font-medium">{item.description}</p>
                        {(item.observations || item.observations_pcp) && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {item.observations && <Badge variant="outline" className="text-[10px]">Obs.</Badge>}
                            {item.observations_pcp && <Badge variant="outline" className="text-[10px]">PCP</Badge>}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <NumberInput
                          value={item.quantity}
                          onChange={(val) => updateItem(index, 'quantity', val ?? 0)}
                          decimals={3}
                          min={0}
                          className="w-24"
                          disabled={!canEdit}
                        />
                        <span className="text-xs text-muted-foreground uppercase whitespace-nowrap">
                          {(item.unit_measure || product?.unit_measure || '').toString()}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="relative">
                        <CurrencyInput value={item.unit_price} onChange={(val) => updateItem(index, 'unit_price', val)} onBlur={() => priceValidation.handlePriceBlur(index)} className={cn('w-28', hasPricingTable && !isAdmin && 'bg-muted')} disabled={(hasPricingTable && !isAdmin) || !canEdit} />
                        {hasPricingTable && (<DollarSign className={cn('absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4', isAdmin ? 'text-amber-500' : 'text-muted-foreground')} />)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <NumberInput
                        value={item.fator_kg ?? 0}
                        onChange={(val) => updateItem(index, 'fator_kg', val ?? 0)}
                        decimals={2}
                        min={0}
                        className="w-28"
                        disabled={!canEdit}
                      />
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {itemWeight > 0
                        ? `${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(itemWeight)} kg`
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right font-medium text-sm">{formatCurrency(item.subtotal)}</TableCell>
                    {ipiMode !== 'isento' && (
                      <>
                        <TableCell className="text-right text-sm">{new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(ipiRate)} %</TableCell>
                        <TableCell className="text-right text-sm">{formatCurrency(ipiVal)}</TableCell>
                      </>
                    )}
                    <TableCell className="text-right">
                      <NumberInput
                        value={item.commission_pct ?? 0}
                        onChange={(val) => updateItem(index, 'commission_pct', val ?? 0)}
                        decimals={2}
                        min={0}
                        max={100}
                        suffix=" %"
                        className="w-24"
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
        <DocumentTotals subtotalProducts={orderSubtotalProducts} totalIpi={orderTotalIpi} total={orderTotal} ipiMode={ipiMode} totalWeight={orderTotalWeight} />
      )}


      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>
            Tipo de Venda <span className="text-destructive">*</span>
          </Label>
          <Select value={saleType} onValueChange={setSaleType} disabled={!canEdit}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o tipo de venda" />
            </SelectTrigger>
            <SelectContent>
              {SALE_TYPE_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Aplica-se a todos os itens do pedido.
          </p>
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
              <SelectItem value="PCIF">PCIF — Próprio CIF</SelectItem>
              <SelectItem value="PFOB">PFOB — Próprio FOB</SelectItem>
              <SelectItem value="SEM">Sem Frete</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Transportadora</Label>
          <SearchableSelect
            options={[{ value: '__NONE__', label: 'Nenhuma' }, ...carrierOptionsOrder]}
            value={carrierId || '__NONE__'}
            onChange={(v) => setCarrierId(v === '__NONE__' ? '' : (v || ''))}
            placeholder="Selecione uma transportadora"
            searchPlaceholder="Buscar transportadora..."
            onSearchChange={setCarrierSearchOrder}
            disabled={!canEdit}
          />
          <p className="text-xs text-muted-foreground">
            Carregada automaticamente da preferida do cliente.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Redespacho (opcional)</Label>
          <SearchableSelect
            options={[{ value: '__NONE__', label: 'Nenhum' }, ...carrierOptionsOrder]}
            value={redespachoCarrierId || '__NONE__'}
            onChange={(v) => setRedespachoCarrierId(v === '__NONE__' ? '' : (v || ''))}
            placeholder="Selecione um redespacho"
            searchPlaceholder="Buscar transportadora..."
            onSearchChange={setCarrierSearchOrder}
            disabled={!canEdit}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Observações</Label>
        <Textarea value={observations} onChange={(e) => setObservations(e.target.value)} placeholder="Observações do pedido..." rows={3} disabled={!canEdit} />
      </div>
    </>
  );

  return (
    <>
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-[95vw] sm:max-w-[90vw] lg:max-w-[80vw] max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEditMode ? <Edit className="h-5 w-5" /> : <ShoppingCart className="h-5 w-5" />}
            {isEditMode
              ? `Editar Pedido ${order?.number}${(order as any)?.erp_order_id ? ` · ERP ${(order as any).erp_order_id}` : ''}`
              : 'Novo Pedido'}
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
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="details">Detalhes</TabsTrigger>
              <TabsTrigger value="approvals" className="flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" />Liberações
              </TabsTrigger>
              <TabsTrigger value="attachments" className="flex items-center gap-1">
                <Paperclip className="h-4 w-4" />Anexos
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
              {isEditMode && order?.id && <OrderGovernanceBanner orderId={order.id} />}
              {renderOrderForm()}

            </TabsContent>

            <TabsContent value="approvals" className="space-y-4 mt-4">
              <OrderApprovalActions orderId={order!.id} orderStatus={order!.status} orderCreatedBy={order!.created_by} orderType={(order!.order_type as OrderType) || 'Novo/Alteração'} />
              <div className="border rounded-lg p-4">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />Histórico de Liberações
                </h4>
                <OrderApprovalTimeline orderId={order!.id} orderStatus={order!.status} />
              </div>
            </TabsContent>

            <TabsContent value="attachments" className="mt-4">
              <AttachmentManager module="pedidos" entityType="order" entityId={order!.id} />
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              <OrderHistoryTab orderId={order!.id} />
            </TabsContent>
          </Tabs>
        ) : (
          <div className="space-y-6">{renderOrderForm()}</div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleDialogClose(false)}>
            {canEdit ? 'Cancelar' : 'Fechar'}
          </Button>
          {isEditMode && canClone && (
            <Button
              variant="outline"
              onClick={() => setShowCloneAlert(true)}
              disabled={cloneOrderMutation.isPending || items.length === 0}
            >
              <Copy className="h-4 w-4 mr-2" />
              {cloneOrderMutation.isPending ? 'Clonando...' : 'Clonar Pedido'}
            </Button>
          )}
          {isEditMode && !isOrderLocked && canEdit && items.length > 0 && (
            <Button
              variant="outline"
              onClick={handleLockClick}
              disabled={lockOrderMutation.isPending || updateOrderMutation.isPending}
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

      <DraftRestoreDialog
        open={orderDraft.restorePending}
        conflict={orderDraft.restoreConflict}
        savedAt={orderDraft.draftSavedAt}
        title={isEditMode ? `Você tem um rascunho deste pedido` : 'Você tem um rascunho de novo pedido'}
        onRestore={orderDraft.acceptRestore}
        onDiscard={orderDraft.discardRestore}
      />
    </Dialog>

    <OrderItemDetailModal
      open={detailModalOpen}
      onOpenChange={setDetailModalOpen}
      item={detailItemIndex >= 0 ? items[detailItemIndex] : null}
      index={detailItemIndex}
      onUpdate={handleItemDetailUpdate}
      canEdit={canEdit}
      companyId={companyId || null}
      salesRepId={(order as any)?.sales_rep_id ?? null}
      legalEntityId={legalEntityId || null}
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

    <AlertDialog open={showLockUnsavedAlert} onOpenChange={setShowLockUnsavedAlert}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Alterações não salvas</AlertDialogTitle>
          <AlertDialogDescription>
            Existem alterações pendentes neste pedido. É necessário salvá-las antes de bloquear.
            Deseja salvar e bloquear agora?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              setShowLockUnsavedAlert(false);
              lockOrderMutation.mutate();
            }}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            <Lock className="h-4 w-4 mr-2" />
            Salvar e Bloquear
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <AlertDialog open={showCloneAlert} onOpenChange={setShowCloneAlert}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Clonar pedido?</AlertDialogTitle>
          <AlertDialogDescription>
            Será criado um novo pedido com os mesmos dados comerciais, logística, pagamento e itens do pedido {order?.number}. O novo pedido será criado como pendente e sem sincronização ERP.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={cloneOrderMutation.isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => cloneOrderMutation.mutate()}
            disabled={cloneOrderMutation.isPending}
          >
            <Copy className="h-4 w-4 mr-2" />
            {cloneOrderMutation.isPending ? 'Clonando...' : 'Confirmar clonagem'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <GovernancePreflightModal
      open={preflightOpen}
      onOpenChange={(o) => { if (!preflightSubmitting) setPreflightOpen(o); }}
      preflight={preflightResult}
      allowCommissionException={governanceFlags?.commission_allow_exception ?? true}
      allowPaymentException={governanceFlags?.payment_terms_allow_exception ?? true}
      isSubmitting={preflightSubmitting}
      onReview={() => { setPreflightOpen(false); setPreflightResult(null); }}
      onRequestAuthorization={handleRequestAuthorization}
    />



    <Dialog open={followupOpen} onOpenChange={(o) => { if (!createOrderMutation.isPending) setFollowupOpen(o); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Follow-up para Faturamento</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label>
            Descrição <span className="text-destructive">*</span>
          </Label>
          <Textarea
            value={followupText}
            onChange={(e) => setFollowupText(e.target.value)}
            placeholder="Instruções para o setor de faturamento..."
            rows={5}
            autoFocus
            disabled={createOrderMutation.isPending}
          />
          <p className="text-xs text-muted-foreground">
            Esta descrição será enviada ao ERP junto com o pedido.
          </p>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setFollowupOpen(false)}
            disabled={createOrderMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={async () => {
              if (!followupText.trim()) {
                toast.error('Descrição é obrigatória');
                return;
              }
              try {
                await performCreate();
                setFollowupOpen(false);
              } catch { /* toast no onError */ }
            }}
            disabled={createOrderMutation.isPending || !followupText.trim()}
          >
            {createOrderMutation.isPending ? 'Criando...' : 'Confirmar criação'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
