import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Plus, Trash2, Package, FileText, Check, X, Download, Link2, Loader2, DollarSign, Lock, AlertCircle, ShieldAlert, ChevronsUpDown, Search, Truck, MapPin } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/formatters';
import { usePricingTables } from '@/hooks/usePricingTables';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import {
  Proposal,
  ProposalItem,
  Product,
  ProposalStatus,
  IpiMode,
  ipiModeConfig,
  proposalStatusConfig,
} from '@/types/products';
import { ApprovalLinkModal } from './ApprovalLinkModal';
import { PriceOverrideModal } from './PriceOverrideModal';
import { useCompanyFiscal } from '@/hooks/useCompanyFiscal';

interface ProposalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: string;
  companyId?: string | null;
  contactId?: string | null;
  proposal?: Proposal | null;
  onSuccess?: () => void;
}

export function ProposalDialog({
  open,
  onOpenChange,
  dealId,
  companyId,
  contactId,
  proposal,
  onSuccess,
}: ProposalDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { isAdmin } = useModulePermissions();
  const { getTableForEntity, getApplicableTable, calculatePrice, validatePriceAgainstTable, pricingTables } = usePricingTables();
  const isEditing = !!proposal;
  const { companyFiscalData } = useCompanyFiscal(companyId);

  // Get linked pricing table based on company or contact (legacy method)
  const linkedPricingTableFromEntity = companyId 
    ? getTableForEntity('company', companyId)
    : contactId 
      ? getTableForEntity('contact', contactId) 
      : null;

  // Check if any pricing table applies (via entity OR product rules OR default)
  const hasPricingTableLinked = linkedPricingTableFromEntity !== null;

  const [formData, setFormData] = useState({
    validity_date: '',
    payment_terms: '',
    delivery_terms: '',
    observations: '',
    status: 'rascunho' as ProposalStatus,
    ipi_mode: 'destacar' as IpiMode,
  });

  const [items, setItems] = useState<Partial<ProposalItem>[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [productSearchOpen, setProductSearchOpen] = useState(false);

  // Approval link states
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalLink, setApprovalLink] = useState('');
  const [approvalExpires, setApprovalExpires] = useState<string | null>(null);
  const [generatingLink, setGeneratingLink] = useState(false);

  // Logistics state
  const [carrierId, setCarrierId] = useState('');
  const [freightType, setFreightType] = useState('');
  const [deliverySameAsCompany, setDeliverySameAsCompany] = useState(true);
  const [deliveryFields, setDeliveryFields] = useState({
    name: '', address: '', number: '', neighborhood: '', city: '', state: '', zip_code: '', contact: '',
  });

  // Carrier search
  const [carrierSearch, setCarrierSearch] = useState('');
  const { data: carriersRaw } = useQuery({
    queryKey: ['carriers-search-proposal', carrierSearch],
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

  // Auto-fill carrier from company default
  const autoFillCarrier = useCallback(async (compId: string) => {
    if (!compId) return;
    const { data } = await supabase.from('companies').select('default_carrier_id').eq('id', compId).maybeSingle();
    if (data?.default_carrier_id) {
      setCarrierId(data.default_carrier_id);
    }
  }, []);

  // Price override modal states (for admin authorization)
  const [showPriceOverrideModal, setShowPriceOverrideModal] = useState(false);
  const [priceChangeConfirmed, setPriceChangeConfirmed] = useState(false);
  // IMPORTANT: useRef to avoid race condition between onConfirm -> onOpenChange(false)
  // (state updates are async and could cause a false revert)
  const priceChangeConfirmedRef = useRef(false);
  const [pendingSubmit, setPendingSubmit] = useState(false);
  const [pendingPriceChange, setPendingPriceChange] = useState<{
    index: number;
    field: 'unit_price' | 'discount_percent';
    value: number;
    itemDescription: string;
    currentPrice: number;
    proposedPrice: number;
    pricingTableName: string;
  } | null>(null);

  // Load proposal data when editing
  useEffect(() => {
    if (proposal) {
      setFormData({
        validity_date: proposal.validity_date || '',
        payment_terms: proposal.payment_terms || '',
        delivery_terms: proposal.delivery_terms || '',
        observations: proposal.observations || '',
        status: proposal.status,
        ipi_mode: (proposal as any).ipi_mode || 'destacar',
      });
      // Logistics
      setCarrierId((proposal as any).carrier_id || '');
      setFreightType((proposal as any).freight_type || '');
      setDeliverySameAsCompany((proposal as any).delivery_same_as_company !== false);
      setDeliveryFields({
        name: (proposal as any).delivery_name || '',
        address: (proposal as any).delivery_address || '',
        number: (proposal as any).delivery_number || '',
        neighborhood: (proposal as any).delivery_neighborhood || '',
        city: (proposal as any).delivery_city || '',
        state: (proposal as any).delivery_state || '',
        zip_code: (proposal as any).delivery_zip_code || '',
        contact: (proposal as any).delivery_contact || '',
      });
    } else {
      // Default validity date: 30 days from now
      const defaultValidity = new Date();
      defaultValidity.setDate(defaultValidity.getDate() + 30);
      setFormData({
        validity_date: defaultValidity.toISOString().split('T')[0],
        payment_terms: '',
        delivery_terms: '',
        observations: '',
        status: 'rascunho',
        ipi_mode: 'destacar',
      });
      setItems([]);
      setCarrierId('');
      setFreightType('');
      setDeliverySameAsCompany(true);
      setDeliveryFields({ name: '', address: '', number: '', neighborhood: '', city: '', state: '', zip_code: '', contact: '' });
      // Auto-fill carrier from company
      if (companyId) {
        autoFillCarrier(companyId);
      }
    }
  }, [proposal, open]);

  // Load proposal items when editing
  const { data: existingItems } = useQuery({
    queryKey: ['proposal_items', proposal?.id],
    queryFn: async () => {
      if (!proposal) return [];
      const { data, error } = await supabase
        .from('proposal_items')
        .select('*, product:products(id, sku, name)')
        .eq('proposal_id', proposal.id)
        .order('sort_order');
      if (error) throw error;
      return data as ProposalItem[];
    },
    enabled: !!proposal,
  });

  useEffect(() => {
    if (existingItems) {
      setItems(existingItems);
    }
  }, [existingItems]);

  // Recalculate IPI rates when company fiscal data changes
  useEffect(() => {
    if (!companyFiscalData || items.length === 0) return;
    setItems(prev =>
      prev.map(item => {
        if (!item.product) return item;
        return {
          ...item,
          ipi_rate: companyFiscalData.contribuinte_ipi
            ? (item.product as any)?.aliquota_ipi || 0
            : 0,
        };
      })
    );
  }, [companyFiscalData]);

  // Fetch deal to get legal_entity_id
  const { data: dealData } = useQuery({
    queryKey: ['deal_legal_entity', dealId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deals')
        .select('legal_entity_id')
        .eq('id', dealId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!dealId,
  });

  const { data: products } = useQuery({
    queryKey: ['products', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('active', true)
        .order('name');
      if (error) throw error;
      return data as unknown as Product[];
    },
  });

  const createProposalMutation = useMutation({
    mutationFn: async () => {
      // Create proposal
      const { data: newProposal, error: proposalError } = await supabase
        .from('proposals')
        .insert({
          number: '', // Will be auto-generated by trigger
          deal_id: dealId,
          company_id: companyId,
          contact_id: contactId,
          legal_entity_id: dealData?.legal_entity_id || null,
          status: formData.status,
          validity_date: formData.validity_date || null,
          payment_terms: formData.payment_terms || null,
          delivery_terms: formData.delivery_terms || null,
          observations: formData.observations || null,
          total_value: calculateTotal(),
          ipi_mode: formData.ipi_mode,
          subtotal_products: calculateSubtotalProducts(),
          total_ipi: calculateTotalIpi(),
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
        } as any)
        .select()
        .single();

      if (proposalError) throw proposalError;

      // Create items
      if (items.length > 0) {
        const ipiMode = formData.ipi_mode;
        const itemsToInsert = items.map((item, index) => {
          const sub = calculateItemSubtotal(item);
          const ipiRate = ipiMode === 'isento' ? 0 : (item.ipi_rate || 0);
          const ipiVal = calculateIpiValue(sub, ipiRate, ipiMode);
          const totalItem = calculateItemTotal(sub, ipiVal, ipiMode);
          return {
            proposal_id: newProposal.id,
            product_id: item.product_id || null,
            description: item.description || '',
            quantity: item.quantity || 1,
            unit_price: item.unit_price || 0,
            width: item.width || null,
            length: item.length || null,
            thickness: item.thickness || null,
            discount_percent: item.discount_percent || 0,
            subtotal: sub,
            ipi_rate: ipiRate,
            ipi_value: ipiVal,
            subtotal_item: sub,
            total_item: totalItem,
            sort_order: index,
          };
        });

        const { error: itemsError } = await supabase
          .from('proposal_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      // If created as approved, also create order
      if (formData.status === 'aprovada') {
        await createOrderFromProposal(newProposal.id);
      }

      return newProposal;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Proposta criada com sucesso!');
      onOpenChange(false);
      onSuccess?.();
    },
    onError: () => toast.error('Erro ao criar proposta'),
  });

  const updateProposalMutation = useMutation({
    mutationFn: async () => {
      if (!proposal) return;

      // Update proposal
      const { error: proposalError } = await supabase
        .from('proposals')
        .update({
          status: formData.status,
          validity_date: formData.validity_date || null,
          payment_terms: formData.payment_terms || null,
          delivery_terms: formData.delivery_terms || null,
          observations: formData.observations || null,
          total_value: calculateTotal(),
          ipi_mode: formData.ipi_mode,
          subtotal_products: calculateSubtotalProducts(),
          total_ipi: calculateTotalIpi(),
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
        .eq('id', proposal.id);

      if (proposalError) throw proposalError;

      // Delete existing items and recreate
      await supabase.from('proposal_items').delete().eq('proposal_id', proposal.id);

      if (items.length > 0) {
        const ipiMode = formData.ipi_mode;
        const itemsToInsert = items.map((item, index) => {
          const sub = calculateItemSubtotal(item);
          const ipiRate = ipiMode === 'isento' ? 0 : (item.ipi_rate || 0);
          const ipiVal = calculateIpiValue(sub, ipiRate, ipiMode);
          const totalItem = calculateItemTotal(sub, ipiVal, ipiMode);
          return {
            proposal_id: proposal.id,
            product_id: item.product_id || null,
            description: item.description || '',
            quantity: item.quantity || 1,
            unit_price: item.unit_price || 0,
            width: item.width || null,
            length: item.length || null,
            thickness: item.thickness || null,
            discount_percent: item.discount_percent || 0,
            subtotal: sub,
            ipi_rate: ipiRate,
            ipi_value: ipiVal,
            subtotal_item: sub,
            total_item: totalItem,
            sort_order: index,
          };
        });

        const { error: itemsError } = await supabase
          .from('proposal_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      // If approved, create order
      if (formData.status === 'aprovada' && proposal.status !== 'aprovada') {
        await createOrderFromProposal(proposal.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Proposta atualizada!');
      onOpenChange(false);
      onSuccess?.();
    },
    onError: () => toast.error('Erro ao atualizar proposta'),
  });

  const createOrderFromProposal = async (proposalId: string) => {
    // Get proposal data
    const { data: proposalData } = await supabase
      .from('proposals')
      .select('*')
      .eq('id', proposalId)
      .single();

    if (!proposalData) return;

    // Create order
    const { data: newOrder, error: orderError } = await supabase
      .from('orders')
      .insert({
        number: '', // Will be auto-generated by trigger
        proposal_id: proposalId,
        company_id: proposalData.company_id,
        contact_id: proposalData.contact_id,
        status: 'pendente',
        total_value: proposalData.total_value,
        observations: proposalData.observations,
        ipi_mode: proposalData.ipi_mode || 'destacar',
        subtotal_products: proposalData.subtotal_products || 0,
        total_ipi: proposalData.total_ipi || 0,
        // Copy logistics from proposal
        carrier_id: proposalData.carrier_id || null,
        freight_type: proposalData.freight_type || null,
        delivery_same_as_company: proposalData.delivery_same_as_company ?? true,
        delivery_name: proposalData.delivery_name || null,
        delivery_address: proposalData.delivery_address || null,
        delivery_number: proposalData.delivery_number || null,
        delivery_neighborhood: proposalData.delivery_neighborhood || null,
        delivery_city: proposalData.delivery_city || null,
        delivery_state: proposalData.delivery_state || null,
        delivery_zip_code: proposalData.delivery_zip_code || null,
        delivery_contact: proposalData.delivery_contact || null,
      } as any)
      .select()
      .single();

    if (orderError) throw orderError;

    // Get proposal items
    const { data: proposalItems } = await supabase
      .from('proposal_items')
      .select('*')
      .eq('proposal_id', proposalId);

    if (proposalItems && proposalItems.length > 0) {
      const orderItems = proposalItems.map((item: any) => ({
        order_id: newOrder.id,
        product_id: item.product_id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        width: item.width,
        length: item.length,
        thickness: item.thickness,
        subtotal: item.subtotal,
        sort_order: item.sort_order,
        ipi_rate: item.ipi_rate || 0,
        ipi_value: item.ipi_value || 0,
        subtotal_item: item.subtotal_item || item.subtotal,
        total_item: item.total_item || item.subtotal,
      }));

      await supabase.from('order_items').insert(orderItems);
    }

    // Move deal to "fechado_ganho" if proposal is linked to a deal
    if (proposalData.deal_id) {
      const { error: dealUpdateError } = await supabase
        .from('deals')
        .update({
          stage: 'fechado_ganho',
          closed_at: new Date().toISOString(),
        })
        .eq('id', proposalData.deal_id);

      if (!dealUpdateError) {
        // Record in deal audit log
        await supabase.from('deal_audit_log').insert({
          deal_id: proposalData.deal_id,
          field_name: 'stage',
          field_label: 'Etapa',
          old_value: null, // We don't have previous stage here
          new_value: 'fechado_ganho',
          changed_by: user?.id,
        });

        toast.success('Negócio movido para Fechado Ganho!');
      }
    }

    toast.success('Pedido gerado automaticamente!');
  };

  const calculateItemSubtotal = (item: Partial<ProposalItem>) => {
    const qty = item.quantity || 1;
    const price = item.unit_price || 0;
    const discount = item.discount_percent || 0;
    return qty * price * (1 - discount / 100);
  };

  const calculateIpiValue = (subtotalItem: number, ipiRate: number, ipiMode: IpiMode) => {
    if (ipiMode === 'isento' || ipiRate <= 0) return 0;
    if (ipiMode === 'destacar') return subtotalItem * (ipiRate / 100);
    if (ipiMode === 'incluso') return subtotalItem * (ipiRate / (100 + ipiRate));
    return 0;
  };

  const calculateItemTotal = (subtotalItem: number, ipiValue: number, ipiMode: IpiMode) => {
    if (ipiMode === 'destacar') return subtotalItem + ipiValue;
    return subtotalItem; // incluso and isento: total = subtotal
  };

  const calculateTotal = () => {
    const ipiMode = formData.ipi_mode;
    let subtotalProducts = 0;
    let totalIpi = 0;
    
    items.forEach(item => {
      const sub = calculateItemSubtotal(item);
      const ipiRate = ipiMode === 'isento' ? 0 : (item.ipi_rate || 0);
      const ipiVal = calculateIpiValue(sub, ipiRate, ipiMode);
      subtotalProducts += sub;
      totalIpi += ipiVal;
    });

    if (ipiMode === 'destacar') return subtotalProducts + totalIpi;
    return subtotalProducts;
  };

  const calculateTotalIpi = () => {
    const ipiMode = formData.ipi_mode;
    let totalIpi = 0;
    items.forEach(item => {
      const sub = calculateItemSubtotal(item);
      const ipiRate = ipiMode === 'isento' ? 0 : (item.ipi_rate || 0);
      totalIpi += calculateIpiValue(sub, ipiRate, ipiMode);
    });
    return totalIpi;
  };

  const calculateSubtotalProducts = () => {
    return items.reduce((sum, item) => sum + calculateItemSubtotal(item), 0);
  };

  const addProductToItems = () => {
    if (!selectedProductId) return;

    const product = products?.find((p) => p.id === selectedProductId);
    if (!product) return;

    let unitPrice = product.unit_price || 0;
    let discountPercent = 0;

    // Apply pricing table rules using hierarchy: Entity > Product > Default
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
        1, // initial quantity
        product.unit_price || 0
      );
      unitPrice = finalPrice;
      if (rule?.discount_percent) {
        discountPercent = rule.discount_percent;
      }
    }

    const isContribuinteIpi = companyId && companyFiscalData
      ? companyFiscalData.contribuinte_ipi
      : true;
    const ipiRate = isContribuinteIpi ? (product.aliquota_ipi || 0) : 0;

    setItems([
      ...items,
      {
        product_id: product.id,
        description: product.name,
        quantity: 1,
        unit_price: unitPrice,
        width: product.width,
        length: product.length,
        thickness: product.thickness,
        discount_percent: discountPercent,
        subtotal: unitPrice,
        ipi_rate: ipiRate,
        product: product,
      },
    ]);
    setSelectedProductId('');
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Helper to validate price on blur - now allows editing but validates afterwards
  const handlePriceBlur = (index: number, field: 'unit_price' | 'discount_percent') => {
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
      updatedItems[index].subtotal = calculateItemSubtotal({ ...updatedItems[index], unit_price: validation.expectedPrice });
      setItems(updatedItems);
      return;
    }

    // Admin: show authorization modal
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
  };

  // Direct item update without authorization check
  const updateItemDirect = (index: number, field: keyof ProposalItem, value: any) => {
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    updatedItems[index].subtotal = calculateItemSubtotal(updatedItems[index]);
    setItems(updatedItems);
  };

  // Handle price override confirmation from admin
  const handlePriceOverrideConfirm = async (justification: string) => {
    if (!pendingPriceChange) return;

    const { index, currentPrice, proposedPrice } = pendingPriceChange;
    const item = items[index];

    // Mark confirmed BEFORE any async operation to prevent race condition
    // with onOpenChange(false) reverting the price
    priceChangeConfirmedRef.current = true;
    setPriceChangeConfirmed(true);

    // Record the override in deal_audit_log
    try {
      await supabase.from('deal_audit_log').insert({
        deal_id: dealId,
        field_name: `proposal_price_override`,
        field_label: `Override de Preço (Proposta ${proposal?.number || 'Nova'})`,
        old_value: `${item.description}: Preço Tabela = R$ ${currentPrice.toFixed(2)}`,
        new_value: `Novo Preço = R$ ${proposedPrice.toFixed(2)} | Justificativa: ${justification}`,
        changed_by: user?.id,
      });

      toast.success('Alteração de preço autorizada e registrada');
    } catch (error) {
      console.error('Error logging price override:', error);
      toast.error('Erro ao registrar alteração');
    }

    setPendingPriceChange(null);
    
    // If there was a pending submit, check for more items or execute submit
    if (pendingSubmit) {
      const nextOutOfRange = findNextOutOfRangeItem(index + 1);
      
      if (nextOutOfRange) {
        // There are more items pending authorization
        priceChangeConfirmedRef.current = false;
        setPendingPriceChange(nextOutOfRange);
        setShowPriceOverrideModal(true);
        setPriceChangeConfirmed(false);
      } else {
        // All items authorized, execute submit
        setPendingSubmit(false);
        if (isEditing) {
          updateProposalMutation.mutate();
        } else {
          createProposalMutation.mutate();
        }
      }
    }
  };

  // Handle cancellation of price override - revert to table price
  const handlePriceOverrideCancel = () => {
    if (!pendingPriceChange) return;
    
    const { index, currentPrice } = pendingPriceChange;
    const updatedItems = [...items];
    updatedItems[index].unit_price = currentPrice;
    updatedItems[index].subtotal = calculateItemSubtotal(updatedItems[index]);
    setItems(updatedItems);
    
    // If there was a pending submit, cancel it
    if (pendingSubmit) {
      setPendingSubmit(false);
      toast.info('Atualização cancelada - preço fora do range não autorizado');
    } else {
      toast.info('Preço revertido para o valor da tabela');
    }
    
    setPendingPriceChange(null);
    setShowPriceOverrideModal(false);
  };

  const updateItem = (index: number, field: keyof ProposalItem, value: any) => {
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    
    // If quantity changed and pricing table applies, recalculate price
    if (field === 'quantity' && updatedItems[index].product_id) {
      const product = products?.find(p => p.id === updatedItems[index].product_id);
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
            value as number,
            product.unit_price || 0
          );
          updatedItems[index].unit_price = finalPrice;
          if (rule?.discount_percent) {
            updatedItems[index].discount_percent = rule.discount_percent;
          }
        }
      }
    }
    
    updatedItems[index].subtotal = calculateItemSubtotal(updatedItems[index]);
    setItems(updatedItems);
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
          field: 'unit_price',
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      toast.error('Adicione pelo menos um item à proposta');
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

    // All items validated, proceed with submit
    if (isEditing) {
      updateProposalMutation.mutate();
    } else {
      createProposalMutation.mutate();
    }
  };

  const handleGeneratePDF = async () => {
    if (!proposal) return;
    
    try {
      toast.info('Gerando proposta...');
      const { data, error } = await supabase.functions.invoke('generate-proposal-pdf', {
        body: { proposal_id: proposal.id },
      });

      if (error) throw error;

      if (data?.html) {
        // Open HTML in new tab for printing
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(data.html);
          printWindow.document.close();
          toast.success('Proposta gerada! Use Ctrl+P para salvar como PDF.');
        }
      } else {
        toast.error('Erro ao gerar proposta');
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Erro ao gerar PDF');
    }
  };

  const handleGenerateApprovalLink = async () => {
    if (!proposal) return;
    
    try {
      setGeneratingLink(true);
      
      // Generate UUID token
      const token = crypto.randomUUID();
      
      // Set expiration to validity date or 30 days from now
      const expiresAt = proposal.validity_date 
        ? new Date(proposal.validity_date).toISOString()
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      
      // Update proposal with token
      const { error } = await supabase
        .from('proposals')
        .update({
          approval_token: token,
          approval_token_expires_at: expiresAt,
        })
        .eq('id', proposal.id);

      if (error) throw error;

      // Build the approval link
      const baseUrl = window.location.origin;
      const link = `${baseUrl}/proposta/${token}`;
      
      setApprovalLink(link);
      setApprovalExpires(expiresAt);
      setShowApprovalModal(true);
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      
      toast.success('Link de aprovação gerado!');
    } catch (error) {
      console.error('Error generating approval link:', error);
      toast.error('Erro ao gerar link de aprovação');
    } finally {
      setGeneratingLink(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-full max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {isEditing ? `Editar Proposta ${proposal?.number}` : 'Nova Proposta'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-6">
              {/* Proposal Info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="validity_date">Data de Validade</Label>
                  <Input
                    id="validity_date"
                    type="date"
                    value={formData.validity_date}
                    onChange={(e) => setFormData({ ...formData, validity_date: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(v) => setFormData({ ...formData, status: v as ProposalStatus })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(proposalStatusConfig).map(([value, config]) => (
                        <SelectItem key={value} value={value}>{config.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="payment_terms">Cond. Pagamento</Label>
                  <Input
                    id="payment_terms"
                    value={formData.payment_terms}
                    onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                    placeholder="Ex: 30/60/90"
                  />
                </div>
                <div>
                  <Label htmlFor="delivery_terms">Prazo Entrega</Label>
                  <Input
                    id="delivery_terms"
                    value={formData.delivery_terms}
                    onChange={(e) => setFormData({ ...formData, delivery_terms: e.target.value })}
                    placeholder="Ex: 15 dias"
                  />
                </div>
              </div>

              {/* IPI Mode Selector */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="col-span-2">
                  <Label>Modo IPI</Label>
                  <Select
                    value={formData.ipi_mode}
                    onValueChange={(v) => setFormData({ ...formData, ipi_mode: v as IpiMode })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ipiModeConfig).map(([value, config]) => (
                        <SelectItem key={value} value={value}>
                          {config.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {ipiModeConfig[formData.ipi_mode].description}
                  </p>
                </div>
              </div>

              {/* Pricing Table Indicator */}
              {linkedPricingTableFromEntity && (
                <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <DollarSign className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <div className="flex-1">
                    <span className="text-sm text-amber-700 dark:text-amber-300">
                      Tabela de preços vinculada: <strong>{linkedPricingTableFromEntity.name}</strong>
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

              {/* Add Product */}
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label>Adicionar Produto do Catálogo</Label>
                  <Popover open={productSearchOpen} onOpenChange={setProductSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={productSearchOpen}
                        className="w-full justify-between font-normal"
                        type="button"
                      >
                        {selectedProductId
                          ? (() => {
                              const p = products?.find((p) => p.id === selectedProductId);
                              return p ? `${p.sku} - ${p.name}` : 'Selecione um produto';
                            })()
                          : 'Selecione um produto'}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[500px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Pesquisar produto por nome ou SKU..." />
                        <CommandList>
                          <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
                          <CommandGroup>
                            {products?.map((p) => (
                              <CommandItem
                                key={p.id}
                                value={`${p.sku} ${p.name}`}
                                onSelect={() => {
                                  setSelectedProductId(p.id);
                                  setProductSearchOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedProductId === p.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <span className="font-mono text-xs mr-2">{p.sku}</span>
                                <span className="truncate">{p.name}</span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <Button type="button" onClick={addProductToItems} disabled={!selectedProductId}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar
                </Button>
              </div>

              {/* Items Table */}
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                     <TableRow>
                      <TableHead className="w-[110px]">SKU</TableHead>
                      <TableHead className="min-w-[150px]">Descrição</TableHead>
                      <TableHead className="w-[150px]">Medidas</TableHead>
                      <TableHead className="w-[80px]">Qtd</TableHead>
                      <TableHead className="w-[120px]">Preço Un.</TableHead>
                      <TableHead className="w-[70px]">Desc %</TableHead>
                      <TableHead className="w-[100px] text-right">Subtotal</TableHead>
                      {formData.ipi_mode !== 'isento' && (
                        <>
                          <TableHead className="w-[70px] text-right">IPI %</TableHead>
                          <TableHead className="w-[100px] text-right">IPI R$</TableHead>
                        </>
                      )}
                      <TableHead className="w-[110px] text-right">Total</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={formData.ipi_mode !== 'isento' ? 12 : 10} className="text-center text-muted-foreground py-8">
                          <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          Adicione produtos à proposta
                        </TableCell>
                      </TableRow>
                    ) : (
                      items.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-mono text-xs">
                            {item.product?.sku || '-'}
                          </TableCell>
                          <TableCell>
                            <Input
                              value={item.description || ''}
                              onChange={(e) => updateItem(index, 'description', e.target.value)}
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Input
                                type="number"
                                placeholder="L"
                                value={item.width || ''}
                                onChange={(e) => updateItem(index, 'width', parseFloat(e.target.value) || 0)}
                                className="h-8 w-14 px-1 text-xs"
                              />
                              <Input
                                type="number"
                                placeholder="C"
                                value={item.length || ''}
                                onChange={(e) => updateItem(index, 'length', parseFloat(e.target.value) || 0)}
                                className="h-8 w-14 px-1 text-xs"
                              />
                              <Input
                                type="number"
                                placeholder="E"
                                value={item.thickness || ''}
                                onChange={(e) => updateItem(index, 'thickness', parseFloat(e.target.value) || 0)}
                                className="h-8 w-14 px-1 text-xs"
                              />
                            </div>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.001"
                              min="0"
                              value={item.quantity || 1}
                              onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 1)}
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <div className="relative">
                              <CurrencyInput
                                value={item.unit_price || 0}
                                onChange={(val) => updateItem(index, 'unit_price', val)}
                                onBlur={() => handlePriceBlur(index, 'unit_price')}
                                className={`h-8 ${hasPricingTableLinked && !isAdmin ? 'bg-muted' : ''}`}
                                disabled={hasPricingTableLinked && !isAdmin}
                              />
                              {hasPricingTableLinked && (
                                <DollarSign className={`absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 ${isAdmin ? 'text-amber-500' : 'text-muted-foreground'}`} />
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="relative">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                max="100"
                                value={item.discount_percent || 0}
                                onChange={(e) => updateItem(index, 'discount_percent', parseFloat(e.target.value) || 0)}
                                onBlur={() => handlePriceBlur(index, 'discount_percent')}
                                className={`h-8 ${hasPricingTableLinked && !isAdmin ? 'bg-muted' : ''}`}
                                disabled={hasPricingTableLinked && !isAdmin}
                              />
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium text-xs">
                            {formatCurrency(calculateItemSubtotal(item))}
                          </TableCell>
                          {formData.ipi_mode !== 'isento' && (
                            <>
                              <TableCell className="text-right text-xs">
                                {(item.ipi_rate || 0).toFixed(2)}%
                              </TableCell>
                              <TableCell className="text-right text-xs">
                                {formatCurrency(calculateIpiValue(calculateItemSubtotal(item), item.ipi_rate || 0, formData.ipi_mode))}
                              </TableCell>
                            </>
                          )}
                          <TableCell className="text-right font-bold text-xs">
                            {(() => {
                              const sub = calculateItemSubtotal(item);
                              const ipiRate = formData.ipi_mode === 'isento' ? 0 : (item.ipi_rate || 0);
                              const ipiVal = calculateIpiValue(sub, ipiRate, formData.ipi_mode);
                              return formatCurrency(calculateItemTotal(sub, ipiVal, formData.ipi_mode));
                            })()}
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeItem(index)}
                              className="h-8 w-8"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Totals */}
              <div className="flex justify-end">
                <div className="text-right p-4 bg-muted rounded-lg space-y-1">
                  <div className="flex justify-between gap-8 text-sm">
                    <span className="text-muted-foreground">Subtotal Produtos:</span>
                    <span>{formatCurrency(calculateSubtotalProducts())}</span>
                  </div>
                  {formData.ipi_mode !== 'isento' && (
                    <div className="flex justify-between gap-8 text-sm">
                      <span className="text-muted-foreground">
                        IPI Total {formData.ipi_mode === 'incluso' ? '(informativo)' : ''}:
                      </span>
                      <span>{formatCurrency(calculateTotalIpi())}</span>
                    </div>
                  )}
                  <div className="flex justify-between gap-8 pt-1 border-t">
                    <span className="text-muted-foreground font-medium">Valor Total:</span>
                    <span className="text-2xl font-bold">{formatCurrency(calculateTotal())}</span>
                  </div>
                </div>
              </div>

              {/* Observations */}
              <div>
                <Label htmlFor="observations">Observações</Label>
                <Textarea
                  id="observations"
                  value={formData.observations}
                  onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                  rows={3}
                  placeholder="Condições especiais, informações adicionais..."
                />
              </div>
            </div>
          </ScrollArea>

          {/* Actions */}
          <div className="flex justify-between gap-2 pt-4 border-t mt-4">
            <div className="flex gap-2">
              {isEditing && (
                <>
                  <Button type="button" variant="outline" onClick={handleGeneratePDF}>
                    <Download className="h-4 w-4 mr-2" />
                    Gerar PDF
                  </Button>
                  {(proposal?.status === 'rascunho' || proposal?.status === 'enviada' || proposal?.status === 'em_analise') && (
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={handleGenerateApprovalLink}
                      disabled={generatingLink}
                    >
                      {generatingLink ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Link2 className="h-4 w-4 mr-2" />
                      )}
                      Link de Aprovação
                    </Button>
                  )}
                </>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createProposalMutation.isPending || updateProposalMutation.isPending}
              >
                {isEditing ? 'Atualizar' : 'Criar Proposta'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>

      {/* Approval Link Modal */}
      <ApprovalLinkModal
        open={showApprovalModal}
        onOpenChange={setShowApprovalModal}
        approvalLink={approvalLink}
        expiresAt={approvalExpires}
        proposalNumber={proposal?.number || ''}
      />

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
