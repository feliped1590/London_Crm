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
import { Plus, Trash2, Package, FileText, Check, X, Download, Link2, Loader2, DollarSign, ChevronsUpDown, Search } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/formatters';
import { calculateIpiValue, calculateItemTotal } from '@/utils/pricing/ipiCalculations';
import { useDocumentItems } from '@/hooks/useDocumentItems';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import { Proposal, ProposalItem, Product, ProposalStatus, IpiMode, ipiModeConfig, proposalStatusConfig } from '@/types/products';
import { ApprovalLinkModal } from './ApprovalLinkModal';
import { PriceOverrideModal } from './PriceOverrideModal';
import { DocumentTotals } from '@/components/documents/DocumentTotals';
import { DocumentLogisticsSection, EMPTY_DELIVERY_FIELDS, buildLogisticsPayload, extractLogisticsFromRecord } from '@/components/documents/DocumentLogisticsSection';
import { useProductAdd } from '@/components/documents/ProductSelector';
import { usePriceValidation } from '@/modules/documents/usePriceValidation';
import { ProductSearchModal } from '@/components/products/ProductSearchModal';
import { useRecentProducts } from '@/hooks/useRecentProducts';
import { getWonStageForPipeline } from '@/lib/stageStatus';

interface ProposalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: string;
  companyId?: string | null;
  contactId?: string | null;
  proposal?: Proposal | null;
  onSuccess?: () => void;
}

export function ProposalDialog({ open, onOpenChange, dealId, companyId, contactId, proposal, onSuccess }: ProposalDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { isAdmin } = useModulePermissions();
  const isEditing = !!proposal;

  const {
    resolveProductPricing, autoFillFromCompany, linkedPricingTable,
    hasPricingTable, companyFiscalData, getApplicableTable, calculatePrice,
  } = useProductAdd({ companyId: companyId || null, contactId: contactId || null });

  const [formData, setFormData] = useState({
    validity_date: '', payment_terms: '', delivery_terms: '', observations: '',
    status: 'rascunho' as ProposalStatus, ipi_mode: 'destacar' as IpiMode,
  });

  const proposalItemSubtotal = useCallback((item: Partial<ProposalItem>) => {
    const qty = item.quantity || 1;
    const price = item.unit_price || 0;
    const discount = item.discount_percent || 0;
    return qty * price * (1 - discount / 100);
  }, []);

  const {
    items, setItems, addItem, removeItem, updateItem: hookUpdateItem,
    subtotalProducts, totalIpi, total,
    getItemIpiValue, getItemTotal,
  } = useDocumentItems<Partial<ProposalItem>>({
    ipiMode: formData.ipi_mode,
    calculateItemSubtotal: proposalItemSubtotal,
  });

  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [productSearchOpen, setProductSearchOpen] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalLink, setApprovalLink] = useState('');
  const [approvalExpires, setApprovalExpires] = useState<string | null>(null);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [advancedSearchOpen, setAdvancedSearchOpen] = useState(false);
  const { addRecent } = useRecentProducts();

  // Logistics state
  const [carrierId, setCarrierId] = useState('');
  const [freightType, setFreightType] = useState('');
  const [deliverySameAsCompany, setDeliverySameAsCompany] = useState(true);
  const [deliveryFields, setDeliveryFields] = useState(EMPTY_DELIVERY_FIELDS);

  // --- Mutations ---
  const createProposalMutation = useMutation({
    mutationFn: async () => {
      const { data: newProposal, error: proposalError } = await supabase
        .from('proposals')
        .insert({
          number: '', deal_id: dealId, company_id: companyId, contact_id: contactId,
          legal_entity_id: dealData?.legal_entity_id || null,
          status: formData.status, validity_date: formData.validity_date || null,
          payment_terms: formData.payment_terms || null, delivery_terms: formData.delivery_terms || null,
          observations: formData.observations || null, total_value: total,
          ipi_mode: formData.ipi_mode, subtotal_products: subtotalProducts, total_ipi: totalIpi,
          ...buildLogisticsPayload(carrierId, freightType, deliverySameAsCompany, deliveryFields),
        } as any)
        .select().single();
      if (proposalError) throw proposalError;

      if (items.length > 0) {
        const ipiMode = formData.ipi_mode;
        const itemsToInsert = items.map((item, index) => {
          const sub = proposalItemSubtotal(item);
          const ipiRate = ipiMode === 'isento' ? 0 : (item.ipi_rate || 0);
          const ipiVal = calculateIpiValue(sub, ipiRate, ipiMode);
          const totalItem = calculateItemTotal(sub, ipiVal, ipiMode);
          return {
            proposal_id: newProposal.id, product_id: item.product_id || null,
            description: item.description || '', quantity: item.quantity || 1,
            unit_price: item.unit_price || 0, width: item.width || null,
            length: item.length || null, thickness: item.thickness || null,
            discount_percent: item.discount_percent || 0, subtotal: sub,
            ipi_rate: ipiRate, ipi_value: ipiVal, subtotal_item: sub, total_item: totalItem,
            sort_order: index, calculated_price_source: item.calculated_price_source || 'MANUAL',
          };
        });
        const { error: itemsError } = await supabase.from('proposal_items').insert(itemsToInsert);
        if (itemsError) throw itemsError;
      }
      if (formData.status === 'aprovada') await createOrderFromProposal(newProposal.id);
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
      const { error: proposalError } = await supabase
        .from('proposals')
        .update({
          status: formData.status, validity_date: formData.validity_date || null,
          payment_terms: formData.payment_terms || null, delivery_terms: formData.delivery_terms || null,
          observations: formData.observations || null, total_value: total,
          ipi_mode: formData.ipi_mode, subtotal_products: subtotalProducts, total_ipi: totalIpi,
          ...buildLogisticsPayload(carrierId, freightType, deliverySameAsCompany, deliveryFields),
        })
        .eq('id', proposal.id);
      if (proposalError) throw proposalError;

      await supabase.from('proposal_items').delete().eq('proposal_id', proposal.id);
      if (items.length > 0) {
        const ipiMode = formData.ipi_mode;
        const itemsToInsert = items.map((item, index) => {
          const sub = proposalItemSubtotal(item);
          const ipiRate = ipiMode === 'isento' ? 0 : (item.ipi_rate || 0);
          const ipiVal = calculateIpiValue(sub, ipiRate, ipiMode);
          const totalItem = calculateItemTotal(sub, ipiVal, ipiMode);
          return {
            proposal_id: proposal.id, product_id: item.product_id || null,
            description: item.description || '', quantity: item.quantity || 1,
            unit_price: item.unit_price || 0, width: item.width || null,
            length: item.length || null, thickness: item.thickness || null,
            discount_percent: item.discount_percent || 0, subtotal: sub,
            ipi_rate: ipiRate, ipi_value: ipiVal, subtotal_item: sub, total_item: totalItem,
            sort_order: index, calculated_price_source: item.calculated_price_source || 'MANUAL',
          };
        });
        const { error: itemsError } = await supabase.from('proposal_items').insert(itemsToInsert);
        if (itemsError) throw itemsError;
      }
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

  // --- Queries ---
  const { data: dealData } = useQuery({
    queryKey: ['deal_legal_entity', dealId],
    queryFn: async () => {
      const { data, error } = await supabase.from('deals').select('legal_entity_id, pipeline_id').eq('id', dealId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!dealId,
  });

  const { data: products } = useQuery({
    queryKey: ['products', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('*').eq('active', true).order('name');
      if (error) throw error;
      return data as unknown as Product[];
    },
  });

  const { data: existingItems } = useQuery({
    queryKey: ['proposal_items', proposal?.id],
    queryFn: async () => {
      if (!proposal) return [];
      const { data, error } = await supabase.from('proposal_items').select('*, product:products(id, sku, name)').eq('proposal_id', proposal.id).order('sort_order');
      if (error) throw error;
      return data as ProposalItem[];
    },
    enabled: !!proposal,
  });

  // --- Price Validation (after products query) ---
  const priceValidation = usePriceValidation({
    items, setItems, products,
    companyId: companyId || null, contactId: contactId || null,
    calculateItemSubtotal: proposalItemSubtotal, isEditMode: isEditing,
    onSubmitCreate: () => createProposalMutation.mutate(),
    onSubmitUpdate: () => updateProposalMutation.mutate(),
  });

  // --- Effects ---
  useEffect(() => {
    if (proposal) {
      setFormData({
        validity_date: proposal.validity_date || '', payment_terms: proposal.payment_terms || '',
        delivery_terms: proposal.delivery_terms || '', observations: proposal.observations || '',
        status: proposal.status, ipi_mode: (proposal as any).ipi_mode || 'destacar',
      });
      const logistics = extractLogisticsFromRecord(proposal);
      setCarrierId(logistics.carrierId);
      setFreightType(logistics.freightType);
      setDeliverySameAsCompany(logistics.deliverySameAsCompany);
      setDeliveryFields(logistics.deliveryFields);
    } else {
      const defaultValidity = new Date();
      defaultValidity.setDate(defaultValidity.getDate() + 30);
      setFormData({
        validity_date: defaultValidity.toISOString().split('T')[0], payment_terms: '',
        delivery_terms: '', observations: '', status: 'rascunho', ipi_mode: 'destacar',
      });
      setItems([]);
      setCarrierId(''); setFreightType('');
      setDeliverySameAsCompany(true); setDeliveryFields(EMPTY_DELIVERY_FIELDS);
      if (companyId) {
        autoFillFromCompany(companyId).then(data => {
          if (data?.default_carrier_id) setCarrierId(data.default_carrier_id);
          if (data?.default_freight_type) setFreightType(data.default_freight_type);
          if (data?.contribuinte_ipi === false) setFormData(prev => ({ ...prev, ipi_mode: 'isento' as IpiMode }));
          else if (data?.contribuinte_ipi === true) setFormData(prev => ({ ...prev, ipi_mode: 'destacar' as IpiMode }));
        });
      }
    }
  }, [proposal, open]);

  useEffect(() => { if (existingItems) setItems(existingItems); }, [existingItems]);

  useEffect(() => {
    if (!companyFiscalData || items.length === 0) return;
    setItems(prev => prev.map(item => {
      if (!item.product) return item;
      return { ...item, ipi_rate: companyFiscalData.contribuinte_ipi ? ((item.product as any)?.aliquota_ipi || 0) : 0 };
    }));
  }, [companyFiscalData]);

  // --- Handlers ---
  const addProductById = useCallback((productId: string, productData?: any) => {
    const product = productData || products?.find(p => p.id === productId);
    if (!product) return;
    const { unitPrice, discountPercent, priceSource, ipiRate } = resolveProductPricing(product, formData.ipi_mode);
    addItem({
      product_id: product.id, description: product.name, quantity: 1,
      unit_price: unitPrice, width: product.width, length: product.length,
      thickness: product.thickness, discount_percent: discountPercent,
      subtotal: unitPrice, ipi_rate: ipiRate, product, calculated_price_source: priceSource,
    });
    addRecent(product.id);
    setSelectedProductId('');
  }, [products, formData.ipi_mode, resolveProductPricing, addItem, addRecent]);

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

  const updateItem = (index: number, field: keyof ProposalItem, value: any) => {
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    if (field === 'quantity' && updatedItems[index].product_id) {
      const product = products?.find(p => p.id === updatedItems[index].product_id);
      if (product) {
        const applicableTable = getApplicableTable(
          companyId ? 'company' : contactId ? 'contact' : null,
          companyId || contactId || null, product.id,
        );
        if (applicableTable) {
          const { finalPrice, rule } = calculatePrice(applicableTable.id, product.id, product.tipo_id, value as number, product.unit_price || 0);
          updatedItems[index].unit_price = finalPrice;
          if (rule?.discount_percent) updatedItems[index].discount_percent = rule.discount_percent;
        }
      }
    }
    updatedItems[index].subtotal = proposalItemSubtotal(updatedItems[index]);
    setItems(updatedItems);
  };

  const createOrderFromProposal = async (proposalId: string) => {
    const { data: proposalData } = await supabase.from('proposals').select('*').eq('id', proposalId).single();
    if (!proposalData) return;
    const { data: newOrder, error: orderError } = await supabase.from('orders').insert({
      number: '', proposal_id: proposalId, company_id: proposalData.company_id,
      contact_id: proposalData.contact_id, status: 'pendente', total_value: proposalData.total_value,
      observations: proposalData.observations, ipi_mode: proposalData.ipi_mode || 'destacar',
      subtotal_products: proposalData.subtotal_products || 0, total_ipi: proposalData.total_ipi || 0,
      ...buildLogisticsPayload(proposalData.carrier_id || '', proposalData.freight_type || '', proposalData.delivery_same_as_company ?? true, {
        name: proposalData.delivery_name || '', address: proposalData.delivery_address || '',
        number: proposalData.delivery_number || '', neighborhood: proposalData.delivery_neighborhood || '',
        city: proposalData.delivery_city || '', state: proposalData.delivery_state || '',
        zip_code: proposalData.delivery_zip_code || '', contact: proposalData.delivery_contact || '',
      }),
    } as any).select().single();
    if (orderError) throw orderError;
    const { data: proposalItems } = await supabase.from('proposal_items').select('*').eq('proposal_id', proposalId);
    if (proposalItems?.length) {
      await supabase.from('order_items').insert(proposalItems.map((item: any) => ({
        order_id: newOrder.id, product_id: item.product_id, description: item.description,
        quantity: item.quantity, unit_price: item.unit_price, width: item.width, length: item.length,
        thickness: item.thickness, subtotal: item.subtotal, sort_order: item.sort_order,
        ipi_rate: item.ipi_rate || 0, ipi_value: item.ipi_value || 0,
        subtotal_item: item.subtotal_item || item.subtotal, total_item: item.total_item || item.subtotal,
      })));
    }
    if (proposalData.deal_id) {
      // Buscar dinamicamente a etapa "won" do pipeline do deal — sem hardcode de 'fechado_ganho'
      const { data: dealRow } = await supabase
        .from('deals')
        .select('pipeline_id, stage')
        .eq('id', proposalData.deal_id)
        .single();

      const { stageCode } = await getWonStageForPipeline(dealRow?.pipeline_id);
      const newStage = stageCode || 'fechado_ganho';

      const { error: dealUpdateError } = await supabase
        .from('deals')
        .update({ stage: newStage, closed_at: new Date().toISOString() })
        .eq('id', proposalData.deal_id);

      if (!dealUpdateError) {
        await supabase.from('deal_audit_log').insert({
          deal_id: proposalData.deal_id,
          field_name: 'stage',
          field_label: 'Etapa',
          old_value: dealRow?.stage ?? null,
          new_value: newStage,
          changed_by: user?.id,
        });
        toast.success('Negócio movido para a etapa de Ganho!');
      }
    }
    toast.success('Pedido gerado automaticamente!');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) { toast.error('Adicione pelo menos um item à proposta'); return; }
    if ((freightType === 'CIF' || freightType === 'FOB') && !carrierId) { toast.error('Transportadora é obrigatória quando o tipo de frete é CIF ou FOB'); return; }
    if (!priceValidation.validateBeforeSubmit()) return;
    if (isEditing) updateProposalMutation.mutate();
    else createProposalMutation.mutate();
  };

  const handlePriceBlurWithAudit = async (index: number, field: 'unit_price' | 'discount_percent') => {
    priceValidation.handlePriceBlur(index, field);
  };

  const handlePriceOverrideConfirmWithAudit = async (justification: string) => {
    const pending = priceValidation.pendingPriceChange;
    if (pending) {
      try {
        await supabase.from('deal_audit_log').insert({
          deal_id: dealId, field_name: 'proposal_price_override',
          field_label: `Override de Preço (Proposta ${proposal?.number || 'Nova'})`,
          old_value: `${pending.itemDescription}: Preço Tabela = R$ ${pending.currentPrice.toFixed(2)}`,
          new_value: `Novo Preço = R$ ${pending.proposedPrice.toFixed(2)} | Justificativa: ${justification}`,
          changed_by: user?.id,
        });
        toast.success('Alteração de preço autorizada e registrada');
      } catch { console.error('Error logging price override'); }
    }
    priceValidation.handlePriceOverrideConfirm(justification);
  };

  const handleGeneratePDF = async () => {
    if (!proposal) return;
    try {
      toast.info('Gerando proposta...');
      const { data, error } = await supabase.functions.invoke('generate-proposal-pdf', { body: { proposal_id: proposal.id } });
      if (error) throw error;
      if (data?.html) {
        const printWindow = window.open('', '_blank');
        if (printWindow) { printWindow.document.write(data.html); printWindow.document.close(); toast.success('Proposta gerada! Use Ctrl+P para salvar como PDF.'); }
      } else toast.error('Erro ao gerar proposta');
    } catch { toast.error('Erro ao gerar PDF'); }
  };

  const handleGenerateApprovalLink = async () => {
    if (!proposal) return;
    try {
      setGeneratingLink(true);
      const token = crypto.randomUUID();
      const expiresAt = proposal.validity_date ? new Date(proposal.validity_date).toISOString() : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const { error } = await supabase.from('proposals').update({ approval_token: token, approval_token_expires_at: expiresAt }).eq('id', proposal.id);
      if (error) throw error;
      setApprovalLink(`${window.location.origin}/proposta/${token}`);
      setApprovalExpires(expiresAt);
      setShowApprovalModal(true);
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      toast.success('Link de aprovação gerado!');
    } catch { toast.error('Erro ao gerar link de aprovação'); }
    finally { setGeneratingLink(false); }
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
                  <Input id="validity_date" type="date" value={formData.validity_date} onChange={(e) => setFormData({ ...formData, validity_date: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v as ProposalStatus })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(proposalStatusConfig).map(([value, config]) => (<SelectItem key={value} value={value}>{config.label}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="payment_terms">Cond. Pagamento</Label>
                  <Input id="payment_terms" value={formData.payment_terms} onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })} placeholder="Ex: 30/60/90" />
                </div>
                <div>
                  <Label htmlFor="delivery_terms">Prazo Entrega</Label>
                  <Input id="delivery_terms" value={formData.delivery_terms} onChange={(e) => setFormData({ ...formData, delivery_terms: e.target.value })} placeholder="Ex: 15 dias" />
                </div>
              </div>

              {/* IPI Mode */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="col-span-2">
                  <Label>Modo IPI</Label>
                  <Select value={formData.ipi_mode} onValueChange={(v) => setFormData({ ...formData, ipi_mode: v as IpiMode })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(ipiModeConfig).map(([value, config]) => (<SelectItem key={value} value={value}>{config.label}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">{ipiModeConfig[formData.ipi_mode].description}</p>
                </div>
              </div>

              {/* Pricing Table Indicator */}
              {linkedPricingTable && (
                <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <DollarSign className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <div className="flex-1">
                    <span className="text-sm text-amber-700 dark:text-amber-300">Tabela de preços vinculada: <strong>{linkedPricingTable.name}</strong></span>
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                      {isAdmin ? 'Você pode editar preços. Alterações fora da tabela requerem justificativa.' : 'Preços são ajustados automaticamente conforme a tabela.'}
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
                      <Button variant="outline" role="combobox" aria-expanded={productSearchOpen} className="w-full justify-between font-normal" type="button">
                        {selectedProductId ? (() => { const p = products?.find(p => p.id === selectedProductId); return p ? `${p.sku} - ${p.name}` : 'Selecione um produto'; })() : 'Selecione um produto'}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[500px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Pesquisar produto por nome ou SKU..." />
                        <CommandList>
                          <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
                          <CommandGroup>
                            {products?.map(p => (
                              <CommandItem key={p.id} value={`${p.sku} ${p.name}`} onSelect={() => { setSelectedProductId(p.id); setProductSearchOpen(false); }}>
                                <Check className={cn("mr-2 h-4 w-4", selectedProductId === p.id ? "opacity-100" : "opacity-0")} />
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
                <Button variant="outline" size="icon" type="button" onClick={() => setAdvancedSearchOpen(true)} title="Pesquisa Avançada (F9)">
                  <Search className="h-4 w-4" />
                </Button>
                <Button type="button" onClick={addProductToItems} disabled={!selectedProductId}>
                  <Plus className="h-4 w-4 mr-2" />Adicionar
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
                      {formData.ipi_mode !== 'isento' && (<><TableHead className="w-[70px] text-right">IPI %</TableHead><TableHead className="w-[100px] text-right">IPI R$</TableHead></>)}
                      <TableHead className="w-[110px] text-right">Total</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.length === 0 ? (
                      <TableRow><TableCell colSpan={formData.ipi_mode !== 'isento' ? 12 : 10} className="text-center text-muted-foreground py-8"><Package className="h-8 w-8 mx-auto mb-2 opacity-50" />Adicione produtos à proposta</TableCell></TableRow>
                    ) : items.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-mono text-xs">{item.product?.sku || '-'}</TableCell>
                        <TableCell><Input value={item.description || ''} onChange={(e) => updateItem(index, 'description', e.target.value)} className="h-8" /></TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Input type="number" placeholder="L" value={item.width || ''} onChange={(e) => updateItem(index, 'width', parseFloat(e.target.value) || 0)} className="h-8 w-14 px-1 text-xs" />
                            <Input type="number" placeholder="C" value={item.length || ''} onChange={(e) => updateItem(index, 'length', parseFloat(e.target.value) || 0)} className="h-8 w-14 px-1 text-xs" />
                            <Input type="number" placeholder="E" value={item.thickness || ''} onChange={(e) => updateItem(index, 'thickness', parseFloat(e.target.value) || 0)} className="h-8 w-14 px-1 text-xs" />
                          </div>
                        </TableCell>
                        <TableCell><Input type="number" step="0.001" min="0" value={item.quantity || 1} onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 1)} className="h-8" /></TableCell>
                        <TableCell>
                          <div className="relative">
                            <CurrencyInput value={item.unit_price || 0} onChange={(val) => updateItem(index, 'unit_price', val)} onBlur={() => handlePriceBlurWithAudit(index, 'unit_price')} className={`h-8 ${hasPricingTable && !isAdmin ? 'bg-muted' : ''}`} disabled={hasPricingTable && !isAdmin} />
                            {hasPricingTable && <DollarSign className={`absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 ${isAdmin ? 'text-amber-500' : 'text-muted-foreground'}`} />}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input type="number" step="0.01" min="0" max="100" value={item.discount_percent || 0} onChange={(e) => updateItem(index, 'discount_percent', parseFloat(e.target.value) || 0)} onBlur={() => handlePriceBlurWithAudit(index, 'discount_percent')} className={`h-8 ${hasPricingTable && !isAdmin ? 'bg-muted' : ''}`} disabled={hasPricingTable && !isAdmin} />
                        </TableCell>
                        <TableCell className="text-right font-medium text-xs">{formatCurrency(proposalItemSubtotal(item))}</TableCell>
                        {formData.ipi_mode !== 'isento' && (<>
                          <TableCell className="text-right text-xs">{(item.ipi_rate || 0).toFixed(2)}%</TableCell>
                          <TableCell className="text-right text-xs">{formatCurrency(calculateIpiValue(proposalItemSubtotal(item), item.ipi_rate || 0, formData.ipi_mode))}</TableCell>
                        </>)}
                        <TableCell className="text-right font-bold text-xs">{formatCurrency(getItemTotal(item))}</TableCell>
                        <TableCell><Button type="button" variant="ghost" size="icon" onClick={() => removeItem(index)} className="h-8 w-8"><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Totals */}
              <DocumentTotals subtotalProducts={subtotalProducts} totalIpi={totalIpi} total={total} ipiMode={formData.ipi_mode} />

              {/* Logistics */}
              <DocumentLogisticsSection
                carrierId={carrierId} setCarrierId={setCarrierId}
                freightType={freightType} setFreightType={setFreightType}
                deliverySameAsCompany={deliverySameAsCompany} setDeliverySameAsCompany={setDeliverySameAsCompany}
                deliveryFields={deliveryFields} setDeliveryFields={setDeliveryFields}
              />

              {/* Observations */}
              <div>
                <Label htmlFor="observations">Observações</Label>
                <Textarea id="observations" value={formData.observations} onChange={(e) => setFormData({ ...formData, observations: e.target.value })} rows={3} placeholder="Condições especiais, informações adicionais..." />
              </div>
            </div>
          </ScrollArea>

          {/* Actions */}
          <div className="flex justify-between gap-2 pt-4 border-t mt-4">
            <div className="flex gap-2">
              {isEditing && (<>
                <Button type="button" variant="outline" onClick={handleGeneratePDF}><Download className="h-4 w-4 mr-2" />Gerar PDF</Button>
                {(proposal?.status === 'rascunho' || proposal?.status === 'enviada' || proposal?.status === 'em_analise') && (
                  <Button type="button" variant="outline" onClick={handleGenerateApprovalLink} disabled={generatingLink}>
                    {generatingLink ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Link2 className="h-4 w-4 mr-2" />}Link de Aprovação
                  </Button>
                )}
              </>)}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={createProposalMutation.isPending || updateProposalMutation.isPending}>
                {isEditing ? 'Atualizar' : 'Criar Proposta'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>

      <ApprovalLinkModal open={showApprovalModal} onOpenChange={setShowApprovalModal} approvalLink={approvalLink} expiresAt={approvalExpires} proposalNumber={proposal?.number || ''} />

      {priceValidation.pendingPriceChange && (
        <PriceOverrideModal
          {...priceValidation.getPriceOverrideModalProps()}
          onConfirm={handlePriceOverrideConfirmWithAudit}
        />
      )}

      <ProductSearchModal
        open={advancedSearchOpen}
        onOpenChange={setAdvancedSearchOpen}
        onSelect={(product) => addProductById(product.id, product)}
      />
    </Dialog>
  );
}
